// page-probe.mjs — functions that run inside the browser page (sent as source text).
//
// Each function is self-contained: it is serialised with Function.prototype.toString
// and evaluated in the page, so it must not reference anything from this module.
// Neither function submits a form or follows a link.

/** What the page shows: text, images, computed styles, widgets. */
export async function fingerprint(opts) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ignoreSel = opts.ignore || '';
  const ignored = (el) => !!(ignoreSel && el.closest && el.closest(ignoreSel));
  const step = Math.max(300, Math.round(innerHeight * 0.6));
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    scrollTo(0, y);
    await sleep(opts.scrollPause ?? 120);
  }
  await sleep(300);
  const header = document.querySelector('header, #header, .header, [role="banner"]');
  const headerScrolled = header ? header.className.toString() : null;
  scrollTo(0, 0);
  await sleep(opts.settle ?? 1500);
  try {
    await document.fonts.ready;
  } catch {}

  const fileName = (src) => {
    try {
      const u = new URL(src, location.href);
      return decodeURIComponent(u.pathname.split('/').pop() || '')
        .replace(/__[qu][0-9a-f]{8}(?=\.|$)/, '')
        .replace(/\.offline\.js$/, '.js');
    } catch {
      return String(src);
    }
  };
  const hash = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  };
  const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME'];
  const text = [...document.body.children]
    .filter((el) => !ignored(el) && !skipTags.includes(el.tagName))
    .map((el) => el.innerText || '')
    .join('\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  const imgs = [...document.images].filter((i) => !ignored(i));
  const elements = [...document.body.querySelectorAll('*')].filter((el) => !ignored(el) && !el.closest('script,style,noscript,template,iframe'));
  const props = ['color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight', 'display', 'position', 'marginTop', 'paddingTop', 'borderTopWidth', 'textTransform', 'backgroundImage'];
  const pathOf = (el) => {
    const p = [];
    for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) {
      p.unshift(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (e.classList && e.classList[0] ? `.${e.classList[0]}` : ''));
    }
    return p.join('>');
  };
  const styles = elements.map((el) => {
    const cs = getComputedStyle(el);
    return `${pathOf(el)} | ${props
      .map((p) => (p === 'backgroundImage' ? cs[p].replace(/url\("?([^")]*)"?\)/g, (_, u) => `url(${fileName(u)})`) : cs[p]))
      .join(' ; ')}`;
  });
  const backgroundImages = new Set();
  for (const el of elements) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg.includes('url(')) for (const m of bg.matchAll(/url\("?([^")]*)"?\)/g)) backgroundImages.add(fileName(m[1]));
  }

  const sliders = [];
  for (const el of document.querySelectorAll('swiper-container, .swiper, .swiper-container')) {
    if (ignored(el) || (el.tagName !== 'SWIPER-CONTAINER' && el.parentElement && el.parentElement.closest('swiper-container'))) continue;
    sliders.push({
      lib: 'swiper',
      initialized: !!el.swiper || el.classList.contains('swiper-initialized'),
      slides: el.querySelectorAll('.swiper-slide, swiper-slide').length,
    });
  }
  const libs = [
    ['slick', '.slick-slider, [data-slick]', (el) => el.classList.contains('slick-initialized')],
    ['splide', '.splide', (el) => el.classList.contains('is-initialized') || el.classList.contains('is-active')],
    ['flickity', '[data-flickity], .flickity-enabled', (el) => el.classList.contains('flickity-enabled')],
    ['glide', '.glide', (el) => /glide--(slider|carousel)/.test(el.className)],
    ['owl', '.owl-carousel', (el) => el.classList.contains('owl-loaded')],
    ['tiny-slider', '.tns-outer', () => true],
  ];
  for (const [lib, sel, ok] of libs) {
    for (const el of document.querySelectorAll(sel)) if (!ignored(el)) sliders.push({ lib, initialized: !!ok(el) });
  }

  const toggles = {};
  for (const el of document.querySelectorAll('[data-bs-toggle], [data-toggle]')) {
    if (ignored(el)) continue;
    const t = el.getAttribute('data-bs-toggle') || el.getAttribute('data-toggle');
    toggles[t] = (toggles[t] || 0) + 1;
  }
  const iframeHost = (src) => {
    try {
      const u = new URL(src, location.href);
      return u.protocol === 'file:' || u.host === location.host ? 'self' : u.host;
    } catch {
      return '(none)';
    }
  };

  return {
    title: document.title,
    headings: [...document.querySelectorAll('h1, h2, h3')].filter((h) => !ignored(h)).map((h) => `${h.tagName}: ${h.innerText.trim().replace(/\s+/g, ' ')}`),
    textHash: hash(text),
    textLength: text.length,
    text: text.slice(0, 200000),
    images: {
      total: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src)).map((i) => fileName(i.currentSrc || i.src)),
      files: [...new Set(imgs.map((i) => fileName(i.currentSrc || i.src)))].sort(),
    },
    backgroundImages: [...backgroundImages].sort(),
    fonts: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))].sort(),
    styles,
    scrollHeight: document.documentElement.scrollHeight,
    sliders,
    toggles,
    forms: [...document.forms]
      .filter((f) => !ignored(f))
      .map((f) => ({ id: (f.id || f.getAttribute('name') || '').replace(/-?\d+$/, ''), noValidate: f.noValidate, fields: f.elements.length, required: f.querySelectorAll('[required]').length })),
    iframes: [...document.querySelectorAll('iframe')].filter((f) => !ignored(f)).map((f) => iframeHost(f.src)),
    videos: [...document.querySelectorAll('video')].map((v) => ({ src: fileName(v.currentSrc || v.querySelector('source')?.src || ''), loaded: v.readyState >= 1 })),
    headerTop: header ? header.className.toString() : null,
    headerScrolled,
  };
}

/** Exercises the interactive parts once. Never submits forms or follows links. */
export async function interact(opts) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ignoreSel = opts.ignore || '';
  const ignored = (el) => !!(ignoreSel && el.closest && el.closest(ignoreSel));
  const visible = (el) => !!el && !ignored(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList[0] ? `.${el.classList[0]}` : '');
  const panelOf = (el) => {
    const id = (el.getAttribute('aria-controls') || el.getAttribute('data-bs-target') || el.getAttribute('data-target') || '').replace(/^#/, '').split(' ')[0];
    return id ? document.getElementById(id) : null;
  };
  const r = {};
  window.scrollTo(0, 0);

  // Disclosure: accordion, collapse, ARIA disclosure button or <details>.
  const isNav = (el) => !!el.closest('.navbar, header nav, [role="navigation"]') || el.matches('.navbar-toggler, [class*="burger"], [class*="hamburger"]');
  const discState = (el) => {
    if (el.tagName === 'SUMMARY') return String(el.parentElement.open);
    const panel = panelOf(el);
    return `${el.getAttribute('aria-expanded') || ''}|${panel ? String(panel.getClientRects().length > 0 && !panel.hidden) : ''}`;
  };
  const disc = [...document.querySelectorAll('.accordion-button.collapsed, [data-bs-toggle="collapse"][aria-expanded="false"], button[aria-expanded="false"][aria-controls], details > summary')].find(
    (el) => visible(el) && !isNav(el),
  );
  if (disc) {
    disc.scrollIntoView({ block: 'center' });
    await sleep(250);
    const before = discState(disc);
    disc.click();
    await sleep(900);
    const after = discState(disc);
    disc.click();
    await sleep(900);
    r.disclosure = { element: describe(disc), changes: after !== before, restores: discState(disc) === before };
  }

  // Tabs.
  const tab = [...document.querySelectorAll('[role="tab"][aria-selected="false"], [data-bs-toggle="tab"]:not(.active), [data-bs-toggle="pill"]:not(.active)')].find(visible);
  if (tab) {
    const list = tab.closest('[role="tablist"]') || tab.parentElement?.parentElement || document;
    const prev = list.querySelector('[role="tab"][aria-selected="true"], [data-bs-toggle="tab"].active, [data-bs-toggle="pill"].active');
    tab.scrollIntoView({ block: 'center' });
    tab.click();
    await sleep(700);
    r.tab = { element: describe(tab), activates: tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active') };
    if (prev) {
      prev.click();
      await sleep(400);
    }
  }

  // Tooltip.
  const tip = [...document.querySelectorAll('[data-bs-toggle="tooltip"], [data-toggle="tooltip"], [data-tippy-content], [data-tooltip]')].find(visible);
  if (tip) {
    tip.scrollIntoView({ block: 'center' });
    const fire = (types) => {
      for (const t of types) tip.dispatchEvent(t.startsWith('focus') ? new FocusEvent(t, { bubbles: true }) : new MouseEvent(t, { bubbles: true }));
    };
    fire(['pointerover', 'mouseover', 'mouseenter', 'focusin']);
    await sleep(800);
    const box = [...document.querySelectorAll('.tooltip, [role="tooltip"], .tippy-box')].find((e) => e.getClientRects().length);
    r.tooltip = { shows: !!box };
    fire(['pointerout', 'mouseout', 'mouseleave', 'focusout']);
    await sleep(300);
  }

  // Sliders: autoplay and the "next" control.
  const sliderSel = 'swiper-container, .swiper, .slick-slider, .splide, .flickity-enabled, .glide, .owl-carousel, .keen-slider, .embla, .tns-outer';
  const sliders = [...document.querySelectorAll(sliderSel)].filter((el) => visible(el) && !(el.parentElement && el.parentElement.closest(sliderSel)));
  r.sliders = [];
  for (const el of sliders.slice(0, 4)) {
    el.scrollIntoView({ block: 'center' });
    await sleep(400);
    const sw = el.swiper;
    const snap = () =>
      sw
        ? `${sw.realIndex}|${Math.round(sw.translate)}`
        : [...el.querySelectorAll('[class*="active"], [aria-current="true"]')].slice(0, 6).map((s) => s.className).join(',') +
          '|' +
          [...el.querySelectorAll('*')].slice(0, 40).map((c) => c.style.transform).join('');
    const info = { lib: sw ? 'swiper' : el.className.toString().split(' ')[0] || el.tagName.toLowerCase() };
    if (sw) {
      info.locked = !!sw.isLocked;
      info.autoplay = !!sw.autoplay?.running;
    }
    if (!sw || info.autoplay) {
      const delay = sw?.params?.autoplay?.delay;
      const s0 = snap();
      await sleep(delay ? Math.min(delay + 900, 9000) : (opts.autoplayWait ?? 6000));
      info.movesByItself = snap() !== s0;
    }
    const scope = el.closest('section') || el.parentElement || el;
    const next = [...scope.querySelectorAll('.swiper-button-next, .slick-next, .splide__arrow--next, .glide__arrow--right, .owl-next, .flickity-prev-next-button.next, [class*="__next"], [class*="-next"], [aria-label*="next" i], [aria-label*="weiter" i], [aria-label*="nächst" i]')].find(
      (b) => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true',
    );
    const s1 = snap();
    if (next) {
      next.click();
      await sleep(1000);
      info.nextControlMoves = snap() !== s1;
    } else if (sw && !sw.isLocked) {
      sw.slideNext();
      await sleep(1000);
      info.nextApiMoves = snap() !== s1;
    }
    r.sliders.push(info);
  }

  // Video.
  const video = [...document.querySelectorAll('video')].find(visible);
  if (video) {
    video.scrollIntoView({ block: 'center' });
    await sleep(600);
    try {
      video.muted = true;
      await Promise.race([video.play(), sleep(4000)]);
      await sleep(1200);
      r.video = { plays: video.currentTime > 0 };
      video.pause();
    } catch (e) {
      r.video = { plays: false, error: String(e && e.name ? e.name : e) };
    }
  }

  // Mobile menu.
  if (opts.mobile) {
    window.scrollTo(0, 0);
    await sleep(300);
    const toggler = [...document.querySelectorAll('.navbar-toggler, [data-bs-toggle="offcanvas"], button[class*="burger"], button[class*="hamburger"], [class*="burger"][role="button"], button[aria-label*="menu" i], button[aria-label*="menü" i], header button[aria-controls][aria-expanded]')].find(visible);
    if (toggler) {
      const target = panelOf(toggler) || document.querySelector('nav');
      const links = () =>
        target
          ? [...target.querySelectorAll('a')].filter((a) => a.getClientRects().length && a.getBoundingClientRect().height > 0 && getComputedStyle(a).visibility !== 'hidden').length
          : 0;
      const before = links();
      toggler.click();
      await sleep(900);
      const opened = links();
      r.menu = { opens: opened > before || toggler.getAttribute('aria-expanded') === 'true', visibleLinks: opened };
      toggler.click();
      await sleep(900);
      r.menu.closes = links() <= before || toggler.getAttribute('aria-expanded') === 'false';
    } else {
      r.menu = { toggler: false };
    }
  }

  r.horizontalOverflow = document.documentElement.scrollWidth > innerWidth + 1;
  return r;
}
