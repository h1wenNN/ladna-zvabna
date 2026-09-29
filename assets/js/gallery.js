/* Ладна-Звабна · перегляд фото з прогресивним покращенням.
   Без підтримки <dialog> посилання відкривають оригінальні зображення. */
(function () {
  'use strict';

  var viewer = document.getElementById('gallery-viewer');
  var image = document.getElementById('gallery-viewer-img');
  var caption = document.getElementById('gallery-viewer-caption');
  var count = document.getElementById('gallery-viewer-count');
  var links = Array.prototype.slice.call(document.querySelectorAll('a[data-gallery-open][href]'));

  if (!viewer || typeof viewer.showModal !== 'function' || typeof viewer.close !== 'function' ||
      !image || !caption || !count || !links.length) return;

  var closeButton = viewer.querySelector('[data-gallery-close]');
  var previousButton = viewer.querySelector('[data-gallery-prev]');
  var nextButton = viewer.querySelector('[data-gallery-next]');
  if (!closeButton || !previousButton || !nextButton) return;

  var activeIndex = -1;
  var openingLink = null;
  var scrollLocked = false;
  var previousOverflow = '';
  var previousOverflowPriority = '';

  function showImage(index) {
    activeIndex = (index + links.length) % links.length;
    var link = links[activeIndex];
    var description = link.getAttribute('data-caption') || link.getAttribute('data-alt') || 'Фото салону «Ладна-Звабна»';
    image.alt = link.getAttribute('data-alt') || description;
    image.src = link.href;
    caption.textContent = description;
    count.textContent = (activeIndex + 1) + ' із ' + links.length;
    previousButton.disabled = links.length < 2;
    nextButton.disabled = links.length < 2;
  }

  function openViewer(index, link) {
    if (!viewer.open) {
      /* Не перехоплюємо перехід, якщо браузер не зміг відкрити діалог. */
      try { viewer.showModal(); } catch (error) { return false; }

      openingLink = link;
      previousOverflow = document.body.style.getPropertyValue('overflow');
      previousOverflowPriority = document.body.style.getPropertyPriority('overflow');
      document.body.style.setProperty('overflow', 'hidden');
      scrollLocked = true;
    }
    showImage(index);
    return true;
  }

  function closeViewer() {
    if (viewer.open) viewer.close();
  }

  links.forEach(function (link, index) {
    link.addEventListener('click', function (event) {
      /* Нові вкладки, завантаження та модифіковані кліки залишаються нативними. */
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.altKey || link.hasAttribute('download') ||
          (link.target && link.target !== '_self')) return;
      if (openViewer(index, link)) event.preventDefault();
    });
  });

  closeButton.addEventListener('click', function (event) {
    event.preventDefault();
    closeViewer();
  });

  previousButton.addEventListener('click', function (event) {
    event.preventDefault();
    if (viewer.open && activeIndex >= 0) showImage(activeIndex - 1);
  });

  nextButton.addEventListener('click', function (event) {
    event.preventDefault();
    if (viewer.open && activeIndex >= 0) showImage(activeIndex + 1);
  });

  viewer.addEventListener('keydown', function (event) {
    if (!viewer.open || activeIndex < 0 || event.defaultPrevented ||
        event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showImage(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
    }
    /* Escape обробляє сам браузер через нативне закриття <dialog>. */
  });

  viewer.addEventListener('click', function (event) {
    if (!event.target.closest('.gallery-viewer__inner')) closeViewer();
  });

  viewer.addEventListener('close', function () {
    if (scrollLocked) {
      if (previousOverflow) {
        document.body.style.setProperty('overflow', previousOverflow, previousOverflowPriority);
      } else {
        document.body.style.removeProperty('overflow');
      }
      scrollLocked = false;
    }
    activeIndex = -1;
    if (openingLink && document.documentElement.contains(openingLink)) {
      openingLink.focus({ preventScroll: true });
    }
    openingLink = null;
  });

  document.documentElement.classList.add('gallery-ready');
})();
