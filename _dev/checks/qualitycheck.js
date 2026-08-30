/* Загальна перевірка коректності: розмітка, посилання, доступність,
   фокус, стани без JS і з reduced-motion. */
const { launch } = require('./_browser');
const URL = 'http://localhost:8899/index.html';
(async () => {
  const b = await launch();
  const bad = [];
  const say = (ok, t) => console.log((ok ? '✓ ' : '✗ ') + t);

  // ---------- 1. Мережа ----------
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    p.on('pageerror', e => errs.push('JS-помилка: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('консоль: ' + m.text()); });
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { const s=innerHeight*.7;
      for (let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,120));} });
    await p.waitForTimeout(2500);
    say(!errs.length, 'мережа й консоль: ' + (errs.length ? errs.join(' | ') : 'чисто'));
    if (errs.length) bad.push(...errs);
    await p.close();
  }

  // ---------- 2. Розмітка й доступність ----------
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(URL, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => {
      const o = {};
      // дублікати id
      const ids = {}, dup = [];
      document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id]||0)+1; });
      for (const k in ids) if (ids[k] > 1) dup.push(k + '×' + ids[k]);
      o.dupIds = dup;
      // биті внутрішні посилання
      o.deadAnchors = [...document.querySelectorAll('a[href^="#"]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h !== '#' && !document.querySelector(h.replace(/^#/, '#')));
      // порядок заголовків
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter(h => getComputedStyle(h).display !== 'none');
      o.h1count = hs.filter(h => h.tagName === 'H1').length;
      const jumps = [];
      let prev = 0;
      hs.forEach(h => { const l = +h.tagName[1];
        if (prev && l > prev + 1) jumps.push(prev + '→' + l + ' «' + h.textContent.trim().slice(0,28) + '»');
        prev = l; });
      o.headingJumps = jumps;
      // alt
      o.noAlt = [...document.querySelectorAll('img')].filter(i => i.getAttribute('alt') === null)
        .map(i => i.getAttribute('src'));
      o.emptyAlt = [...document.querySelectorAll('img')].filter(i => (i.getAttribute('alt')||'').trim() === '')
        .map(i => i.getAttribute('src'));
      // посилання без тексту
      o.namelessLinks = [...document.querySelectorAll('a[href], button')].filter(a => {
        const t = (a.textContent||'').trim() || a.getAttribute('aria-label') || a.getAttribute('title');
        return !t;
      }).map(a => a.outerHTML.slice(0, 70));
      // зовнішні посилання без rel
      o.extNoRel = [...document.querySelectorAll('a[target="_blank"]')]
        .filter(a => !(a.rel||'').includes('noopener')).map(a => a.href);
      // мова, заголовок, опис
      o.lang = document.documentElement.lang;
      o.title = document.title;
      o.desc = (document.querySelector('meta[name="description"]')||{}).content;
      o.viewport = (document.querySelector('meta[name="viewport"]')||{}).content;
      // aria
      o.ariaBad = [...document.querySelectorAll('[aria-labelledby]')]
        .filter(e => !document.getElementById(e.getAttribute('aria-labelledby')))
        .map(e => e.getAttribute('aria-labelledby'));
      // мітки для полів
      o.inputsNoLabel = [...document.querySelectorAll('input,select,textarea')].filter(i =>
        !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') &&
        !(i.id && document.querySelector('label[for="'+i.id+'"]'))).map(i=>i.outerHTML.slice(0,70));
      // структурована розмітка
      try { o.jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(s => { JSON.parse(s.textContent); return 'ok'; }); }
      catch (e) { o.jsonld = ['ПОМИЛКА: ' + e.message]; }
      return o;
    });
    say(!r.dupIds.length,        'унікальні id: ' + (r.dupIds.join(', ') || 'так'));
    say(!r.deadAnchors.length,   'внутрішні якорі ведуть кудись: ' + (r.deadAnchors.join(', ') || 'так'));
    say(r.h1count === 1,         'рівно один <h1>: ' + r.h1count);
    say(!r.headingJumps.length,  'порядок заголовків без стрибків: ' + (r.headingJumps.join('; ') || 'так'));
    say(!r.noAlt.length,         'усі <img> мають alt: ' + (r.noAlt.join(', ') || 'так'));
    say(!r.namelessLinks.length, 'усі посилання й кнопки мають назву: ' + (r.namelessLinks.join(' | ') || 'так'));
    say(!r.extNoRel.length,      'зовнішні посилання з rel=noopener: ' + (r.extNoRel.join(', ') || 'так'));
    say(!!r.lang,                'lang: ' + r.lang);
    say(!!r.title && r.title.length < 65, 'title (' + (r.title||'').length + '): ' + r.title);
    say(!!r.desc && r.desc.length < 165,  'description (' + (r.desc||'').length + ')');
    say(/width=device-width/.test(r.viewport||''), 'viewport: ' + r.viewport);
    say(!r.ariaBad.length,       'aria-labelledby вказує на наявні id: ' + (r.ariaBad.join(', ') || 'так'));
    say(!r.inputsNoLabel.length, 'поля мають мітки: ' + (r.inputsNoLabel.join(' | ') || 'так'));
    say(r.jsonld.every(x=>x==='ok'), 'JSON-LD розбирається: ' + r.jsonld.join(', '));
    ['dupIds','deadAnchors','headingJumps','noAlt','namelessLinks','extNoRel','ariaBad','inputsNoLabel']
      .forEach(k => { if (r[k] && r[k].length) bad.push(k + ': ' + r[k].join(', ')); });
    await p.close();
  }

  // ---------- 3. Фокус ----------
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.evaluate(() => { try { sessionStorage.setItem('lz-entered','1'); } catch(e){} });
    await p.reload({ waitUntil: 'networkidle' });
    const clipped = [];
    for (let i = 0; i < 70; i++) {
      await p.keyboard.press('Tab');
      await p.waitForTimeout(240);   /* .skip їде вниз 200мс — читаємо після переходу */
      const r = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const rc = el.getBoundingClientRect();
        const off = parseFloat(s.outlineOffset) || 0;
        const ow = parseFloat(s.outlineWidth) || 0;
        // чи не обрізає обвідку якийсь предок із overflow:clip
        let cut = false;
        for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
          const ns = getComputedStyle(n);
          if (!['hidden','clip'].includes(ns.overflowX) && !['hidden','clip'].includes(ns.overflowY)) continue;
          const q = n.getBoundingClientRect();
          if (rc.left - off - ow < q.left - 0.5 || rc.right + off + ow > q.right + 0.5 ||
              rc.top - off - ow < q.top - 0.5 || rc.bottom + off + ow > q.bottom + 0.5) { cut = true; break; }
        }
        const inView = rc.top >= -1 && rc.bottom <= innerHeight + 1;
        const running = el.getAnimations().some(a => a.playState === 'running');
        return { running, name: el.tagName + '.' + (el.className||'').toString().split(' ')[0] +
          ' «' + (el.textContent||'').trim().slice(0,24) + '»',
          outline: s.outlineStyle + ' ' + s.outlineWidth, cut, inView };
      });
      if (!r) continue;
      if (r.outline.startsWith('none')) clipped.push('без обвідки [' + i + ']: ' + r.name);
      if (r.running) continue;             /* елемент ще їде — вимір нічого не означає */
      if (r.cut) clipped.push('обвідку обрізає предок [' + i + ']: ' + r.name);
      if (!r.inView) clipped.push('фокус поза екраном [' + i + ']: ' + r.name);
    }
    say(!clipped.length, 'фокус із клавіатури: ' + ([...new Set(clipped)].slice(0,6).join(' | ') || 'усе видно'));
    if (clipped.length) bad.push(...new Set(clipped));
    await p.close();
  }

  // ---------- 4. Без JS ----------
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    await p.goto(URL, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => ({
      chars: document.body.innerText.replace(/\s+/g,' ').trim().length,
      hidden: [...document.querySelectorAll('.reveal,.words,.arch-open,.draw')]
        .filter(n => parseFloat(getComputedStyle(n).opacity) < 0.9).length,
      hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      loader: getComputedStyle(document.querySelector('#loader')).display,
      quizOpen: document.querySelectorAll('.quiz__item[open]').length,
    }));
    say(r.chars > 4000 && !r.hidden && !r.hscroll,
      'без JS: символів ' + r.chars + ', прихованих ' + r.hidden + ', гориз. скрол ' + r.hscroll +
      ', прелоадер ' + r.loader + ', відкритих пунктів квізу ' + r.quizOpen);
    if (r.hidden || r.hscroll) bad.push('без JS: приховано ' + r.hidden);
    await p.close();
  }

  // ---------- 5. Reduced motion ----------
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const s = await p.$$('.quiz__item summary');
    if (s[1]) { await s[1].click(); await p.waitForTimeout(400); }
    const r = await p.evaluate(() => ({
      hidden: [...document.querySelectorAll('.reveal,.words,.arch-open,.draw')]
        .filter(n => parseFloat(getComputedStyle(n).opacity) < 0.9).length,
      anims: document.getAnimations().filter(a => a.playState === 'running').length,
      quizOpen: document.querySelectorAll('.quiz__item[open]').length,
      quizH: (() => { const el = document.querySelectorAll('.quiz__item')[1].querySelector('.quiz__body');
        return Math.round(el.getBoundingClientRect().height); })(),
    }));
    say(!r.hidden && r.quizOpen === 1 && r.quizH > 40,
      'reduced-motion: прихованих ' + r.hidden + ', активних анімацій ' + r.anims +
      ', відкрито пунктів ' + r.quizOpen + ', висота тіла ' + r.quizH);
    if (r.hidden || r.quizOpen !== 1 || r.quizH < 40) bad.push('reduced-motion збій');
    await p.close();
  }

  console.log('\nПРОБЛЕМ: ' + bad.length);
  await b.close();
})();
