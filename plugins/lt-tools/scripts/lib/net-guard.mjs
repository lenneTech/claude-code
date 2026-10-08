// net-guard.mjs — keeps the mirror from fetching internal addresses (SSRF).
//
// A public site can redirect an asset to 169.254.169.254, localhost or a LAN host, and a
// robots.txt can list sitemaps on such hosts. Without a guard the mirror would store those
// answers inside the backup and the ZIP the user then passes on. Every hop is checked at
// connect time: literal IPs before the request, host names inside the DNS lookup the socket
// actually uses, so a DNS answer cannot change between check and connect.

import dns from 'node:dns';
import net from 'node:net';

function ipv4ToInt(ip) {
  return ip.split('.').reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

const V4_BLOCKED = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

function expandIpv6(ip) {
  let addr = ip.toLowerCase().split('%')[0];
  if (addr.includes('.')) {
    const v4 = addr.slice(addr.lastIndexOf(':') + 1);
    const n = ipv4ToInt(v4);
    addr = `${addr.slice(0, addr.lastIndexOf(':') + 1)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = addr.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const fill = addr.includes('::') ? Array(8 - h.length - t.length).fill('0') : [];
  return [...h, ...fill, ...t].map((g) => Number.parseInt(g || '0', 16));
}

/** True for loopback, private, link-local, CGNAT, ULA, multicast, reserved and documentation ranges. */
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return n === 0xffffffff || V4_BLOCKED.some(([base, mask]) => (n & mask) === (base & mask));
  }
  if (net.isIPv6(ip)) {
    const g = expandIpv6(ip);
    const embeddedV4 = (hi, lo) => isPrivateAddress(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    if (g.every((x) => x === 0)) return true; // ::
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return embeddedV4(g[6], g[7]); // ::ffff:a.b.c.d
    if (g[0] === 0x64 && g[1] === 0xff9b) return embeddedV4(g[6], g[7]); // NAT64
    if (g[0] === 0x2002) return embeddedV4(g[1], g[2]); // 6to4
    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((g[0] & 0xff00) === 0xff00) return true; // multicast
    if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
    return false;
  }
  return true;
}

/**
 * Policy: `allowPrivate` is true (allow everything), false (block private ranges) or an array
 * of exact addresses that may pass although private (used for a local test server).
 */
export function addressAllowed(ip, allowPrivate) {
  if (allowPrivate === true) return true;
  if (Array.isArray(allowPrivate) && allowPrivate.includes(ip)) return true;
  return !isPrivateAddress(ip);
}

export class BlockedAddressError extends Error {
  constructor(host, ip) {
    super(`blocked private address ${ip} for ${host} (use --allow-private-hosts for internal sites)`);
    this.code = 'EBLOCKED';
  }
}

/** A dns.lookup replacement for http(s).request that refuses blocked addresses. */
export function guardedLookup(allowPrivate) {
  return (hostname, options, callback) => {
    const opts = typeof options === 'object' ? options : { family: options };
    dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const blocked = addresses.find((a) => !addressAllowed(a.address, allowPrivate));
      if (blocked) return callback(new BlockedAddressError(hostname, blocked.address));
      if (opts.all) return callback(null, addresses);
      return callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

/** Literal IP hosts never pass through lookup, so they are checked before the request. */
export function checkLiteralHost(hostname, allowPrivate) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !addressAllowed(host, allowPrivate)) throw new BlockedAddressError(host, host);
}
