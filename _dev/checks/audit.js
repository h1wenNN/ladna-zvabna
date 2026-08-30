const { launch } = require('./_browser');
const URL = 'http://localhost:8901/index.html';
(async () => {
  const b = await launch();
  const out = [];
  const say = (...a) => { const s = a.join(' '); console.log(s); out.push(s); };

  // ---- 1. БЕЗ JS ----
  say('── БЕЗ JAVASCRIPT');
  let p = await b.newPage({ viewport:{width:1440,height:900}, javaScriptEnabled:false });
  await p.goto(URL, { waitUntil:'networkidle' });
  const nojs = await p.evaluate(() => {
    const vis = n => { const s = getComputedStyle(n); return s.display!=='none' && s.visibility!=='hidden' && +s.opacity>0.9; };
    return { text: document.body.innerText.replace(/\s+/g,' ').trim().length,
      hidden: [...document.querySelectorAll('.reveal,.words,.arch-open')].filter(n=>!vis(n)).length,
      loader: getComputedStyle(document.getElementById('loader')).display,
      quizOpen: [...document.querySelectorAll('.quiz__item')].filter(d=>d.open).length,
      quizName: document.querySelector('.quiz__item').getAttribute('name'),
      compareSides: document.querySelectorAll('.compare__side').length,
      videos: [...document.querySelectorAll('video')].map(v=>v.currentSrc||'постер'),
      scrollX: document.documentElement.scrollWidth > window.innerWidth };
  }).catch(e => ({ err: e.message }));
  say(`   символів тексту: ${nojs.text} | прихованих блоків: ${nojs.hidden} | прелоадер: ${nojs.loader}`);
  say(`   квіз: відкрито ${nojs.quizOpen}, name="${nojs.quizName}" | до/після: ${nojs.compareSides} кадри поруч`);
  say(`   відео: ${JSON.stringify(nojs.videos)} | горизонтальний скрол: ${nojs.scrollX?'Є ✗':'немає ✓'}`);
  await p.screenshot({ path:'/home/claude/lz/a-nojs.png', fullPage:true });
  await p.close();

  // ---- 2. REDUCED MOTION ----
  say('\n── PREFERS-REDUCED-MOTION');
  p = await b.newPage({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
  await p.goto(URL, { waitUntil:'networkidle' });
  await p.evaluate(async()=>{const s=innerHeight*.8; for(let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,120));} scrollTo(0,0);});
  await p.waitForTimeout(900);
  const rm = await p.evaluate(() => ({
    hidden: [...document.querySelectorAll('.reveal,.words .w')].filter(n=>+getComputedStyle(n).opacity<0.99).length,
    loader: getComputedStyle(document.getElementById('loader')).display,
    videos: [...document.querySelectorAll('video')].filter(v=>v.currentSrc).length,
    anim: [...document.querySelectorAll('.glow,.slow-zoom')].filter(n=>getComputedStyle(n).animationName!=='none').length }));
  say(`   прихованих: ${rm.hidden} | прелоадер: ${rm.loader} | відео завантажено: ${rm.videos} | активних анімацій: ${rm.anim}`);
  await p.close();

  // ---- 3. ПОВІЛЬНА МЕРЕЖА (3G) ----
  say('\n── ПОВІЛЬНА МЕРЕЖА (3G, 400 кбіт/с, RTT 400 мс)');
  p = await b.newPage({ viewport:{width:375,height:780} });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',
    { offline:false, downloadThroughput: 400*1024/8, uploadThroughput: 400*1024/8, latency: 400 });
  const t0 = Date.now();
  await p.goto(URL, { waitUntil:'domcontentloaded' });
  const domReady = Date.now()-t0;
  await p.waitForFunction(() => document.fonts.status==='loaded', null, { timeout: 30000 }).catch(()=>{});
  const fontsReady = Date.now()-t0;
  const slow = await p.evaluate(() => ({
    text: document.body.innerText.length,
    heroVisible: document.querySelector('.hero__title').getBoundingClientRect().height > 40 }));
  say(`   DOM готовий: ${domReady} мс | шрифти: ${fontsReady} мс | текст на місці: ${slow.text} символів | герой видно: ${slow.heroVisible}`);
  await p.close();

  // ---- 4. ТІЛЬКИ КЛАВІАТУРА, ВЕСЬ САЙТ ----
  say('\n── ТІЛЬКИ КЛАВІАТУРА');
  p = await b.newPage({ viewport:{width:1440,height:900} });
  await p.goto(URL, { waitUntil:'networkidle' });
  await p.evaluate(()=>{try{sessionStorage.setItem('lz-entered','1')}catch(e){}});
  await p.reload({ waitUntil:'networkidle' });
  await p.waitForTimeout(500);
  let noFocus = [], seen = [];
  for (let i=0;i<60;i++){
    await p.keyboard.press('Tab');
    const r = await p.evaluate(() => { const a=document.activeElement, s=getComputedStyle(a);
      return { t:a.tagName.toLowerCase(), c:(a.className||'').toString().split(' ')[0],
               ring: s.outlineStyle!=='none' && s.outlineWidth!=='0px',
               ringOnCmp: document.querySelector('.cmp') ? document.querySelector('.cmp').classList.contains('is-focused') : false }; });
    seen.push(r.t+'.'+r.c);
    if (!r.ring && !r.ringOnCmp && r.t!=='body') noFocus.push(r.t+'.'+r.c);
  }
  say(`   пройдено 60 елементів | без видимого фокуса: ${noFocus.length ? [...new Set(noFocus)].join(', ')+' ✗' : 'жодного ✓'}`);
  say(`   унікальних цілей: ${new Set(seen).size}`);
  await p.close();

  await b.close();
  require('fs').writeFileSync('/tmp/audit.txt', out.join('\n'));
})();
