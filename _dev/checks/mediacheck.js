/* Відео, повзунок «до/після», плавний скрол. */
const { launch } = require('./_browser');
(async () => {
  const b = await launch({args: ['--autoplay-policy=no-user-gesture-required'] });
  const bad = []; const say=(ok,t)=>{console.log((ok?'✓ ':'✗ ')+t); if(!ok)bad.push(t);};

  // ---- відео ----
  { const p = await b.newPage({ viewport:{width:1440,height:900} });
    await p.goto('http://localhost:8899/index.html',{waitUntil:'networkidle'});
    await p.evaluate(()=>{try{sessionStorage.setItem('lz-entered','1')}catch(e){}});
    await p.reload({waitUntil:'networkidle'});
    await p.evaluate(async()=>{const s=innerHeight*.5;
      for(let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,220));}});
    await p.waitForTimeout(3500);
    const r = await p.evaluate(()=>[...document.querySelectorAll('video')].map(v=>({
      src: v.currentSrc ? v.currentSrc.split('/').pop() : 'ЛИШЕ ПОСТЕР',
      rate: v.playbackRate, paused: v.paused, ready: v.readyState,
      w: v.videoWidth, h: v.videoHeight, loop: v.loop, muted: v.muted,
      inline: v.hasAttribute('playsinline'), poster: !!v.poster })));
    r.forEach((v,i)=>say(v.src!=='ЛИШЕ ПОСТЕР' && !v.paused && v.ready>=2 && v.muted && v.inline && v.loop,
      'відео '+i+': '+JSON.stringify(v)));
    await p.close(); }

  // ---- відео при економії трафіку / reduced motion ----
  { const p = await b.newPage({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
    await p.goto('http://localhost:8899/index.html',{waitUntil:'networkidle'});
    await p.evaluate(async()=>{const s=innerHeight*.5;
      for(let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,180));}});
    await p.waitForTimeout(2000);
    const n = await p.evaluate(()=>[...document.querySelectorAll('video')].filter(v=>v.currentSrc).length);
    say(n===0, 'при reduced-motion відео не завантажується (завантажено '+n+')');
    await p.close(); }

  // ---- повзунок до/після ----
  { const p = await b.newPage({ viewport:{width:1440,height:900} });
    await p.goto('http://localhost:8899/index.html',{waitUntil:'networkidle'});
    await p.evaluate(()=>{try{sessionStorage.setItem('lz-entered','1')}catch(e){}});
    await p.reload({waitUntil:'networkidle'});
    await p.evaluate(()=>document.querySelector('#compare').scrollIntoView({block:'center'}));
    await p.waitForTimeout(1200);
    const has = await p.evaluate(()=>!!document.querySelector('.cmp__range'));
    say(has, 'повзунок побудовано');
    if (has) {
      const r0 = await p.evaluate(()=>{const i=document.querySelector('.cmp__range');
        return {min:i.min,max:i.max,val:i.value,label:i.getAttribute('aria-label'),
          type:i.type, split:getComputedStyle(document.querySelector('.cmp')).getPropertyValue('--split')};});
      say(!!r0.label && r0.type==='range', 'повзунок доступний: '+JSON.stringify(r0));
      await p.focus('.cmp__range');
      await p.keyboard.press('Home'); await p.waitForTimeout(250);
      const a = await p.evaluate(()=>getComputedStyle(document.querySelector('.cmp')).getPropertyValue('--split'));
      await p.keyboard.press('End'); await p.waitForTimeout(250);
      const z = await p.evaluate(()=>getComputedStyle(document.querySelector('.cmp')).getPropertyValue('--split'));
      say(a.trim()!==z.trim(), 'Home/End рухають повзунок: '+a.trim()+' → '+z.trim());
      const over = await p.evaluate(()=>{
        const c=document.querySelector('.cmp'), r=c.getBoundingClientRect();
        const h=document.querySelector('.cmp__handle');
        if(!h) return 'без ручки';
        const hr=h.getBoundingClientRect();
        return (hr.left>=r.left-2 && hr.right<=r.right+2) ? 'ok' : 'ручка виїхала за кадр';
      });
      say(over==='ok'||over==='без ручки', 'ручка в межах кадру: '+over);
      // фокус видно
      const fo = await p.evaluate(()=>{const i=document.querySelector('.cmp__range');
        i.focus(); const c=document.querySelector('.cmp');
        return {cls:c.className, outline:getComputedStyle(i).outlineStyle};});
      say(fo.cls.indexOf('is-focused')>-1 || fo.outline!=='none', 'фокус на повзунку видно: '+JSON.stringify(fo));
    }
    await p.close(); }

  // ---- плавний скрол не ламає позицію ----
  { const p = await b.newPage({ viewport:{width:1440,height:900} });
    await p.goto('http://localhost:8899/index.html#care',{waitUntil:'networkidle'});
    await p.waitForTimeout(2500);
    const r = await p.evaluate(()=>{const s=document.getElementById('care').getBoundingClientRect();
      const h=document.querySelector('.hdr').getBoundingClientRect();
      return {top:Math.round(s.top), hdrB:Math.round(h.bottom)};});
    say(r.top >= r.hdrB - 4 && r.top < 260, 'прямий вхід за адресою з #care: верх '+r.top+', шапка до '+r.hdrB);
    await p.close(); }

  console.log('\nПРОБЛЕМ: '+bad.length);
  await b.close();
})();
