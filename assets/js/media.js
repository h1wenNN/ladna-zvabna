/* ==========================================================================
   ЛАДНА-ЗВАБНА · media.js
   Ліниве підвантаження відео.

   У розмітці <video> стоїть БЕЗ джерела — тільки з poster. Тому браузер
   малює постер і не вантажить нічого. Джерела підставляє цей файл, і лише
   коли всі умови зійшлися:

     · екран ширший за 768px — на мобільному фонових відео немає взагалі
       (вимога MASTER_PROMPT п. 6.3), там постер лишається назавжди;
     · користувач не просив менше руху;
     · з'єднання не економне і не повільне;
     · сторінка вже намалювалася — щоб кліп не конкурував за канал
       із першим екраном;
     · блок наблизився до вьюпорта.

   Якщо цей файл не завантажиться — сайт лишиться з постерами. Це прийнятна
   деградація: жодної порожньої діри, жодного зламаного кадру.
   ========================================================================== */
(function () {
  'use strict';

  var vids = Array.prototype.slice.call(document.querySelectorAll('video[data-video]'));
  if (!vids.length) return;

  var narrow  = window.matchMedia('(max-width: 768px)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Економія трафіку й повільний зв'язок: постер краще за півмегабайта. */
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var thrifty = !!(conn && (conn.saveData ||
                 /^(slow-)?2g$/.test(conn.effectiveType || '')));

  if (narrow || reduced || thrifty) return;

  function attach(v) {
    if (v.dataset.done) return;
    v.dataset.done = '1';

    var base = v.dataset.video;
    ['webm', 'mp4'].forEach(function (ext) {
      var s = document.createElement('source');
      s.src = base + '.' + ext;
      s.type = ext === 'webm' ? 'video/webm' : 'video/mp4';
      v.appendChild(s);
    });

    v.preload = 'auto';
    v.load();

    v.addEventListener('loadeddata', function () {
      /* Швидкість задаємо тут, а не у файлі: менша вага, більша плавність.
         playbackRate скидається після load(), тому ставимо саме зараз. */
      v.playbackRate = parseFloat(v.dataset.slow) || 0.7;
      var p = v.play();
      if (p && p.catch) { p.catch(function () { /* автовідтворення заблоковано — лишається постер */ }); }
    }, { once: true });

    /* Якщо кліп не приїхав — тихо лишаємо постер, нічого не ламаємо. */
    v.addEventListener('error', function () { v.removeAttribute('preload'); }, { once: true });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      attach(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: '200px 0px' });

  /* Чекаємо, поки сторінка намалюється: до цього моменту канал потрібен
     шрифтам, стилям і постеру героя. */
  function start() {
    var go = function () { vids.forEach(function (v) { io.observe(v); }); };
    if (window.requestIdleCallback) { requestIdleCallback(go, { timeout: 1800 }); }
    else { setTimeout(go, 600); }
  }

  if (document.readyState === 'complete') { start(); }
  else { window.addEventListener('load', start, { once: true }); }

  /* Вкладку сховали — зупиняємо: марно крутити кадри в невидимому вікні. */
  document.addEventListener('visibilitychange', function () {
    vids.forEach(function (v) {
      if (!v.dataset.done) return;
      if (document.hidden) { v.pause(); }
      else { var p = v.play(); if (p && p.catch) { p.catch(function () {}); } }
    });
  });

})();
