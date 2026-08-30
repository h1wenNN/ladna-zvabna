/* Поведінка мобільного меню: відкрити, закрити, фокус-трап, Esc,
   перехід за пунктом, повторне відкриття одразу після закриття. */
const { launch } = require('./_browser');
(async () => {
  const b = await launch();
  const bad = [];
  const say = (ok, t) => { console.log((ok?'✓ ':'✗ ')+t); if (!ok) bad.push(t); };
  const open = async p => { await p.click('.hdr__menu'); await p.waitForTimeout(700); };

  const mk = async () => {
    const p = await b.newPage({ viewport: { width: 375, height: 667 } });
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => { try { sessionStorage.setItem('lz-entered','1'); } catch(e){} });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    return p;
  };

  // 1. кнопка закриття видима й клікабельна
  { const p = await mk(); await open(p);
    const r = await p.evaluate(() => {
      const bt = document.querySelector('.hdr__menu');
      const q = bt.getBoundingClientRect();
      const hit = document.elementFromPoint(q.left + q.width/2, q.top + q.height/2);
      return { txt: bt.textContent.trim(), reachable: bt.contains(hit) || hit === bt,
        logo: (() => { const l = document.querySelector('.hdr__logo'); const lr = l.getBoundingClientRect();
          const h = document.elementFromPoint(lr.left + 10, lr.top + lr.height/2); return !!(h && l.contains(h)); })() };
    });
    say(r.txt === 'Закрити' && r.reachable, 'кнопка «Закрити» видима й клікабельна поверх меню');
    say(r.logo, 'логотип видно поверх меню');
    await p.click('.hdr__menu'); await p.waitForTimeout(700);
    say(await p.evaluate(() => document.getElementById('menu').hidden), 'клік по «Закрити» ховає меню');
    await p.close(); }

  // 2. Esc
  { const p = await mk(); await open(p);
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
    say(await p.evaluate(() => document.getElementById('menu').hidden), 'Esc закриває меню');
    say(await p.evaluate(() => document.activeElement.className.indexOf('hdr__menu') > -1),
      'після Esc фокус повертається на кнопку');
    await p.close(); }

  // 3. фокус-трап доходить до кнопки закриття
  { const p = await mk(); await open(p);
    const names = [];
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press('Tab'); await p.waitForTimeout(90);
      names.push(await p.evaluate(() => (document.activeElement.textContent||'').trim().slice(0,18)));
    }
    say(names.some(n => n === 'Закрити'), 'фокус-трап включає кнопку закриття: ' + names.join(' → ').slice(0,120));
    say(names.every(n => n !== ''), 'фокус не виходить із меню');
    await p.close(); }

  // 4. перехід за пунктом закриває меню й веде куди треба
  { const p = await mk(); await open(p);
    await p.click('.menu__nav a[href="#care"]'); await p.waitForTimeout(1400);
    const r = await p.evaluate(() => {
      const s = document.getElementById('care').getBoundingClientRect();
      const h = document.querySelector('.hdr').getBoundingClientRect();
      return { hidden: document.getElementById('menu').hidden, top: Math.round(s.top), hdrB: Math.round(h.bottom),
        bodyOv: document.body.style.overflow };
    });
    say(r.hidden, 'клік по пункту закриває меню');
    say(r.bodyOv === '', 'прокрутку сторінки розблоковано');
    say(r.top >= r.hdrB - 2, 'секція не залізла під шапку (верх ' + r.top + ', шапка до ' + r.hdrB + ')');
    await p.close(); }

  // 5. швидке закрити→відкрити
  { const p = await mk(); await open(p);
    await p.click('.hdr__menu'); await p.waitForTimeout(120);
    await p.click('.hdr__menu'); await p.waitForTimeout(900);
    const r = await p.evaluate(() => ({ hidden: document.getElementById('menu').hidden,
      op: getComputedStyle(document.getElementById('menu')).opacity }));
    say(!r.hidden && +r.op > 0.9, 'швидке закрити→відкрити лишає меню видимим (hidden=' + r.hidden + ', opacity=' + r.op + ')');
    await p.close(); }

  console.log('\nПРОБЛЕМ: ' + bad.length);
  await b.close();
})();
