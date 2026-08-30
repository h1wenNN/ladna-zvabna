const { chromium } = require('/home/claude/lz/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{width:1440,height:900} });
  await p.goto('http://localhost:8901/index.html', { waitUntil:'networkidle' });
  await p.evaluate(()=>{try{sessionStorage.setItem('lz-entered','1')}catch(e){}});
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(async()=>{const s=innerHeight*.7; for(let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,150));}});
  await p.waitForTimeout(2000);

  // контраст КОЖНОГО текстового вузла проти його справжнього тла
  const bad = await p.evaluate(() => {
    function lin(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
    function L([r,g,b]){return .2126*lin(r)+.7152*lin(g)+.0722*lin(b);}
    function cr(a,c){const x=L(a),y=L(c),h=Math.max(x,y),l=Math.min(x,y);return (h+.05)/(l+.05);}
    const px=s=>{const m=s.match(/[\d.]+/g); return m?m.slice(0,3).map(Number):null;};
    /* Повертає null, якщо під текстом не суцільний колір, а КАДР:
       у ланцюжку предків трапилося зображення, відео чи градієнт.
       Такий випадок рахувати за кольором не можна — його міряють
       по справжніх пікселях у другому проході. */
    function bgOf(el){
      let n=el;
      while(n && n!==document.documentElement){
        const cs=getComputedStyle(n);
        if(cs.backgroundImage && cs.backgroundImage!=='none') return null;
        if(n.querySelector && n.matches('.hero__frame, .arch, .cmp')) return null;
        const c=cs.backgroundColor, v=px(c);
        if(v && !/rgba\(.*,\s*0\)/.test(c)) return v;
        n=n.parentElement;
      }
      return [247,245,240];
    }
    const out=[], pixel=[];
    function cssPath(el){
      const parts=[];
      for(let n=el; n && n.nodeType===1 && parts.length<5; n=n.parentElement){
        let s=n.tagName.toLowerCase();
        if(n.id){ parts.unshift('#'+n.id); break; }
        if(n.className && typeof n.className==='string'){
          const c=n.className.trim().split(/\s+/).filter(x=>!/^is-/.test(x))[0];
          if(c) s+='.'+c;
        }
        parts.unshift(s);
      }
      return parts.join(' > ');
    }
    document.querySelectorAll('p,h1,h2,h3,span,li,dd,dt,a,summary,figcaption,strong,em').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(!t || el.children.length>2) return;
      const st=getComputedStyle(el);
      if(st.display==='none'||st.visibility==='hidden'||+st.opacity<0.1) return;
      const r=el.getBoundingClientRect(); if(r.width<4||r.height<4) return;
      const fg=px(st.color); if(!fg) return;
      const size=parseFloat(st.fontSize), wgt=parseInt(st.fontWeight)||400;
      const large = size>=24 || (size>=18.66 && wgt>=700);
      const need = large?3:4.5;
      const bg=bgOf(el);
      if(!bg){
        /* Перевіряємо, що елемент справді видно: у повзунку «до/після»
           нижній шар накритий верхнім, і знімок такого підпису показує
           не текст, а те, що лежить зверху. */
        const cx=r.left+r.width/2, cy=r.top+r.height/2;
        const hit=document.elementFromPoint(cx,cy);
        if(hit && hit!==el && !el.contains(hit) && !hit.contains(el)) return;
        pixel.push({sel:cssPath(el), t:t.slice(0,34), need, fg}); return;
      }
      const c=cr(fg,bg);
      if(c<need) out.push({t:t.slice(0,34), c:+c.toFixed(2), need, size:Math.round(size),
                           cls:(el.className||'').toString().split(' ')[0]});
    });
    const seen=new Set();
    const uniq=new Set();
    return {list: out.filter(o=>{const k=o.cls+o.c; if(seen.has(k))return false; seen.add(k); return true;}),
            pixel: pixel.filter(o=>{if(uniq.has(o.sel))return false; uniq.add(o.sel); return true;})};
  });
  console.log('=== КОНТРАСТ УСІХ ТЕКСТІВ ===');
  let fails = bad.list.map(o=>`  ✗ ${o.c}:1 (треба ${o.need}) ${o.size}px .${o.cls} — «${o.t}»`);

  /* Другий прохід: текст поверх кадру. Рахуємо по СПРАВЖНІХ пікселях
     знімка — колір тла тут не число в стилях, а фотографія. */
  function lin(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
  function L(r,g,bl){return .2126*lin(r)+.7152*lin(g)+.0722*lin(bl);}
  for (const item of bad.pixel) {
    let el;
    try { el = await p.$(item.sel); } catch(e) { el = null; }
    if (!el) { fails.push(`  ? не знайшов ${item.sel}`); continue; }
    const buf = await el.screenshot();
    const png = require('zlib');
    // розбираємо PNG найпростішим шляхом — через canvas у сторінці
    const data = await p.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return Array.from(g.getImageData(0,0,c.width,c.height).data);
    }, buf.toString('base64'));
    /* Колір ЛІТЕР беремо зі стилів — він точний. Зі знімка беремо тло:
       медіану яскравості. Медіана стійка і до тонких штрихів літер,
       і до обідка по краю кадру, який інакше вдавав би «найтемніший
       піксель тексту». */
    const lum = [];
    for (let i=0;i<data.length;i+=4) lum.push(L(data[i],data[i+1],data[i+2]));
    lum.sort((a,b2)=>a-b2);
    const bgL = lum[Math.floor(lum.length*0.5)];
    const fgL = L(item.fg[0], item.fg[1], item.fg[2]);
    const c2 = (Math.max(bgL,fgL)+0.05)/(Math.min(bgL,fgL)+0.05);
    if (c2 < item.need) fails.push(`  ✗ ${c2.toFixed(2)}:1 по пікселях (треба ${item.need}) ${item.sel} — «${item.t}»`);
    else console.log(`  ✓ ${c2.toFixed(2)}:1 по пікселях (треба ${item.need}) ${item.sel}`);
  }
  console.log(fails.length ? fails.join('\n') : '  порушень немає ✓');
  console.log('\nПРОБЛЕМ: ' + fails.length);
  await b.close();
})();
