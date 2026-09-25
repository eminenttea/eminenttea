/* Eminent catalogue: local assets only; no flipbook service or remote scripts. */
(() => {
  "use strict";
  const { TOTAL, LAST, clamp, indexFor, spreadFor, fitSpread, coverOffset } = window.EminentReaderCore;
  const $ = id => document.getElementById(id);
  const app = $("app"), stage = $("bookStage"), book = $("book"), panLayer = $("panLayer");
  const leaf = $("turnLeaf"), shadow = $("turnShadow");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cache = new Map(), pointers = new Map();
  let current = 0, currentURLs = [null, null], size = { width: 800, height: 365 };
  let zoom = 1, panX = 0, panY = 0, busy = false, turn = null, gesture = null;
  let sequence = 0, animation = 0, resizeFrame = 0, toastTimer = 0, resizeTimer = 0;
  let retryIndex = 0, hasLoaded = false, thumbsBuilt = false, expanded = false;
  const nameFor = page => "page-" + String(page).padStart(2, "0");
  const pathFor = (page, original) => original ? "pages/" + nameFor(page) + ".jpg" : "previews/" + nameFor(page) + ".webp";

  function loadImage(page, original = false) {
    if (!page) return Promise.resolve(null);
    const key = (original ? "full-" : "preview-") + page;
    if (cache.has(key)) return cache.get(key);
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      let timer;
      const finish = (ok, url) => {
        clearTimeout(timer);
        img.onload = img.onerror = null;
        if (ok) resolve(url);
        else reject(new Error("Page " + page + " could not be loaded."));
      };
      const start = url => {
        clearTimeout(timer);
        img.onload = () => finish(true, url);
        img.onerror = () => {
          if (!original && url.endsWith(".webp")) start(pathFor(page, true));
          else finish(false);
        };
        timer = setTimeout(() => finish(false), 20000);
        img.src = url;
      };
      start(pathFor(page, original));
    }).catch(error => { cache.delete(key); throw error; });
    cache.set(key, promise);
    // Keep promises/URLs, not decoded image elements. Bound the bookkeeping.
    while (cache.size > 20) cache.delete(cache.keys().next().value);
    return promise;
  }
  const loadSpread = index => Promise.all(spreadFor(index).map(page => loadImage(page)));

  function putImage(side, page, url) {
    const frame = $(side + "Page"), img = $(side + "Image");
    frame.classList.toggle("is-empty", !page || !url);
    if (page && url) {
      img.alt = "Eminent catalogue, page " + page + " of " + TOTAL;
      if (img.getAttribute("src") !== url) img.src = url;
    } else {
      img.removeAttribute("src");
      img.alt = "";
    }
  }
  function showSpread(index, urls) {
    const pages = spreadFor(index);
    putImage("left", pages[0], urls[0]);
    putImage("right", pages[1], urls[1]);
    $("spine").hidden = !pages[0] || !pages[1];
  }
  function prefetchNeighbours() {
    // At most the next and previous spread, using small WebP previews.
    [current - 1, current + 1].filter(i => i >= 0 && i <= LAST).forEach(i => {
      loadSpread(i).catch(() => {}); // A visible request will report a failure.
    });
  }
  function applyPan() {
    const style = getComputedStyle(stage);
    const roomW = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const roomH = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const visibleWidth = current === 0 || current === LAST ? size.width / 2 : size.width;
    const limitX = Math.max(0, (visibleWidth * zoom - roomW) / 2);
    const limitY = Math.max(0, (size.height * zoom - roomH) / 2);
    panX = clamp(panX, -limitX, limitX);
    panY = clamp(panY, -limitY, limitY);
    panLayer.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + zoom + ")";
    stage.classList.toggle("is-zoomed", zoom > 1.01);
  }
  function updateUI() {
    const pages = spreadFor(current);
    $("pageInput").value = pages[0] || pages[1];
    $("spreadLabel").textContent = current === 0 ? "Cover · 1 / 64" : current === LAST ? "Back cover · 64 / 64" : "Pages " + pages[0] + "–" + pages[1] + " / 64";
    ["firstBtn", "prevBtn", "edgePrev"].forEach(id => $(id).disabled = busy || !hasLoaded || current === 0);
    ["lastBtn", "nextBtn", "edgeNext"].forEach(id => $(id).disabled = busy || !hasLoaded || current === LAST);
    $("zoomOutBtn").disabled = busy || zoom <= 1.01;
    $("zoomInBtn").disabled = busy || !hasLoaded || zoom >= 3;
    $("resetZoomBtn").disabled = busy || zoom <= 1.01;
    $("zoomLabel").value = Math.round(zoom * 100) + "%";
    $("pageInput").disabled = busy;
    stage.setAttribute("aria-busy", String(busy));
    if (thumbsBuilt) {
      $("thumbnailGrid").querySelectorAll("button").forEach(button => {
        if (pages.includes(Number(button.dataset.page))) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4200);
  }
  function resetZoom() {
    zoom = 1; panX = 0; panY = 0;
    applyPan();
    if (hasLoaded && !turn) showSpread(current, currentURLs);
    updateUI();
  }
  function setZoom(value, focusX = 0, focusY = 0) {
    if (busy || !hasLoaded) return;
    const oldZoom = zoom;
    zoom = clamp(value, 1, 3);
    panX = focusX - (focusX - panX) * zoom / oldZoom;
    panY = focusY - (focusY - panY) * zoom / oldZoom;
    if (zoom <= 1.01) { zoom = 1; panX = panY = 0; }
    applyPan();
    updateUI();
    const index = current;
    if (zoom > 1.2) {
      Promise.all(spreadFor(index).map(page => loadImage(page, true))).then(urls => {
        if (current === index && zoom > 1.2 && !busy) showSpread(index, urls);
      }).catch(() => toast("The high-resolution image is unavailable. Showing the preview."));
    } else showSpread(current, currentURLs);
  }

  function progressTurn(progress) {
    if (!turn) return;
    turn.progress = clamp(progress, 0, 1);
    const p = turn.progress;
    leaf.style.transform = "rotateY(" + (turn.direction > 0 ? -180 * p : 180 * p) + "deg)";
    leaf.style.setProperty("--shade", String(Math.sin(Math.PI * p) * .6));
    shadow.style.opacity = String(Math.sin(Math.PI * p) * .55);
    const offset = coverOffset(turn.from, size.width) * (1 - p) + coverOffset(turn.to, size.width) * p;
    book.style.transform = "translateX(" + offset + "px)";
  }
  function startTurn(target, urls, direction) {
    turn = { from: current, to: target, urls, direction, progress: 0 };
    const oldPages = spreadFor(current), newPages = spreadFor(target);
    $("leafFront").src = currentURLs[direction > 0 ? 1 : 0];
    $("leafBack").src = urls[direction > 0 ? 0 : 1];
    if (direction > 0) {
      putImage("left", oldPages[0], currentURLs[0]);
      putImage("right", newPages[1], urls[1]);
    } else {
      putImage("left", newPages[0], urls[0]);
      putImage("right", oldPages[1], currentURLs[1]);
    }
    $("spine").hidden = true;
    leaf.className = "turn-leaf " + (direction > 0 ? "forward" : "backward");
    leaf.hidden = false;
    shadow.hidden = false;
    progressTurn(0);
  }
  function finishTurn(commit) {
    if (!turn) return;
    if (commit) { current = turn.to; currentURLs = turn.urls; }
    turn = null;
    leaf.hidden = shadow.hidden = true;
    leaf.style.transform = "";
    book.style.transform = "translateX(" + coverOffset(current, size.width) + "px)";
    showSpread(current, currentURLs);
    busy = false;
    gesture = null;
    stage.classList.remove("is-dragging");
    updateUI();
    prefetchNeighbours();
  }
  function settleTurn(commit) {
    if (!turn) return;
    cancelAnimationFrame(animation);
    const activeTurn = turn;
    const from = turn.progress, to = commit ? 1 : 0;
    if (reducedMotion.matches) { finishTurn(commit); return; }
    const duration = Math.max(160, Math.abs(to - from) * 560);
    let began;
    const tick = time => {
      if (turn !== activeTurn) return;
      if (began === undefined) began = time;
      const elapsed = clamp((time - began) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      progressTurn(from + (to - from) * eased);
      if (elapsed < 1) animation = requestAnimationFrame(tick);
      else finishTurn(commit);
    };
    animation = requestAnimationFrame(tick);
  }
  function reportError(target) {
    retryIndex = target;
    $("errorMessage").textContent = "Could not load these pages. Check your connection and that all catalogue folders were uploaded.";
    $("pageError").hidden = false;
  }
  async function navigate(target, drag = null) {
    target = clamp(target, 0, LAST);
    if (busy || (hasLoaded && target === current)) return;
    resetZoom();
    busy = true;
    const token = ++sequence;
    $("pageError").hidden = true;
    $("loading").hidden = false;
    updateUI();
    try {
      const urls = await loadSpread(target);
      if (token !== sequence) return;
      $("loading").hidden = true;
      if (hasLoaded && Math.abs(target - current) === 1 && (!reducedMotion.matches || drag)) {
        startTurn(target, urls, Math.sign(target - current));
        if (drag) {
          drag.ready = true;
          progressTurn(drag.progress);
          if (drag.ended) settleTurn(drag.commit);
        } else settleTurn(true);
      } else {
        current = target; currentURLs = urls; hasLoaded = true;
        busy = false;
        showSpread(current, currentURLs);
        book.style.transform = "translateX(" + coverOffset(current, size.width) + "px)";
        updateUI();
        prefetchNeighbours();
      }
    } catch (error) {
      if (token !== sequence) return;
      busy = false; gesture = null;
      $("loading").hidden = true;
      stage.classList.remove("is-dragging");
      reportError(target);
      updateUI();
    }
  }
  function cancelInteraction() {
    sequence++;
    cancelAnimationFrame(animation);
    if (turn) finishTurn(false);
    busy = false;
    gesture = null;
    pointers.clear();
    $("loading").hidden = true;
    stage.classList.remove("is-dragging");
    if (hasLoaded) { showSpread(current, currentURLs); updateUI(); }
  }

  const pointDistance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  stage.addEventListener("pointerdown", event => {
    if (event.target.closest("button") || !hasLoaded || (event.pointerType === "mouse" && event.button !== 0)) return;
    // An active one-finger turn may be cancelled to begin a two-finger pinch.
    if (busy && !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { stage.setPointerCapture(event.pointerId); } catch (_) {}
    if (pointers.size === 2) {
      const points = Array.from(pointers.values());
      if (turn) finishTurn(false);
      sequence++; busy = false; $("loading").hidden = true;
      gesture = { type: "pinch", distance: pointDistance(points), zoom, panX, panY,
        midX: (points[0].x + points[1].x) / 2, midY: (points[0].y + points[1].y) / 2 };
      updateUI();
      return;
    }
    if (pointers.size > 2 || busy) return;
    if (zoom > 1.01) {
      gesture = { type: "pan", x: event.clientX, y: event.clientY, panX, panY };
    } else {
      const rect = book.getBoundingClientRect(), relativeX = event.clientX - rect.left;
      const direction = relativeX > rect.width / 2 ? 1 : -1;
      const page = spreadFor(current)[direction > 0 ? 1 : 0];
      if (!page || relativeX < 0 || relativeX > rect.width || event.clientY < rect.top || event.clientY > rect.bottom) {
        gesture = null; return;
      }
      gesture = { type: "turn", x: event.clientX, y: event.clientY, direction, progress: 0,
        started: false, ready: false, ended: false, commit: false, began: performance.now() };
    }
  });
  stage.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    if (event.cancelable) event.preventDefault();
    if (gesture.type === "pinch") {
      if (pointers.size !== 2) return;
      const points = Array.from(pointers.values()), rect = stage.getBoundingClientRect();
      const midX = (points[0].x + points[1].x) / 2, midY = (points[0].y + points[1].y) / 2;
      const factor = clamp(gesture.zoom * pointDistance(points) / Math.max(1, gesture.distance), 1, 3) / gesture.zoom;
      zoom = clamp(gesture.zoom * factor, 1, 3);
      panX = gesture.panX * factor + (gesture.midX - rect.left - rect.width / 2) * (1 - factor) + midX - gesture.midX;
      panY = gesture.panY * factor + (gesture.midY - rect.top - rect.height / 2) * (1 - factor) + midY - gesture.midY;
      applyPan(); updateUI();
    } else if (gesture.type === "pan") {
      panX = gesture.panX + event.clientX - gesture.x;
      panY = gesture.panY + event.clientY - gesture.y;
      applyPan();
      stage.classList.add("is-dragging");
    } else if (gesture.type === "turn") {
      const delta = (gesture.x - event.clientX) * gesture.direction;
      const vertical = Math.abs(event.clientY - gesture.y);
      if (!gesture.started && delta > 6 && delta > vertical) {
        gesture.started = true;
        stage.classList.add("is-dragging");
        navigate(current + gesture.direction, gesture);
      }
      gesture.progress = clamp(delta / Math.max(1, size.width / 2), 0, 1);
      if (gesture.ready && turn) progressTurn(gesture.progress);
    }
  }, { passive: false });
  function endPointer(event, cancelled) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { stage.releasePointerCapture(event.pointerId); } catch (_) {}
    if (!gesture) return;
    if (gesture.type === "pinch") {
      if (pointers.size === 0) { gesture = null; setZoom(zoom); }
      return;
    }
    if (gesture.type === "pan") {
      gesture = null; stage.classList.remove("is-dragging"); return;
    }
    const drag = gesture;
    if (drag.started) {
      drag.ended = true;
      const travelled = (drag.x - event.clientX) * drag.direction;
      const velocity = travelled / Math.max(1, performance.now() - drag.began);
      drag.commit = !cancelled && (drag.progress > .25 || (travelled > 35 && velocity > .45));
      if (drag.ready) settleTurn(drag.commit);
    } else {
      gesture = null;
      // A tap near either outside edge also turns a page.
      const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      const rect = book.getBoundingClientRect();
      const atEdge = drag.direction > 0 ? event.clientX > rect.left + rect.width * .8 : event.clientX < rect.left + rect.width * .2;
      if (!cancelled && moved < 8 && atEdge) navigate(current + drag.direction);
    }
  }
  stage.addEventListener("pointerup", event => endPointer(event, false));
  stage.addEventListener("pointercancel", event => endPointer(event, true));
  stage.addEventListener("lostpointercapture", event => {
    if (pointers.has(event.pointerId)) endPointer(event, true);
  });

  ["nextBtn", "edgeNext"].forEach(id => $(id).addEventListener("click", () => navigate(current + 1)));
  ["prevBtn", "edgePrev"].forEach(id => $(id).addEventListener("click", () => navigate(current - 1)));
  $("firstBtn").addEventListener("click", () => navigate(0));
  $("lastBtn").addEventListener("click", () => navigate(LAST));
  $("retryBtn").addEventListener("click", () => navigate(retryIndex));
  $("pageForm").addEventListener("submit", event => {
    event.preventDefault();
    const value = $("pageInput").value.trim();
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > TOTAL) {
      toast("Enter a page number from 1 to 64."); updateUI(); return;
    }
    $("pageInput").blur();
    navigate(indexFor(value));
  });
  $("pageInput").addEventListener("focus", event => event.target.select());
  $("zoomInBtn").addEventListener("click", () => setZoom(zoom + .35));
  $("zoomOutBtn").addEventListener("click", () => setZoom(zoom - .35));
  $("resetZoomBtn").addEventListener("click", resetZoom);

  function openThumbnails() {
    if (!thumbsBuilt) {
      const fragment = document.createDocumentFragment();
      for (let page = 1; page <= TOTAL; page++) {
        const button = document.createElement("button"), img = document.createElement("img"), text = document.createElement("span");
        button.className = "thumb"; button.type = "button"; button.dataset.page = page;
        button.setAttribute("aria-label", "Open page " + page);
        img.src = "thumbnails/" + nameFor(page) + ".webp"; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
        img.width = 260; img.height = 237;
        text.textContent = "Page " + page;
        button.append(img, text);
        button.addEventListener("click", () => { $("thumbnailPanel").close(); navigate(indexFor(page)); });
        fragment.append(button);
      }
      $("thumbnailGrid").append(fragment);
      thumbsBuilt = true;
    }
    updateUI();
    $("thumbnailPanel").showModal();
    const active = $("thumbnailGrid").querySelector('[aria-current="page"]');
    if (active) active.scrollIntoView({ block: "nearest" });
  }
  $("thumbBtn").addEventListener("click", openThumbnails);
  $("closeThumbBtn").addEventListener("click", () => $("thumbnailPanel").close());
  $("thumbnailPanel").addEventListener("click", event => {
    if (event.target !== $("thumbnailPanel")) return;
    const r = event.target.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close();
  });

  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function fullscreenChanged() {
    expanded = Boolean(fullscreenElement()) || app.classList.contains("is-expanded");
    $("fullscreenBtn").setAttribute("aria-pressed", String(expanded));
    $("fullscreenBtn").setAttribute("aria-label", expanded ? "Exit fullscreen" : "Enter fullscreen");
    $("fullscreenBtn").title = expanded ? "Exit fullscreen" : "Fullscreen";
    $("fullscreenIcon").setAttribute("href", expanded ? "#i-close" : "#i-expand");
    scheduleFit();
  }
  async function toggleFullscreen() {
    if (fullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { try { await exit.call(document); } catch (_) { toast("Use your browser's fullscreen control to exit."); } }
      return;
    }
    if (app.classList.contains("is-expanded")) {
      app.classList.remove("is-expanded"); fullscreenChanged(); return;
    }
    const request = app.requestFullscreen || app.webkitRequestFullscreen;
    if (request) {
      try { await request.call(app); fullscreenChanged(); return; } catch (_) { /* use expanded reading mode */ }
    }
    app.classList.add("is-expanded");
    fullscreenChanged();
    toast("Expanded reader. This browser may keep its address bar visible.");
  }
  $("fullscreenBtn").addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", fullscreenChanged);
  document.addEventListener("webkitfullscreenchange", fullscreenChanged);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && app.classList.contains("is-expanded")) {
      app.classList.remove("is-expanded"); fullscreenChanged(); return;
    }
    if (event.target.closest("input,textarea,select") || $("thumbnailPanel").open || event.metaKey || event.ctrlKey || event.altKey) return;
    const actions = {
      ArrowRight: () => navigate(current + 1), PageDown: () => navigate(current + 1),
      ArrowLeft: () => navigate(current - 1), PageUp: () => navigate(current - 1),
      Home: () => navigate(0), End: () => navigate(LAST),
      "+": () => setZoom(zoom + .35), "=": () => setZoom(zoom + .35),
      "-": () => setZoom(zoom - .35), "0": resetZoom
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });

  function fit() {
    const style = getComputedStyle(stage);
    const width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const next = fitSpread(Math.max(1, width), Math.max(1, height));
    if (Math.abs(next.width - size.width) < .5 && Math.abs(next.height - size.height) < .5) return;
    // Finish resizing at a stable spread; never leave a half-turned page.
    if (hasLoaded) cancelInteraction();
    size = next;
    panLayer.style.width = size.width + "px";
    panLayer.style.height = size.height + "px";
    book.style.transform = "translateX(" + coverOffset(current, size.width) + "px)";
    zoom = 1; panX = panY = 0;
    applyPan(); updateUI();
  }
  function scheduleFit() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fit);
  }
  function viewportChanged() {
    // visualViewport accounts for Safari's moving browser bars and the keyboard.
    // Do not fight the user's native browser/page zoom.
    const viewport = window.visualViewport;
    if (!viewport || Math.abs(viewport.scale - 1) < .01) {
      document.documentElement.style.setProperty("--app-height", (viewport ? viewport.height : window.innerHeight) + "px");
    }
    scheduleFit();
  }
  if ("ResizeObserver" in window) new ResizeObserver(scheduleFit).observe(stage);
  window.addEventListener("resize", viewportChanged);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", viewportChanged);
  window.addEventListener("orientationchange", () => {
    viewportChanged();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(viewportChanged, 350);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && hasLoaded && gesture) cancelInteraction();
  });
  viewportChanged();
  fit();
  navigate(0);
})();
