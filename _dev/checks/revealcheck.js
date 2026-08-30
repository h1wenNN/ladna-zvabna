/* Перевірка: чи лишається щось невидимим при різких переходах.
   Швидкий скрол, стрибок за якорем, Ctrl+End, відновлення позиції. */
const { launch } = require('./_browser');
const URL = 'http://localhost:8899/index.html';
const CASES = [
  ['стрибок одразу в самий низ',    async p => p.evaluate(() => scrollTo(0, document.body.scrollHeight))],
  ['стрибок за якорем #book',       async p => p.evaluate(() => location.hash = '#book')],
  ['стрибок за якорем #price',      async p => p.evaluate(() => location.hash = '#price')],
  ['стрибок за якорем #story',      async p => p.evaluate(() => location.hash = '#story')],
  ['дуже швидкий скрол (крок 3 екрани)', async p => p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 3) {
        scrollTo(0, y); await new Promise(r => requestAnimationFrame(r));
      }})],
  ['низ -> верх -> низ', async p => p.evaluate(async () => {
      scrollTo(0, document.body.scrollHeight); await new Promise(r=>setTimeout(r,80));
      scrollTo(0, 0); await new Promise(r=>setTimeout(r,80));
      scrollTo(0, document.body.scrollHeight);
    })],
];
(async () => {
  const b = await launch();
  let bad = 0;
  for (const w of [375, 768, 1440]) {
    for (const [label, act] of CASES) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.evaluate(() => { try { sessionStorage.setItem('lz-entered','1'); } catch(e){} });
      await p.reload({ waitUntil: 'networkidle' });
      await act(p);
      await p.waitForTimeout(2200);
      /* Рахуємо помилкою лише те, що людина ВЖЕ БАЧИТЬ або вже проминула.
         Блоки нижче за екран мають право чекати свого скролу. */
      const hidden = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('.reveal, .words, .arch-open, .draw').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          if (r.top > innerHeight - 40) return;          // ще нижче за екран
          if (el.classList.contains('is-in')) return;
          const n = el.tagName.toLowerCase() + '.' + (el.className||'').split(' ').slice(0,2).join('.');
          out.push(n + ' «' + (el.textContent||'').replace(/\s+/g,' ').trim().slice(0,30) + '» y=' + Math.round(r.top));
        });
        return out;
      });
      if (hidden.length) { bad += hidden.length;
        console.log('✗ ' + w + 'px · ' + label + ' → невидимих ' + hidden.length);
        [...new Set(hidden)].slice(0,6).forEach(x => console.log('     ' + x));
      } else console.log('✓ ' + w + 'px · ' + label);
      await p.close();
    }
  }
  console.log('\nневидимих блоків усього: ' + bad);
  await b.close();
})();
