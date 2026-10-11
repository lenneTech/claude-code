() => {
  // anonymize-dom.js — replaces production data in the rendered page, in the browser only,
  // right before a screenshot. Nothing is sent anywhere; reloading the page restores it.
  //
  // Before passing this function to Chrome DevTools MCP `evaluate_script`, fill in:
  //   REPLACEMENTS  [original, replacement] pairs for everything a pattern cannot find:
  //                 person and company names, addresses, amounts, project titles, free text.
  //                 Longer originals are applied first, so "Anna Becker GmbH" wins over "Anna".
  //   BLUR          CSS selectors for data that is not text: photos, avatars, canvas charts,
  //                 maps, embedded PDFs, video stills. They are blurred in place, so the layout
  //                 and colours stay those of the original.
  // E-mail addresses, IBANs and phone numbers are replaced automatically with neutral demo
  // values. A MutationObserver re-applies everything when the app re-renders, until the next
  // navigation. Returns what was replaced and what still looks like personal data, so the
  // caller can add pairs and run it again.
  const REPLACEMENTS = /*REPLACEMENTS*/ [];
  const BLUR = /*BLUR*/ [];

  const pairs = REPLACEMENTS.filter((p) => Array.isArray(p) && p[0] && typeof p[1] === 'string').sort(
    (a, b) => b[0].length - a[0].length,
  );
  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const ibanRe = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g;
  const phoneRe = /(?:\+\d{2,3}[ /-]?|\b0)\d{2,5}[ /-]?\d[\d /-]{4,}\d\b/g;
  const isDemoMail = (m) => /@example\.(?:com|org|net)$/i.test(m);
  const demoIban = 'DE02 1203 0000 0000 2020 51';
  const demoPhone = '+49 30 1234567';
  const state = (window.__ltShowroomAnonymize ??= { emails: new Map(), observer: null });
  const demoEmail = (m) => {
    if (!state.emails.has(m)) state.emails.set(m, `kontakt${state.emails.size + 1}@example.com`);
    return state.emails.get(m);
  };
  const stats = { textNodes: 0, attributes: 0, blurred: 0 };

  const apply = (text) => {
    let t = text;
    for (const [from, to] of pairs) if (t.includes(from)) t = t.split(from).join(to);
    t = t.replace(emailRe, (m) => (isDemoMail(m) ? m : demoEmail(m)));
    // IBANs are parked as tokens while phone numbers are replaced: their digit groups would
    // otherwise read as a phone number.
    const ibans = [];
    t = t.replace(ibanRe, () => `\u0000${ibans.push(demoIban) - 1}\u0000`);
    t = t.replace(phoneRe, (m) => (m === demoPhone ? m : demoPhone));
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => ibans[Number(i)]);
  };

  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const attrs = ['value', 'title', 'alt', 'aria-label', 'placeholder', 'data-tooltip'];
  const walkRoot = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (skip.has(n.parentElement?.tagName)) continue;
      const next = apply(n.nodeValue);
      if (next !== n.nodeValue) {
        n.nodeValue = next;
        stats.textNodes++;
      }
    }
    for (const el of root.querySelectorAll('*')) {
      for (const a of attrs) {
        const v = el.getAttribute(a);
        if (v) {
          const next = apply(v);
          if (next !== v) {
            el.setAttribute(a, next);
            stats.attributes++;
          }
        }
      }
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value) {
        const next = apply(el.value);
        if (next !== el.value) {
          el.value = next;
          stats.attributes++;
        }
      }
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') ?? '';
        if (/^(mailto|tel):/i.test(href)) el.setAttribute('href', href.split(':')[0] + ':' + apply(href.slice(href.indexOf(':') + 1)));
      }
      if (el.shadowRoot) walkRoot(el.shadowRoot);
    }
  };

  const run = () => {
    state.observer?.disconnect();
    walkRoot(document.body);
    for (const frame of document.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument?.body) walkRoot(frame.contentDocument.body);
      } catch {
        /* cross-origin frame: covered by BLUR if it shows data */
      }
    }
    for (const sel of BLUR) {
      for (const el of document.querySelectorAll(sel)) {
        el.style.setProperty('filter', 'blur(14px)', 'important');
        stats.blurred++;
      }
    }
    state.observer?.observe(document.body, { subtree: true, childList: true, characterData: true });
  };

  state.observer?.disconnect();
  state.observer = new MutationObserver(() => {
    clearTimeout(state.timer);
    state.timer = setTimeout(run, 50);
  });
  run();

  const text = document.body.innerText;
  const withoutDemoIbans = text.split(demoIban).join(' ');
  const mask = (s) => (s.length <= 4 ? '***' : `${s.slice(0, 2)}…${s.slice(-2)}`);
  const remaining = {
    emails: (text.match(emailRe) ?? []).filter((m) => !isDemoMail(m)).map(mask),
    ibans: (withoutDemoIbans.match(ibanRe) ?? []).map(mask),
    phones: (withoutDemoIbans.match(phoneRe) ?? []).filter((m) => m !== demoPhone).map(mask),
    originalsStillVisible: pairs.filter(([from]) => text.includes(from)).map(([from]) => mask(from)),
  };
  return { ...stats, emailsReplaced: state.emails.size, remaining };
}
