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

  /* Кожен пункт тримає свій таймер завершення. Без цього швидкі кліки
     влаштовують гонку: таймер попереднього відкриття спрацьовує ПІСЛЯ
     закриття і повертає height:auto закритому пункту — наступне
     розкриття тоді не анімується. Знайдено тестом на 4 кліки поспіль. */
  var timers = new WeakMap();

  function stopTimer(d) {
    var t = timers.get(d);
    if (t) { clearTimeout(t); timers.delete(d); }
  }
  function later(d, fn) {
    stopTimer(d);
    if (reduced) { fn(); return; }
    timers.set(d, setTimeout(function () { timers.delete(d); fn(); }, DUR + 40));
  }

  function bodyOf(d) { return d.querySelector('.quiz__body'); }

  function openItem(d) {
    var el = bodyOf(d);
    stopTimer(d);
    d.open = true;
    el.style.height = '0px';
    el.style.opacity = '0';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.height = el.scrollHeight + 'px';
        el.style.opacity = '1';
      });
    });
    later(d, function () { if (d.open) { el.style.height = 'auto'; } });
  }

  function closeItem(d) {
    var el = bodyOf(d);
    stopTimer(d);
    el.style.height = el.scrollHeight + 'px';
    requestAnimationFrame(function () {
      el.style.height = '0px';
      el.style.opacity = '0';
    });
    later(d, function () { if (!timers.get(d)) { d.open = false; } });
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
      el.style.transition = 'height ' + DUR + 'ms var(--e-out), opacity ' + DUR + 'ms var(--e-out)';
    }
    if (!d.open) { el.style.height = '0px'; el.style.opacity = '0'; }

    summary.addEventListener('click', function (e) {
      e.preventDefault();                 /* click приходить і від Enter, і від Space */
      if (d.open) { closeItem(d); return; }
      items.forEach(function (o) { if (o !== d && o.open) { closeItem(o); } });
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

    function focusables() {
      return Array.prototype.slice.call(
        menu.querySelectorAll('a[href], button:not([disabled])')
      ).filter(function (n) { return n.offsetParent !== null; });
    }

    function openMenu() {
      lastFocus = document.activeElement;
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      btn.querySelector('.hdr__menu-txt').textContent = 'Закрити';
      document.body.style.overflow = 'hidden';
      var f = focusables();
      if (f.length) { f[0].focus(); }
    }

    function closeMenu() {
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.querySelector('.hdr__menu-txt').textContent = 'Меню';
      document.body.style.overflow = '';
      setTimeout(function () { menu.hidden = true; }, reduced ? 0 : 420);
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
