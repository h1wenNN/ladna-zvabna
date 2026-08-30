/* Типографіка в РЕНДЕРІ, а не в коді: шукаємо рядки, на яких лишилося
   одне коротке слово (висяча частка), і слова, розрізані переносом. */
const { chromium } = require('/home/claude/lz/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;
  for (const w of [320, 360, 375, 414, 768, 1024, 1280, 1440, 1920]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => { try { sessionStorage.setItem('lz-entered','1'); } catch(e){} });
    await p.reload({ waitUntil: 'networkidle' });
    await p.evaluate(async () => { const s=innerHeight*.7;
      for (let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} });
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent.replace(/\s+/g, ' ').trim();
        if (t.length < 12) continue;
        const par = n.parentElement;
        if (!par || par.closest('script, style, .sr-only, #loader, .lz-sprite')) continue;
        const st = getComputedStyle(par);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const rng = document.createRange();
        rng.selectNodeContents(n);
        const rects = [...rng.getClientRects()].filter(x => x.width > 0.5 && x.height > 0.5);
        if (rects.length < 2) continue;
        // останній рядок
        const last = rects[rects.length - 1];
        const prev = rects[rects.length - 2];
        // скільки символів на останньому рядку — оцінюємо через ширину
        const words = t.split(' ');
        const lastWord = words[words.length - 1].replace(/[.,;:!?»)]+$/, '');
        if (last.width < prev.width * 0.16 && lastWord.length <= 3)
          out.push('висяче «' + lastWord + '» у: «' + t.slice(0, 46) + '…»');
      }
      return [...new Set(out)];
    });
    bad += r.length;
    console.log((r.length ? '✗ ' : '✓ ') + w + 'px — ' + (r.length || 'чисто'));
    r.slice(0, 5).forEach(x => console.log('     ' + x));
    await p.close();
  }
  console.log('\nПРОБЛЕМ: ' + bad);
  await b.close();
})();
