/* ==========================================================================
   ЛАДНА-ЗВАБНА · main.js
   Базовий шар руху. Доктрина «Дихання й світло» — MASTER_PROMPT розділ 4.

   Сайт не анімований — сайт дихає. Нічого не вилітає, не пружинить,
   не стрибає. Числа в п. 4.2 — вимога, не орієнтир.

   ВАЖЛИВО: цей файл лише ДОДАЄ рух. Сторінка вже повна й читабельна без нього
   (правила html:not(.js) у motion.css). Якщо цей скрипт не завантажиться
   або впаде — запобіжник у <head> поверне статичну версію.
   ========================================================================== */
(function () {
  'use strict';

  var doc  = document.documentElement;
  var body = document.body;

  /* Скрипт живий — знімаємо запобіжник, поставлений у <head>. */
  if (window.__lzFallback) { clearTimeout(window.__lzFallback); window.__lzFallback = null; }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse  = window.matchMedia('(pointer: coarse)').matches;

  /* --------------------------------------------------------------------
     Якщо користувач просив менше руху — показуємо все одразу й виходимо.
     Жодних спостерігачів, жодного rAF-циклу.
     -------------------------------------------------------------------- */
  if (reduced) {
    showEverything();
    return;
  }

  function showEverything() {
    var n = document.querySelectorAll('.reveal, .words, .arch-open, .draw');
    for (var i = 0; i < n.length; i++) { n[i].classList.add('is-in'); }
    var l = document.getElementById('loader');
    if (l) { l.style.display = 'none'; }
  }

  /* ====================================================================
     1. ПЛАВНИЙ СКРОЛ
     Тільки для миші. На тач-пристроях нативний скрол кращий за будь-яку
     емуляцію — інерція там уже своя, і друга поверх неї відчувається гумою.
     ==================================================================== */
  var lenis = null;
  if (!coarse && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({
      duration: 1.4,
      lerp: 0.075,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      syncTouch: false
    });
    (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);

    /* Якірні посилання ведемо через Lenis, інакше вони стрибають */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -40, duration: 1.6 });
    });
  }

  /* ====================================================================
     2. РОЗБИТТЯ ЗАГОЛОВКІВ ПО СЛОВАХ
     По словах, не по літерах — по-літерна анімація це кліше (п. 4.4).
     Розбиваємо лише текстові вузли, зберігаючи <br> та <em> усередині.
     Нерозривний пробіл НЕ вважається межею слова: пара «зі<nbsp>злагоди»
     має проявитися як одне ціле, бо саме так вона й читається.
     ==================================================================== */
  var WORD_STEP = 110; // мс між словами

  function splitWords(root) {
    var i = 0;
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (n) {
        if (n.nodeType === 3) {
          if (!/\S/.test(n.nodeValue)) return;
          var frag = document.createDocumentFragment();
          n.nodeValue.split(/([ \t\n\r]+)/).forEach(function (part) {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            var s = document.createElement('span');
            s.className = 'w';
            s.style.setProperty('--wd', (i++ * WORD_STEP) + 'ms');
            s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    })(root);
  }

  var wordBlocks = document.querySelectorAll('.words');
  for (var w = 0; w < wordBlocks.length; w++) { splitWords(wordBlocks[w]); }

  /* ====================================================================
     3. ПРОЯВЛЕННЯ
     Стани описані в motion.css. Тут лише вмикач.
     ==================================================================== */
  function turnOn(e, obs) {
    if (!e.isIntersecting) return;
    var el = e.target;
    el.classList.add('is-in');
    obs.unobserve(el);
    /* Знімаємо will-change після появи — інакше шар лишається в пам'яті GPU */
    el.addEventListener('transitionend', function done() {
      el.classList.add('is-done');
      el.removeEventListener('transitionend', done);
    });
  }

  /* Текст і блоки: чекаємо, поки в кадр увійде помітна частина. */
  var ioText = new IntersectionObserver(function (en) { en.forEach(function (e) { turnOn(e, ioText); }); },
    { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

  /* Арки й лінії, що «малюються», — ОКРЕМИЙ спостерігач із порогом 0.

     Причина не косметична. clip-path зменшує площу, яку IntersectionObserver
     враховує: у стартовому стані `inset(80% 0 0 0)` від елемента лишається
     20%, і навіть повністю видима арка дає ratio ≈0.13 — нижче за поріг 0.15.
     Тобто з одним спостерігачем арка не відкривалася НІКОЛИ.
     Знайдено на героєві: кадр показував лише нижню смужку. */
  var ioClip = new IntersectionObserver(function (en) { en.forEach(function (e) { turnOn(e, ioClip); }); },
    { threshold: 0, rootMargin: '0px 0px -12% 0px' });

  var wText = document.querySelectorAll('.reveal, .words');
  for (var k = 0; k < wText.length; k++) { ioText.observe(wText[k]); }
  var wClip = document.querySelectorAll('.arch-open, .draw');
  for (var q = 0; q < wClip.length; q++) { ioClip.observe(wClip[q]); }

  /* ====================================================================
     4. НАСКРІЗНА НИТКА ТА ПАРАЛАКС
     Один rAF-цикл на обидва. Читаємо scrollY один раз за кадр —
     жодних синхронних вимірювань усередині обробника скролу.
     ==================================================================== */
  var thread   = document.querySelector('.thread');
  var parallax = Array.prototype.slice.call(document.querySelectorAll('[data-par]'));
  var story    = document.querySelector('.story');
  var pathLine = document.querySelector('.story__beat--path');
  var ticking  = false;

  /* Плавна сходинка: 0 до порога, 1 після, і м'яко між ними.
     Потрібна, щоб перехід світла стався в конкретному місці сцени,
     а не розмазався рівномірно по всій її довжині. */
  function smoothstep(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }

  /* Колір світла сцени: холодний сіро-зелений -> мідний.
     Це шар ПІД текстом; сам текст не чіпаємо ніде, тому контраст
     лишається передбачуваним у кожному кадрі. */
  var COLD = [122, 134, 120];
  var WARM = [182, 112,  92];

  /* Кадр іде у ДВІ фази: спершу тільки читаємо геометрію, потім тільки пишемо.
     Якщо їх перемішати, кожен запис змушує браузер перерахувати layout заново
     перед наступним читанням — Lighthouse називає це forced reflow.
     Тому всі getBoundingClientRect() зібрані вгорі, всі style.* — унизу. */
  function frame() {
    ticking = false;

    /* ---------- ФАЗА 1: ЧИТАННЯ ---------- */
    var y   = window.scrollY || window.pageYOffset;
    var vh  = window.innerHeight;
    var docH = document.documentElement.scrollHeight;

    var srBottom, srHeight, prTop;
    if (story)    { var sr = story.getBoundingClientRect(); srBottom = sr.bottom; srHeight = sr.height; }
    if (pathLine) { prTop = pathLine.getBoundingClientRect().top; }

    var parGeo = [];
    for (var i = 0; i < parallax.length; i++) {
      var r = parallax[i].getBoundingClientRect();
      parGeo.push({ top: r.top, h: r.height });
    }

    /* ---------- ФАЗА 2: ЗАПИС ---------- */
    if (thread) {
      var max = docH - vh;
      thread.style.setProperty('--thread',
        (max > 0 ? Math.min(1, Math.max(0, y / max)) : 1).toFixed(4));
    }

    /* Сцена «Друге народження»: 0 — щойно торкнулася низу екрана,
       1 — повністю пішла вгору. */
    if (story) {
      var sp = clamp01(1 - srBottom / (srHeight + vh));
      story.style.setProperty('--scene', sp.toFixed(3));
      /* Диво стається не одразу: світло тепліє між 45% і 80% сцени */
      var t = smoothstep(0.45, 0.80, sp);
      story.style.setProperty('--scene-c',
        Math.round(COLD[0] + (WARM[0] - COLD[0]) * t) + ',' +
        Math.round(COLD[1] + (WARM[1] - COLD[1]) * t) + ',' +
        Math.round(COLD[2] + (WARM[2] - COLD[2]) * t));
    }

    /* Лінія Херсон -> Бровари: малюється, поки блок іде
       від нижньої третини екрана до середини. */
    if (pathLine) {
      var d = clamp01((vh * 0.86 - prTop) / (vh * 0.42));
      pathLine.style.setProperty('--path', (d * d * (3 - 2 * d)).toFixed(3));
    }

    for (var j = 0; j < parallax.length; j++) {
      var g = parGeo[j];
      if (g.top + g.h < -200 || g.top > vh + 200) continue;
      /* Коефіцієнт обмежений 0.12 — вище цього рух перестає читатися
         як світло й починає читатись як атракціон (п. 4.2). */
      var f = Math.min(0.12, parseFloat(parallax[j].dataset.par) || 0.08);
      var mid = g.top + g.h / 2 - vh / 2;
      parallax[j].style.transform = 'translate3d(0,' + (-mid * f).toFixed(2) + 'px,0)';
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  if (thread || parallax.length || story || pathLine) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    frame();
  }

  /* ====================================================================
     5. ШАПКА НАД ТЕМНОЮ СЦЕНОЮ
     Ховається, поки сцена історії займає верх екрана. Окремий спостерігач,
     а не перевірка в rAF-циклі: стан змінюється двічі за всю сторінку,
     рахувати його 60 разів на секунду немає сенсу.
     ==================================================================== */
  var hdr = document.querySelector('.hdr');
  if (hdr && story) {
    new IntersectionObserver(function (entries) {
      hdr.classList.toggle('hdr--away', entries[0].isIntersecting);
    }, { rootMargin: '-1px 0px -85% 0px', threshold: 0 }).observe(story);
  }

  /* ====================================================================
     6. ФОНОВЕ ВІДЕО
     Швидкість задається тут, а не у файлі: менша вага, більша плавність.
     ==================================================================== */
  var vids = document.querySelectorAll('video[data-slow]');
  for (var v = 0; v < vids.length; v++) {
    vids[v].playbackRate = parseFloat(vids[v].dataset.slow) || 0.7;
  }

  /* ====================================================================
     7. ПРЕЛОАДЕР
     До 1.8 с, один раз за сесію. Лінія логотипа малюється, слово
     проявляється, шар РОЗЧИНЯЄТЬСЯ світлом — не злітає вгору.
     Ніяких відсотків, ніякої смужки прогресу (п. 4.4).
     ==================================================================== */
  var loader = document.getElementById('loader');
  if (loader) {
    var seen = false;
    try { seen = sessionStorage.getItem('lz-entered') === '1'; } catch (err) { /* приватний режим */ }

    if (seen) {
      loader.style.display = 'none';
    } else {
      if (lenis) { lenis.stop(); }
      body.style.overflow = 'hidden';

      var mark = loader.querySelector('.draw');
      var word = loader.querySelector('.loader__word');
      if (word) {
        word.style.opacity = '0';
        word.style.transition = 'opacity 900ms var(--e-out)';
      }

      requestAnimationFrame(function () {
        if (mark) { mark.classList.add('is-in'); }
        setTimeout(function () { if (word) { word.style.opacity = '.9'; } }, 500);
      });

      setTimeout(function () {
        loader.classList.add('is-gone');
        body.style.overflow = '';
        if (lenis) { lenis.start(); }
        try { sessionStorage.setItem('lz-entered', '1'); } catch (err) { /* нічого */ }
        setTimeout(function () { loader.style.display = 'none'; }, 1000);
      }, 1750);
    }
  }

  /* ====================================================================
     8. ЩО ПІШЛО НЕ ТАК
     Якщо помилка станеться вже після старту — краще показати статичну
     сторінку, ніж лишити людину перед порожнім екраном.
     ==================================================================== */
  window.addEventListener('error', function () {
    doc.classList.remove('js');
    showEverything();
  });

})();
