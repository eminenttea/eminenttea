(() => {
  'use strict';

  const TOTAL = 64;
  const imagePath = page => `pages/page-${String(page).padStart(2, '0')}.jpg`;
  const $ = id => document.getElementById(id);

  const els = {
    reader: $('reader'), book: $('book'), stage: $('bookStage'), loading: $('loading'),
    leftPage: $('leftPage'), rightPage: $('rightPage'), leftImage: $('leftImage'), rightImage: $('rightImage'),
    leftNumber: $('leftNumber'), rightNumber: $('rightNumber'), pageInput: $('pageInput'),
    first: $('firstBtn'), prev: $('prevBtn'), next: $('nextBtn'), last: $('lastBtn'),
    edgePrev: $('edgePrev'), edgeNext: $('edgeNext'), zoomIn: $('zoomInBtn'), zoomOut: $('zoomOutBtn'),
    resetZoom: $('resetZoomBtn'), zoomLabel: $('zoomLabel'), fullscreen: $('fullscreenBtn'),
    thumb: $('thumbBtn'), closeThumb: $('closeThumbBtn'), panel: $('thumbnailPanel'), grid: $('thumbnailGrid'), scrim: $('scrim')
  };

  let anchor = 1;
  let zoom = 1;
  let animating = false;
  let touchStartX = 0;
  let touchStartY = 0;
  const loaded = new Set();

  const spreadFor = page => {
    const p = Math.max(1, Math.min(TOTAL, Math.round(Number(page) || 1)));
    if (p === 1) return [null, 1];
    if (p === TOTAL) return [TOTAL, null];
    return p % 2 === 0 ? [p, p + 1] : [p - 1, p];
  };

  const currentPages = () => spreadFor(anchor);

  function setPage(figure, image, number, page) {
    if (!page) {
      figure.classList.add('is-empty');
      image.removeAttribute('src');
      image.alt = '';
      number.textContent = '';
      return;
    }
    figure.classList.remove('is-empty');
    image.alt = `Eminent Tea catalogue page ${page}`;
    image.src = imagePath(page);
    number.textContent = page;
    image.onload = () => {
      loaded.add(page);
      const [left, right] = currentPages();
      if ((!left || loaded.has(left)) && (!right || loaded.has(right))) els.loading.classList.add('is-hidden');
    };
  }

  function preloadAround(page) {
    for (let p = Math.max(1, page - 3); p <= Math.min(TOTAL, page + 4); p += 1) {
      if (loaded.has(p)) continue;
      const img = new Image();
      img.onload = () => loaded.add(p);
      img.src = imagePath(p);
    }
  }

  function updateButtons() {
    const atFirst = anchor <= 1;
    const atLast = anchor >= TOTAL;
    [els.first, els.prev, els.edgePrev].forEach(btn => btn.disabled = atFirst);
    [els.last, els.next, els.edgeNext].forEach(btn => btn.disabled = atLast);
  }

  function markThumbnail() {
    els.grid.querySelectorAll('.thumb').forEach(button => {
      const p = Number(button.dataset.page);
      const [left, right] = currentPages();
      button.classList.toggle('is-current', p === left || p === right);
    });
  }

  function render() {
    const [left, right] = currentPages();
    els.loading.classList.remove('is-hidden');
    setPage(els.leftPage, els.leftImage, els.leftNumber, left);
    setPage(els.rightPage, els.rightImage, els.rightNumber, right);
    els.pageInput.value = anchor;
    updateButtons();
    markThumbnail();
    preloadAround(anchor);
    const titlePages = [left, right].filter(Boolean).join('–');
    document.title = `Eminent Tea Catalogue · Page ${titlePages}`;
  }

  function goTo(page, direction = null) {
    const target = Math.max(1, Math.min(TOTAL, Math.round(Number(page) || 1)));
    if (target === anchor || animating) return;
    const dir = direction || (target > anchor ? 'next' : 'prev');
    animating = true;
    els.book.classList.add(dir === 'next' ? 'turn-next' : 'turn-prev');
    window.setTimeout(() => {
      anchor = target;
      render();
    }, 205);
    window.setTimeout(() => {
      els.book.classList.remove('turn-next', 'turn-prev');
      animating = false;
    }, 440);
  }

  const next = () => goTo(anchor === 1 ? 2 : Math.min(TOTAL, anchor + 2), 'next');
  const prev = () => goTo(anchor <= 2 ? 1 : anchor - 2, 'prev');

  function setZoom(value) {
    zoom = Math.max(.75, Math.min(2.5, Math.round(value * 100) / 100));
    els.book.style.setProperty('--scale', zoom);
    els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    els.zoomOut.disabled = zoom <= .75;
    els.zoomIn.disabled = zoom >= 2.5;
  }

  function openThumbnails(open) {
    els.panel.classList.toggle('is-open', open);
    els.panel.setAttribute('aria-hidden', String(!open));
    els.thumb.setAttribute('aria-expanded', String(open));
    els.scrim.hidden = !open;
    if (open) {
      const current = els.grid.querySelector('.is-current');
      current?.scrollIntoView({ block: 'center' });
      els.closeThumb.focus();
    } else {
      els.thumb.focus();
    }
  }

  function buildThumbnails() {
    const fragment = document.createDocumentFragment();
    for (let p = 1; p <= TOTAL; p += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb';
      button.dataset.page = p;
      button.setAttribute('aria-label', `Go to page ${p}`);
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = imagePath(p);
      image.alt = '';
      const label = document.createElement('span');
      label.textContent = `Page ${p}`;
      button.append(image, label);
      button.addEventListener('click', () => {
        goTo(p);
        openThumbnails(false);
      });
      fragment.appendChild(button);
    }
    els.grid.appendChild(fragment);
  }

  [els.next, els.edgeNext].forEach(btn => btn.addEventListener('click', next));
  [els.prev, els.edgePrev].forEach(btn => btn.addEventListener('click', prev));
  els.first.addEventListener('click', () => goTo(1, 'prev'));
  els.last.addEventListener('click', () => goTo(TOTAL, 'next'));
  els.pageInput.addEventListener('change', event => goTo(event.target.value));
  els.pageInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { goTo(event.target.value); event.target.blur(); }
  });
  els.zoomIn.addEventListener('click', () => setZoom(zoom + .25));
  els.zoomOut.addEventListener('click', () => setZoom(zoom - .25));
  els.resetZoom.addEventListener('click', () => setZoom(1));
  els.thumb.addEventListener('click', () => openThumbnails(!els.panel.classList.contains('is-open')));
  els.closeThumb.addEventListener('click', () => openThumbnails(false));
  els.scrim.addEventListener('click', () => openThumbnails(false));

  els.fullscreen.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await els.reader.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) { /* Fullscreen can be blocked by the browser. */ }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    els.fullscreen.textContent = active ? '×' : '⛶';
    els.fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  });

  document.addEventListener('keydown', event => {
    if (event.target.matches('input')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); prev(); }
    if (event.key === 'Home') { event.preventDefault(); goTo(1, 'prev'); }
    if (event.key === 'End') { event.preventDefault(); goTo(TOTAL, 'next'); }
    if (event.key === 'Escape' && els.panel.classList.contains('is-open')) openThumbnails(false);
    if (event.key === '+' || event.key === '=') setZoom(zoom + .25);
    if (event.key === '-') setZoom(zoom - .25);
  });

  els.stage.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });
  els.stage.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      if (dx < 0) next(); else prev();
    }
  }, { passive: true });

  buildThumbnails();
  setZoom(1);
  render();
})();
