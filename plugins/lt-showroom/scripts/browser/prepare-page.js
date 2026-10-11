async () => {
  // prepare-page.js — run through Chrome DevTools MCP `evaluate_script` after every navigation
  // or reload and before every capture. It leaves the page as a visitor would see it after
  // reading it once:
  //   1. scrolls through the page once, so lazy images and scroll-reveal animations reach
  //      their final state, then back to the top;
  //   2. hides cookie / consent banners, chat launchers and framework dev overlays — only
  //      fixed-position or dialog elements whose id, class, label or text say what they are,
  //      never regular page content;
  //   3. freezes animations, transitions and the text caret, so two captures of one state match;
  //   4. waits for web fonts and images (at most 5 s).
  // Returns what it hid and whether the layout overflows horizontally (the mobile check).
  const report = { hidden: [], horizontalOverflow: false, pendingImages: 0 };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
  const maxY = Math.min(document.documentElement.scrollHeight, 30000);
  for (let y = 0; y <= maxY; y += step) {
    window.scrollTo(0, y);
    await wait(120);
  }
  window.scrollTo(0, 0);
  await wait(300);

  const devOverlays = [
    'nuxt-devtools-frame',
    '#nuxt-devtools-container',
    '#__nuxt-devtools',
    'vite-error-overlay',
    'vite-plugin-checker-error-overlay',
    '#vue-devtools-anchor',
    '#webpack-dev-server-client-overlay',
    'nextjs-portal',
  ];
  const consentWords =
    /cookie|consent|gdpr|dsgvo|privacy-banner|usercentrics|cookiebot|onetrust|klaro|borlabs|tarteaucitron|iubenda|cmplz|ccm19|intercom|crisp-client|tawk|hubspot-messages|chat-widget|livechat/i;
  const consentText = /cookie|einwillig|zustimm|consent|datenschutzeinstellungen|privacy settings/i;
  const hide = (el, why) => {
    el.style.setProperty('display', 'none', 'important');
    report.hidden.push(`${why}: ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
  };

  for (const sel of devOverlays) {
    for (const el of document.querySelectorAll(sel)) hide(el, 'dev overlay');
  }
  let hidConsent = false;
  for (const el of document.querySelectorAll('body *')) {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    const cs = getComputedStyle(el);
    const isFixed = cs.position === 'fixed';
    const isDialog = el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true';
    if (!isFixed && !isDialog) continue;
    const label = `${el.id} ${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('aria-label') ?? ''}`;
    const text = (el.textContent ?? '').slice(0, 400);
    if (consentWords.test(label) || (isDialog && consentText.test(text)) || (isFixed && el.tagName === 'IFRAME' && consentWords.test(el.src))) {
      hide(el, 'consent/chat');
      hidConsent = true;
    }
  }
  if (hidConsent) {
    // Consent tools lock scrolling and dim the page while their banner is open.
    for (const el of [document.documentElement, document.body]) {
      el.style.removeProperty('overflow');
      el.style.setProperty('overflow', 'auto', 'important');
    }
  }

  const style = document.createElement('style');
  style.setAttribute('data-lt-showroom', 'freeze');
  style.textContent =
    '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;' +
    'animation-iteration-count:1!important;transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(style);

  try {
    await Promise.race([document.fonts.ready, wait(5000)]);
  } catch {
    /* no font loading API */
  }
  const deadline = Date.now() + 5000;
  const pending = () => [...document.images].filter((img) => img.loading !== 'lazy' && !img.complete);
  while (pending().length && Date.now() < deadline) await wait(150);
  report.pendingImages = pending().length;
  report.horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
  return report;
}
