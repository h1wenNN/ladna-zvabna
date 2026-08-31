/* Перевірка розкладки у СТАНАХ, яких статична перевірка не бачить:
   відкрите меню, розкриті пункти квізу, повзунок «до/після» в крайніх
   положеннях, фокус із клавіатури, липка панель над футером,
   а також короткі екрани (телефон у горизонталі) і збільшення шрифту. */
const { launch } = require('./_browser');
const URL = 'http://localhost:8899/index.html';

const VIEWS = [
  [320, 568, 'iPhone SE'], [375, 667, 'телефон'], [390, 844, 'телефон високий'],
  [740, 360, 'телефон горизонтально'], [768, 1024, 'iPad портрет'],
  [1024, 768, 'iPad горизонтально'], [1024, 500, 'ноутбук низький'],
  [1280, 720, 'ноутбук 720'], [1440, 900, 'десктоп'], [1920, 1080, 'FullHD'],
];

const STATES = [
  ['звичайний', async () => {}],
  ['меню відкрито', async p => { const b = await p.$('.hdr__menu'); if (b) { await b.click(); await p.waitForTimeout(600); } }],
  ['усі пункти квізу по черзі', async p => {
      const s = await p.$$('.quiz__item summary');
      for (const x of s) { await x.click(); await p.waitForTimeout(420); }
    }],
  ['повзунок до/після = 0%', async p => p.evaluate(() => {
      const r = document.querySelector('.cmp__range'); if (r) { r.value = 0; r.dispatchEvent(new Event('input', {bubbles:true})); } })],
  ['повзунок до/після = 100%', async p => p.evaluate(() => {
      const r = document.querySelector('.cmp__range'); if (r) { r.value = 100; r.dispatchEvent(new Event('input', {bubbles:true})); } })],
  ['шрифт +30% (зум тексту)', async p => p.evaluate(() => {
      document.documentElement.style.fontSize = '130%'; })],
];

(async () => {
  const b = await launch();
  let total = 0;
  for (const [w, h, vname] of VIEWS) {
    for (const [sname, act] of STATES) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.evaluate(() => { try { sessionStorage.setItem('lz-entered','1'); } catch(e){} });
      await p.reload({ waitUntil: 'networkidle' });
      await p.evaluate(async () => { const s = innerHeight*.6;
        for (let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,70));} scrollTo(0,0); });
      await p.waitForTimeout(900);
      try { await act(p); } catch (e) {}
      await p.waitForTimeout(900);
      /* Чекаємо, поки НЕ ЛИШИТЬСЯ жодного активного переходу: інакше
         вимірюємо проміжний кадр анімації й ловимо привидів. */
      await p.evaluate(async () => {
        /* Чекаємо, поки завершаться переходи саме на елементах, які ми
           щойно чіпали (акордеон, поява блоків). Нескінченні анімації
           світлових плям ігноруємо — вони не закінчаться ніколи. */
        const watched = () => [...document.querySelectorAll('.quiz__body, .reveal, .arch-open')]
          .flatMap(e => e.getAnimations())
          .filter(a => a.playState === 'running');
        for (let i = 0; i < 200 && watched().length; i++) {
          await new Promise(r => requestAnimationFrame(r));
        }
        for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
      });

      const res = await p.evaluate(() => {
        const DECOR = '.glow, .story__light, .parable__light, .thread, .lz-sprite, .ph';
        const OVERLAY = '.hdr, .menu, .loader, .callbar, .skip, .cmp, .hero__frame, .hero__cap';
        const bad = [];
        const nm = el => el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ').slice(0,2).join('.')
          +' «'+(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,28)+'»';
        function visRect(el) {
          const st = getComputedStyle(el);
          /* Вміст закритого <details> не показується взагалі — незалежно від
             того, який кадр анімації лишився в стилях. */
          if (el.closest('details:not([open])') && !el.matches('summary') && !el.closest('summary')) return null;
          if (st.display==='none'||st.visibility==='hidden'||parseFloat(st.opacity)<0.05) return null;
          let r = el.getBoundingClientRect();
          let x1=r.left,y1=r.top,x2=r.right,y2=r.bottom;
          for (let n=el.parentElement;n&&n!==document.documentElement;n=n.parentElement){
            const s=getComputedStyle(n);
            if (s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)<0.05) return null;
            const cx=['hidden','clip','auto','scroll'].includes(s.overflowX);
            const cy=['hidden','clip','auto','scroll'].includes(s.overflowY);
            if(!cx&&!cy) continue;
            const q=n.getBoundingClientRect();
            if(cx){x1=Math.max(x1,q.left);x2=Math.min(x2,q.right);}
            if(cy){y1=Math.max(y1,q.top);y2=Math.min(y2,q.bottom);}
            if(x2-x1<1||y2-y1<1) return null;
          }
          if (x2-x1<2||y2-y1<2) return null;
          return {x1:x1+scrollX,y1:y1+scrollY,x2:x2+scrollX,y2:y2+scrollY};
        }
        // накладання текстових листків
        const own = el => [...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);
        const cand=[...document.querySelectorAll('main *, footer *, .menu *')].filter(el=>{
          if(['SCRIPT','STYLE','SVG','PATH','SYMBOL','USE','SOURCE','BR','DEFS','TITLE'].includes(el.tagName))return false;
          if(el.closest(DECOR))return false;
          if(el.closest(OVERLAY) && !el.closest('.menu'))return false;
          if(getComputedStyle(el).position==='fixed'&&!el.closest('.menu'))return false;
          return own(el)||['IMG','VIDEO','PICTURE'].includes(el.tagName);
        });
        const boxes=[];
        for(const el of cand){const r=visRect(el); if(r) boxes.push({el,...r});}
        const seen=new Set();
        for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
          const A=boxes[i],B=boxes[j];
          if(A.el.contains(B.el)||B.el.contains(A.el))continue;
          if(A.el.closest('.menu')!==B.el.closest('.menu'))continue; // меню — оверлей
          const ox=Math.min(A.x2,B.x2)-Math.max(A.x1,B.x1);
          const oy=Math.min(A.y2,B.y2)-Math.max(A.y1,B.y1);
          if(ox>2&&oy>2){const k=nm(A.el)+'|'+nm(B.el); if(seen.has(k))continue; seen.add(k);
            bad.push('накладання '+Math.round(ox)+'×'+Math.round(oy)+': '+nm(A.el)+' ✕ '+nm(B.el));}
        }
        // горизонтальний скрол
        if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
          bad.push('горизонтальний скрол: '+document.documentElement.scrollWidth+'>'+document.documentElement.clientWidth);
        // текст, що не вміщається у власну коробку
        for (const el of document.querySelectorAll('main *, footer *, .menu *, header *')) {
          const st=getComputedStyle(el);
          if (st.overflow==='visible') continue;
          if (el.closest('.quiz__body')||el.closest(DECOR)||el.closest('.arch')||el.closest('.hero__frame')) continue;
          /* декоративні плями навмисно більші за секцію — саме для цього
             там overflow:clip. Вони не є «обрізаним текстом». */
          if (el.querySelector(DECOR)) continue;
          if (!el.textContent.trim()) continue;
          if (!visRect(el)) continue;
          if (el.scrollWidth>el.clientWidth+2 && el.clientWidth>0)
            bad.push('текст ширший за коробку: '+nm(el)+' '+el.scrollWidth+'>'+el.clientWidth);
          if (el.scrollHeight>el.clientHeight+2 && el.clientHeight>0)
            bad.push('текст вищий за коробку: '+nm(el)+' '+el.scrollHeight+'>'+el.clientHeight);
        }
        // липка панель не має закривати останній контент
        const cb=document.querySelector('.callbar');
        if (cb && getComputedStyle(cb).display!=='none') {
          const cr=cb.getBoundingClientRect();
          scrollTo(0, document.body.scrollHeight);
          const f=document.querySelector('.foot__legal, .foot');
          if (f) { const fr=f.getBoundingClientRect();
            if (fr.bottom > cr.top + 2 && fr.top < cr.bottom) bad.push('липка панель закриває низ футера'); }
        }
        return bad;
      });

      if (res.length) {
        total += res.length;
        console.log('\n✗ ' + vname + ' ' + w + '×' + h + ' · ' + sname + ' → ' + res.length);
        [...new Set(res)].slice(0, 8).forEach(x => console.log('     ' + x));
      }
      await p.close();
    }
    console.log('— ' + vname + ' ' + w + '×' + h + ' пройдено');
  }
  console.log('\nРАЗОМ: ' + total);
  await b.close();
})();
