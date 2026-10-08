// args.mjs — minimal command-line parser shared by the lt-tools scripts.
//
// Supports `--key value`, `--key=value`, boolean flags and positional arguments.
// A flag listed in `booleans` never consumes the next argument.

export function parseArgs(argv, { booleans = [], multi = [] } = {}) {
  const options = {};
  const positional = [];
  const boolSet = new Set(booleans);
  const multiSet = new Set(multi);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    let key = arg.slice(2);
    let value;
    const eq = key.indexOf('=');
    if (eq !== -1) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else if (key.startsWith('no-') && boolSet.has(key.slice(3))) {
      key = key.slice(3);
      value = false;
    } else if (boolSet.has(key)) {
      value = true;
    } else {
      value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Option --${key} expects a value`);
      }
      i++;
    }
    const name = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (multiSet.has(key)) {
      (options[name] ||= []).push(value);
    } else {
      options[name] = value;
    }
  }
  return { options, positional };
}

export function toInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) throw new Error(`Not a number: ${value}`);
  return n;
}
