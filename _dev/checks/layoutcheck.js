/* ==========================================================================
   ЛАДНА-ЗВАБНА · layoutcheck.js
   Шукає накладання елементів, обрізаний вміст, виходи за межі вікна
   і дрібні цілі дотику — на всіх ширинах.
   Запуск: node layoutcheck.js [url]

   Ключова відмінність від наївної перевірки: елемент вважається видимим
   лише в межах прямокутника, який лишили від нього ВСІ предки з
   overflow:hidden/clip. Інакше згорнутий акордеон і декоративні плями
   дають десятки хибних спрацювань.
   ========================================================================== */
const { chromium } = require('/home/claude/lz/node_modules/playwright');
const URL = process.argv[2] || 'http://localhost:8899/index.html';
const WIDTHS = process.env.W ? process.env.W.split(',').map(Number)
  : [320, 360, 375, 414, 480, 600, 768, 834, 1024, 1180, 1280, 1366, 1440, 1600, 1920, 2560];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let total = 0;

  for (const w of WIDTHS) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.evaluate(() => { try { sessionStorage.setItem('lz-entered', '1'); } catch (e) {} });
    await p.reload({ waitUntil: 'networkidle' });
    await p.evaluate(async () => {
      const s = innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += s) {
        scrollTo(0, y); await new Promise(r => setTimeout(r, 90));
      }
      scrollTo(0, 0);
    });
    await p.waitForTimeout(1400);

    const res = await p.evaluate(() => {
      const DECOR = '.glow, .story__light, .parable__light, .thread, .lz-sprite, .ph';
      const OVERLAY = '.hdr, .menu, .loader, .callbar, .skip, .cmp, .hero__frame, .hero__cap';
      const out = { overlap: [], clip: [], outside: [], tiny: [], misc: [] };

      const name = el => {
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.className && typeof el.className === 'string')
          s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34);
        return s + (t ? ' «' + t + '»' : '');
      };

      // Видимий прямокутник у координатах документа з урахуванням усіх
      // предків, що обрізають. null = елемента насправді не видно.
      function visRect(el) {
        const st = getComputedStyle(el);
        /* Вміст закритого <details> не показується взагалі — незалежно від
           того, який кадр анімації лишився в стилях. */
        if (el.closest('details:not([open])') && !el.matches('summary') && !el.closest('summary')) return null;
        if (st.display === 'none' || st.visibility === 'hidden') return null;
        if (parseFloat(st.opacity) < 0.05) return null;
        let r = el.getBoundingClientRect();
        let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
        for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (parseFloat(s.opacity) < 0.05) return null;
          if (s.display === 'none' || s.visibility === 'hidden') return null;
          const cx = ['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowX);
          const cy = ['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowY);
          if (!cx && !cy) continue;
          const q = n.getBoundingClientRect();
          if (cx) { x1 = Math.max(x1, q.left); x2 = Math.min(x2, q.right); }
          if (cy) { y1 = Math.max(y1, q.top);  y2 = Math.min(y2, q.bottom); }
          if (x2 - x1 < 1 || y2 - y1 < 1) return null;
        }
        if (x2 - x1 < 2 || y2 - y1 < 2) return null;
        return { x1: x1 + scrollX, y1: y1 + scrollY, x2: x2 + scrollX, y2: y2 + scrollY };
      }

      // ---- 1. НАКЛАДАННЯ ----
      const hasOwnText = el => [...el.childNodes].some(n =>
        n.nodeType === 3 && n.textContent.trim().length > 1);
      const cand = [...document.querySelectorAll('main *, footer *')].filter(el => {
        if (['SCRIPT','STYLE','SVG','PATH','SYMBOL','USE','SOURCE','BR','DEFS','TITLE'].includes(el.tagName)) return false;
        if (el.closest(DECOR) || el.closest(OVERLAY)) return false;
        const st = getComputedStyle(el);
        if (st.position === 'fixed') return false;
        return hasOwnText(el) || ['IMG','VIDEO','PICTURE'].includes(el.tagName);
      });
      const boxes = [];
      for (const el of cand) { const r = visRect(el); if (r) boxes.push({ el, ...r }); }
      const seen = new Set();
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        const ox = Math.min(A.x2, B.x2) - Math.max(A.x1, B.x1);
        const oy = Math.min(A.y2, B.y2) - Math.max(A.y1, B.y1);
        if (ox > 2 && oy > 2) {
          const small = Math.min((A.x2-A.x1)*(A.y2-A.y1), (B.x2-B.x1)*(B.y2-B.y1));
          const k = name(A.el) + '|' + name(B.el);
          if (seen.has(k)) continue; seen.add(k);
          out.overlap.push({ a: name(A.el), b: name(B.el), ox: Math.round(ox), oy: Math.round(oy),
            pct: Math.round(ox * oy / small * 100) });
        }
      }

      // ---- 2. ОБРІЗАНИЙ ВМІСТ (текст і медіа, не декор) ----
      for (const el of document.querySelectorAll('main h1,main h2,main h3,main p,main li,main dd,main dt,main span,main a,main summary,footer *')) {
        if (el.closest(DECOR)) continue;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) continue;
        if (!el.textContent.trim()) continue;
        const full = el.getBoundingClientRect();
        if (full.width < 2 || full.height < 2) continue;
        const v = visRect(el);
        if (!v) {
          // навмисно згорнутий акордеон — не помилка
          if (el.closest('.quiz__body') || el.closest('[hidden]')) continue;
          out.clip.push('повністю приховано: ' + name(el));
          continue;
        }
        const lostW = full.width - (v.x2 - v.x1), lostH = full.height - (v.y2 - v.y1);
        if (el.closest('.quiz__body')) continue;
        if (lostW > 2 || lostH > 2)
          out.clip.push('обрізано на ' + Math.round(lostW) + '×' + Math.round(lostH) + 'px: ' + name(el));
        // текст не вміщається у власну коробку
        if (st.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
          out.clip.push('текст ширший за коробку: ' + name(el) + ' ' + el.scrollWidth + '>' + el.clientWidth);
      }

      // ---- 3. ВИХІД ЗА ВІКНО ----
      for (const el of document.querySelectorAll('main *, footer *, header *')) {
        if (el.closest(DECOR)) continue;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) continue;
        const v = visRect(el); if (!v) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 2 && (r.right > innerWidth + 1 || r.left < -1))
          out.outside.push(name(el) + ' [' + Math.round(r.left) + '…' + Math.round(r.right) + ']');
      }

      // ---- 4. ДРІБНІ ЦІЛІ ДОТИКУ ----
      if (innerWidth <= 834) {
        for (const el of document.querySelectorAll('a[href], button, summary, input, [role="button"]')) {
          const v = visRect(el); if (!v) continue;
          const r = el.getBoundingClientRect();
          /* реальна зона дотику = сам елемент АБО його невидимий ::before */
          let h = r.height, ww = r.width;
          const bf = getComputedStyle(el, '::before');
          if (bf.content !== 'none' && bf.position === 'absolute') {
            const bh = parseFloat(bf.height), bw = parseFloat(bf.width);
            if (bh) h = Math.max(h, bh);
            if (bw) ww = Math.max(ww, bw);
          }
          if (h < 40 || ww < 24)
            out.tiny.push(name(el) + ' ' + Math.round(ww) + '×' + Math.round(h));
        }
      }

      // ---- 5. РІЗНЕ ----
      const seenM = new Set();
      for (const el of document.querySelectorAll('main *, footer *, header *')) {
        const v = visRect(el); if (!v) continue;
        const st = getComputedStyle(el);
        // сироти: один-два символи на власному рядку
        if (['P','H1','H2','H3','LI','DD'].includes(el.tagName)) {
          const t = el.textContent.replace(/\s+/g, ' ').trim();
          const last = t.split(' ').pop();
          if (last && last.length <= 2 && t.split(' ').length > 4 && el.clientHeight > parseFloat(st.lineHeight) * 1.4) {
            const k = 'orphan:' + name(el);
            if (!seenM.has(k)) { seenM.add(k); out.misc.push('можлива висяча коротка частка: ' + name(el)); }
          }
        }
      }
      return out;
    });

    const n = res.overlap.length + res.clip.length + res.outside.length + res.tiny.length + res.misc.length;
    total += n;
    if (n) {
      console.log('\n══ ' + w + 'px — знайдено ' + n);
      if (res.overlap.length) {
        console.log('  НАКЛАДАННЯ:');
        res.overlap.slice(0, 12).forEach(o =>
          console.log('    ' + o.ox + '×' + o.oy + 'px (' + o.pct + '%)  ' + o.a + '  ✕  ' + o.b));
        if (res.overlap.length > 12) console.log('    … ще ' + (res.overlap.length - 12));
      }
      const u = a => [...new Set(a)];
      if (res.clip.length)    { console.log('  ОБРІЗАНО:');    u(res.clip).slice(0,10).forEach(x=>console.log('    '+x)); }
      if (res.outside.length) { console.log('  ЗА ВІКНОМ:');   u(res.outside).slice(0,10).forEach(x=>console.log('    '+x)); }
      if (res.tiny.length)    { console.log('  ДРІБНА ЦІЛЬ:'); u(res.tiny).slice(0,10).forEach(x=>console.log('    '+x)); }
      if (res.misc.length)    { console.log('  РІЗНЕ:');       u(res.misc).slice(0,8).forEach(x=>console.log('    '+x)); }
    } else {
      console.log('══ ' + w + 'px — чисто ✓');
    }
    await p.close();
  }
  console.log('\nРАЗОМ: ' + total);
  await b.close();
})();
