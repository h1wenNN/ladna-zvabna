/* Розтушовані смуги на краях темних сцен — це білі градієнти ПОВЕРХ
   вмісту. Перевіряємо, що вони не накривають жодного рядка тексту. */
const { chromium } = require('/home/claude/lz/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;
  for (const [w,h] of [[375,500],[375,667],[390,844],[740,360],[1024,500],[1280,600],[1440,900],[1920,1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => { try { sessionStorage.setItem('lz-entered','1'); } catch(e){} });
    await p.reload({ waitUntil: 'networkidle' });
    await p.evaluate(async () => { const s=innerHeight*.6;
      for (let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,70));} scrollTo(0,0); });
    await p.waitForTimeout(900);
    const r = await p.evaluate(() => {
      const hits = [];
      for (const sec of document.querySelectorAll('.story, .parable')) {
        const sr = sec.getBoundingClientRect();
        for (const which of ['::before','::after']) {
          const cs = getComputedStyle(sec, which);
          if (cs.content === 'none' || cs.display === 'none') continue;
          const bh = parseFloat(cs.height) || 0;
          if (!bh) continue;
          const top = which === '::before' ? sr.top : sr.bottom - bh;
          const bot = top + bh;
          for (const el of sec.querySelectorAll('h1,h2,h3,p,li,span,dt,dd,blockquote')) {
            if (!el.textContent.trim()) continue;
            const s2 = getComputedStyle(el);
            if (s2.display === 'none' || s2.visibility === 'hidden') continue;
            const r2 = el.getBoundingClientRect();
            if (r2.height < 2) continue;
            const ov = Math.min(bot, r2.bottom) - Math.max(top, r2.top);
            if (ov > 2) hits.push(which + ' накриває ' + Math.round(ov) + 'px: «' +
              el.textContent.replace(/\s+/g,' ').trim().slice(0,34) + '»');
          }
        }
      }
      return [...new Set(hits)];
    });
    bad += r.length;
    console.log((r.length?'✗ ':'✓ ') + w + '×' + h + (r.length ? ' — ' + r.length : ' — чисто'));
    r.slice(0,4).forEach(x => console.log('     ' + x));
    await p.close();
  }
  console.log('\nПРОБЛЕМ: ' + bad);
  await b.close();
})();
