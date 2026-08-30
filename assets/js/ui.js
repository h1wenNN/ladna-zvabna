/* ==========================================================================
   ЛАДНА-ЗВАБНА · ui.js
   Інтерактивні компоненти: квіз, повзунок до/після, меню, липка панель.

   Правило для всього файлу: кожен компонент — ПОКРАЩЕННЯ того, що вже
   працює без JS. Квіз без нього лишається нативним акордеоном, до/після —
   двома кадрами поруч, навігація — посиланнями у футері.

   Доступність тут не «додатково», а частина завдання: усе керується
   з клавіатури, стани озвучуються, фокус не губиться.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = reduced ? 0 : 620;

  /* ====================================================================
     1. КВІЗ
     Нативний <details> не вміє анімувати висоту, а стрибок висоти
     суперечить усьому іншому на сайті. Тому беремо керування на себе:
     перехоплюємо click (він приходить і від Enter, і від Space —
     клавіатура працює далі сама собою) і ведемо висоту руками.

     Атрибут name= знімаємо: браузер закривав би сусідів миттєво,
     обриваючи анімацію. Ексклюзивність робимо самі — але лише коли JS
     живий; без нього name лишається в HTML і працює нативно.
     ==================================================================== */
  var items = Array.prototype.slice.call(document.querySelectorAll('.quiz__item'));

  /* Стан веде transitionend, а не таймер. Таймер лишається тільки як
     страховка: якщо переходу не сталося взагалі (нульова тривалість,
     вкладка у фоні), подія не прийде і пункт завис би назавжди.

     Дві помилки, знайдені тестом «клік по кожному пункту поспіль»:
     1. Закритий пункт лишався заввишки 32px — це нижній padding тіла.
        height:0 при box-sizing:border-box не може бути меншим за падінги,
        тож п'ять закритих пунктів давали 128px мертвого місця, а сусідній
        заголовок перекривався смужкою невидимого тексту. Тепер падінг
        анімується разом із висотою.
     2. Швидкі кліки лишали відкритим не той пункт, по якому клікнули:
        таймери попередніх закриттів спрацьовували пізніше. Тепер кожен
        пункт має явний стан і клік по тому, що вже відкривається,
        ігнорується. */
  var timers = new WeakMap();

  function stopTimer(d) {
    var t = timers.get(d);
    if (t) { clearTimeout(t); timers.delete(d); }
  }
  function bodyOf(d) { return d.querySelector('.quiz__body'); }

  /* Справжня висота розкритого тіла разом із падінгом. Вимірюємо з
     вимкненим переходом, інакше зчитаємо проміжний кадр анімації. */
  function fullHeight(el) {
    var h = el.style.height, pb = el.style.paddingBottom, tr = el.style.transition;
    el.style.transition = 'none';
    el.style.height = 'auto';
    el.style.paddingBottom = '';
    var v = el.offsetHeight;
    el.style.height = h; el.style.paddingBottom = pb;
    void el.offsetHeight;                 /* форсуємо застосування до повернення переходу */
    el.style.transition = tr;
    return v;
  }

  /* Одна точка завершення на обидва напрями. */
  function finish(d, fn) {
    var el = bodyOf(d);
    stopTimer(d);
    if (reduced) { fn(); return; }
    var done = function (e) {
      if (e && e.target !== el) return;
      if (e && e.propertyName !== 'height') return;
      el.removeEventListener('transitionend', done);
      stopTimer(d);
      fn();
    };
    el.addEventListener('transitionend', done);
    timers.set(d, setTimeout(function () {
      el.removeEventListener('transitionend', done);
      timers.delete(d);
      fn();
    }, DUR + 120));
  }

  function openItem(d) {
    var el = bodyOf(d);
    stopTimer(d);
    d.dataset.state = 'opening';
    d.open = true;
    el.style.height = '0px';
    el.style.paddingBottom = '0px';
    el.style.opacity = '0';
    var target = fullHeight(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.height = target + 'px';
        el.style.paddingBottom = '';
        el.style.opacity = '1';
      });
    });
    finish(d, function () {
      if (d.dataset.state !== 'opening') return;
      d.dataset.state = 'open';
      el.style.height = 'auto';
    });
  }

  function closeItem(d) {
    var el = bodyOf(d);
    stopTimer(d);
    d.dataset.state = 'closing';
    el.style.height = el.offsetHeight + 'px';
    el.style.paddingBottom = '';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.height = '0px';
        el.style.paddingBottom = '0px';
        el.style.opacity = '0';
      });
    });
    finish(d, function () {
      if (d.dataset.state !== 'closing') return;
      d.dataset.state = 'closed';
      /* Добиваємо нуль явно: якщо спрацювала страховка-таймер, перехід
         міг не дійти до кінця і лишалася смужка на кілька пікселів. */
      el.style.height = '0px';
      el.style.paddingBottom = '0px';
      el.style.opacity = '0';
      d.open = false;
    });
  }

  items.forEach(function (d) {
    var summary = d.querySelector('summary');
    var el = bodyOf(d);
    if (!summary || !el) return;

    /* Знімаємо name=: браузер закривав би сусідів миттєво, обриваючи
       анімацію. Ексклюзивність робимо самі — але лише коли JS живий;
       без нього name лишається в HTML і акордеон працює нативно. */
    d.removeAttribute('name');
    el.style.overflow = 'hidden';
    if (!reduced) {
      el.style.transition = 'height ' + DUR + 'ms var(--e-out), padding-bottom ' + DUR +
        'ms var(--e-out), opacity ' + DUR + 'ms var(--e-out)';
    }
    if (d.open) {
      d.dataset.state = 'open';
      el.style.height = 'auto';
    } else {
      d.dataset.state = 'closed';
      el.style.height = '0px';
      el.style.paddingBottom = '0px';
      el.style.opacity = '0';
    }

    summary.addEventListener('click', function (e) {
      e.preventDefault();                 /* click приходить і від Enter, і від Space */
      var st = d.dataset.state;
      if (st === 'opening') return;       /* уже відкривається — повторний клік ігноруємо */
      if (st === 'open') { closeItem(d); return; }
      items.forEach(function (o) {
        if (o !== d && (o.dataset.state === 'open' || o.dataset.state === 'opening')) { closeItem(o); }
      });
      openItem(d);
    });
  });

  /* ====================================================================
     2. ПОВЗУНОК «ДО / ПІСЛЯ»
     Побудований на нативному <input type="range">. Це не компроміс,
     а найкраще рішення: стрілки, Home/End, PageUp/Down, озвучення
     скрінрідером і підтримка тач — усе вже є в браузері. Нам лишається
     сховати вигляд і намалювати свій, не чіпаючи поведінку.
     ==================================================================== */
  var pair = document.querySelector('[data-compare]');
  if (pair) {
    var before = pair.querySelector('[data-side="before"]');
    var afterF = pair.querySelector('[data-side="after"]');

    if (before && afterF) {
      var capBefore = before.querySelector('figcaption').textContent.trim();
      var capAfter  = afterF.querySelector('figcaption').textContent.trim();

      var stage = document.createElement('div');
      stage.className = 'cmp';

      var layerA = document.createElement('div');
      layerA.className = 'cmp__layer cmp__layer--after';
      layerA.appendChild(afterF.querySelector('.arch'));

      var layerB = document.createElement('div');
      layerB.className = 'cmp__layer cmp__layer--before';
      layerB.appendChild(before.querySelector('.arch'));

      var handle = document.createElement('span');
      handle.className = 'cmp__handle';
      handle.setAttribute('aria-hidden', 'true');

      var input = document.createElement('input');
      input.type = 'range';
      input.className = 'cmp__range';
      input.min = '0'; input.max = '100'; input.step = '1'; input.value = '50';
      input.id = 'compare-range';
      input.setAttribute('aria-label',
        'Порівняння кадрів: ліворуч «' + capBefore + '», праворуч «' + capAfter +
        '». Стрілками вліво і вправо змістіть межу.');

      var labels = document.createElement('p');
      labels.className = 'cmp__labels';
      labels.innerHTML = '<span>' + capBefore + '</span><span>' + capAfter + '</span>';

      stage.appendChild(layerA);
      stage.appendChild(layerB);
      stage.appendChild(handle);
      stage.appendChild(input);

      pair.innerHTML = '';
      pair.appendChild(stage);
      pair.appendChild(labels);
      pair.classList.add('compare__pair--live');

      var apply = function () {
        var v = +input.value;
        stage.style.setProperty('--split', v + '%');
        input.setAttribute('aria-valuetext', Math.round(v) + '% кадру «' + capBefore + '»');
      };
      input.addEventListener('input', apply);
      /* Кільце фокуса малюємо на сцені, а не на самому range —
         інакше браузер покаже поверх кадрів власний синій повзунок. */
      input.addEventListener('focus', function () {
        if (input.matches(':focus-visible')) { stage.classList.add('is-focused'); }
      });
      input.addEventListener('blur', function () { stage.classList.remove('is-focused'); });
      apply();

      /* Перетягування мишею й пальцем: ведемо значення того самого input,
         щоб стан лишався в одному місці й озвучувався коректно. */
      var dragging = false;
      function fromPoint(clientX) {
        var r = stage.getBoundingClientRect();
        input.value = Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
        apply();
      }
      stage.addEventListener('pointerdown', function (e) {
        if (e.target === input) return;      /* нативному повзунку не заважаємо */
        dragging = true; stage.setPointerCapture(e.pointerId); fromPoint(e.clientX);
      });
      stage.addEventListener('pointermove', function (e) { if (dragging) fromPoint(e.clientX); });
      stage.addEventListener('pointerup',     function () { dragging = false; });
      stage.addEventListener('pointercancel', function () { dragging = false; });
    }
  }

  /* ====================================================================
     3. МОБІЛЬНЕ МЕНЮ
     Кнопку створює JS — без нього меню не потрібне: розділи гортаються,
     а всі контакти є у футері. Тому в HTML її немає.
     ==================================================================== */
  var menu = document.getElementById('menu');
  var hdrIn = document.querySelector('.hdr__in');

  if (menu && hdrIn) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hdr__menu';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'menu');
    btn.innerHTML = '<span class="hdr__menu-txt">Меню</span>';
    hdrIn.appendChild(btn);

    var lastFocus = null;
    var hideT = 0;

    /* Кнопка «Закрити» — це та сама кнопка в шапці, і вона МАЄ бути
       в переліку: без неї фокус-трап не мав куди вийти, крім Esc.
       Порядок у списку мусить збігатися з порядком у DOM: .hdr__in
       (а в ньому кнопка) стоїть ПЕРЕД полотном меню. Інакше «останній»
       елемент списку не збігається з останнім за Tab, замикання не
       спрацьовує — і Tab із останнього пункту йшов у сторінку під меню. */
    function focusables() {
      var list = Array.prototype.slice.call(
        menu.querySelectorAll('a[href], button:not([disabled])')
      ).filter(function (n) { return n.offsetParent !== null; });
      list.unshift(btn);
      return list;
    }

    function openMenu() {
      clearTimeout(hideT);                  /* інакше відкладене приховування
                                               з попереднього закриття гасило
                                               щойно відкрите меню */
      lastFocus = document.activeElement;
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      btn.querySelector('.hdr__menu-txt').textContent = 'Закрити';
      /* Шапка піднімається НАД меню: інакше єдина кнопка закриття
         лишалася під суцільним молочним полотном, і меню не було чим
         закрити взагалі — ні пальцем, ні клавіатурою. */
      document.documentElement.classList.add('menu-open');
      document.body.style.overflow = 'hidden';
      /* Фокус ставимо на перший ПУНКТ, а не на кнопку закриття:
         людина відкрила меню, щоб кудись перейти. */
      var f = focusables();
      if (f.length > 1) { f[1].focus(); } else if (f.length) { f[0].focus(); }
    }

    function closeMenu() {
      clearTimeout(hideT);
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.querySelector('.hdr__menu-txt').textContent = 'Меню';
      document.documentElement.classList.remove('menu-open');
      document.body.style.overflow = '';
      hideT = setTimeout(function () { menu.hidden = true; }, reduced ? 0 : 420);
      if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    btn.addEventListener('click', function () {
      if (menu.hidden) { openMenu(); } else { closeMenu(); }
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) { closeMenu(); }
    });

    /* Фокус-трап і Esc */
    document.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ====================================================================
     4. ЛИПКА ПАНЕЛЬ
     З'являється після 60% сторінки. Тільки на вузьких екранах —
     на десктопі для цього є розділ «Запис» і шапка.
     ==================================================================== */
  var bar = document.createElement('div');
  bar.className = 'callbar';
  bar.innerHTML =
    '<a class="callbar__a" href="https://instagram.com/ladna_zvabna" rel="noopener">Написати в Direct</a>' +
    '<a class="callbar__a callbar__a--quiet" href="tel:+380756860912">Подзвонити</a>';
  document.body.appendChild(bar);

  var barOn = false, barTick = false;
  function checkBar() {
    barTick = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? (window.scrollY || window.pageYOffset) / max : 0;
    var want = p > 0.6 && p < 0.985;
    if (want !== barOn) { barOn = want; bar.classList.toggle('is-up', want); }
  }
  window.addEventListener('scroll', function () {
    if (!barTick) { barTick = true; requestAnimationFrame(checkBar); }
  }, { passive: true });
  checkBar();

})();
