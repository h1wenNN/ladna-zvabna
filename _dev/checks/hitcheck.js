/* Чи справді палець потрапить у лінк: перевіряємо реальні зони натискання
   через elementFromPoint і шукаємо зони, що перекривають одна одну. */
const { chromium } = require('/home/claude/lz/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;
  for (const w of [320, 375, 414, 768, 834]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 }, hasTouch: true, isMobile: true });
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => { try { sessionStorage.setItem('lz-entered','1'); } catch(e){} });
    await p.reload({ waitUntil: 'networkidle' });
    await p.evaluate(async () => { const s=innerHeight*.6;
      for (let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,80));} scrollTo(0,0); });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const small = [], stolen = [];
      const nm = el => el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ').slice(0,2).join('.')
        +' «'+(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,26)+'»';
      document.querySelectorAll('a[href], button, summary, input').forEach(el => {
        const st = getComputedStyle(el);
        if (st.display==='none'||st.visibility==='hidden'||parseFloat(st.opacity)<0.05) return;
        const r0 = el.getBoundingClientRect();
        if (r0.width < 2 || r0.height < 2) return;
        // реальна зона: об'єднання самого елемента і його ::before
        const before = getComputedStyle(el, '::before');
        let h = r0.height;
        if (before.content !== 'none' && before.position === 'absolute') {
          const bh = parseFloat(before.height); if (bh) h = Math.max(h, bh);
        }
        if (h < 44 || r0.width < 24) small.push(nm(el)+' '+Math.round(r0.width)+'×'+Math.round(h));
        // чи не перекриває цю точку щось інше
        el.scrollIntoView({block:'center'});
        const q = el.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.min(innerWidth-2, q.left + q.width/2), q.top + q.height/2);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) stolen.push(nm(el)+' → перехоплює '+nm(hit));
      });
      return { small, stolen };
    });
    const n = r.small.length + r.stolen.length;
    bad += n;
    console.log((n?'✗':'✓')+' '+w+'px — малих зон '+r.small.length+', перехоплених '+r.stolen.length);
    [...new Set(r.small)].slice(0,8).forEach(x=>console.log('    мала: '+x));
    [...new Set(r.stolen)].slice(0,8).forEach(x=>console.log('    перехоплення: '+x));
    await p.close();
  }
  console.log('\nусього: '+bad);
  await b.close();
})();
