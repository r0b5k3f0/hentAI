// hentAI Gallery
// 讀取 images/manifest.json（由 tools/generate_manifest.py 產生）並提供搜尋、排序與燈箱。
(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 設定                                                                */
  /* ------------------------------------------------------------------ */
  const MANIFEST_URL = 'images/manifest.json';
  const META_URL = 'images/meta.json';
  const SEARCH_DEBOUNCE_MS = 150;

  // 沒有 manifest 時的備援掃描參數：依編號遞增探測，連續幾個編號都沒有就停止。
  const SCAN = { exts: ['jpg', 'jpeg', 'png', 'webp'], maxNumber: 999, stopAfterMisses: 5 };

  // 必須和 style.css 的欄數斷點一致，瀏覽器才能從 srcset 挑到正確尺寸。
  const SIZES = [
    '(min-width: 1100px) 280px',
    '(min-width: 860px) calc((100vw - 72px) / 3)',
    '(min-width: 560px) calc((100vw - 56px) / 2)',
    'calc(100vw - 40px)',
  ].join(', ');

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const ui = {
    gallery: $('gallery'),
    search: $('search'),
    sort: $('sort'),
    status: $('status'),
    empty: $('empty'),
    year: $('year'),
    lightbox: $('lightbox'),
    lbImg: $('lightbox-img'),
    lbCaption: $('lightbox-caption'),
    lbCounter: $('lightbox-counter'),
    lbPrev: $('lightbox-prev'),
    lbNext: $('lightbox-next'),
    lbClose: $('lightbox-close'),
  };

  if (ui.year) ui.year.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------------ */
  /* 狀態                                                                */
  /* ------------------------------------------------------------------ */
  let allImages = [];     // 正規化後的完整清單（manifest 順序）
  let sortedImages = [];  // 套用排序後的清單；隨機模式只在切換時洗一次，搜尋時不會重洗
  let currentList = [];   // 目前畫面上的清單（排序 + 搜尋）
  let currentIndex = -1;  // 燈箱目前的 index（相對於 currentList）
  let lastFocused = null; // 開燈箱前的焦點元素，關閉後還原
  const cardCache = new Map(); // item -> <figure>，搜尋／排序時重用節點而不是重建

  /* ------------------------------------------------------------------ */
  /* 工具                                                                */
  /* ------------------------------------------------------------------ */
  const fileName = (src) => src.split('/').pop();
  const stem = (name) => {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : name;
  };
  const titleFromSrc = (src) => stem(fileName(src)).replace(/[-_]+/g, ' ').trim() || src;
  const naturalCompare = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

  function normalizeTags(tags) {
    if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
    if (typeof tags === 'string') return tags.split(/[\s,，、]+/).filter(Boolean);
    return [];
  }

  // 把 manifest 的一筆資料整理成前端用的物件；格式不對就回傳 null 略過。
  function normalizeItem(raw) {
    if (!raw || typeof raw.src !== 'string' || !raw.src) return null;
    const item = {
      src: raw.src,
      width: Number(raw.width) || 0,
      height: Number(raw.height) || 0,
      title: (typeof raw.title === 'string' && raw.title.trim()) || titleFromSrc(raw.src),
      tags: normalizeTags(raw.tags),
      thumb: null,
    };
    const t = raw.thumb;
    if (t && typeof t === 'object' && typeof t.src === 'string' && t.src && t.src !== item.src) {
      item.thumb = { src: t.src, width: Number(t.width) || 0, height: Number(t.height) || 0 };
    } else if (typeof t === 'string' && t && t !== item.src) {
      item.thumb = { src: t, width: 0, height: 0 };
    }
    item.searchText = [item.title, item.tags.join(' '), fileName(item.src)].join(' ').toLowerCase();
    return item;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function setStatus(text) {
    if (ui.status) ui.status.textContent = text;
  }

  /* ------------------------------------------------------------------ */
  /* 載入                                                                */
  /* ------------------------------------------------------------------ */
  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-cache' }); // 走 ETag 驗證，不用每次重抓
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  }

  // 不加 cache-buster：探測成功的 URL 之後就是畫面上要用的 URL，等於順便預先載入。
  function probeImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // 備援：images/01.jpg、images/1.jpg … 依編號探測，連續 N 個編號都沒有就停。
  async function discoverImages() {
    const found = [];
    let misses = 0;
    for (let n = 1; n <= SCAN.maxNumber && misses < SCAN.stopAfterMisses; n++) {
      const names = new Set([String(n).padStart(2, '0'), String(n)]);
      const candidates = [];
      for (const name of names) for (const ext of SCAN.exts) candidates.push(`images/${name}.${ext}`);
      const hits = (await Promise.all(candidates.map(probeImage))).filter(Boolean);
      if (hits.length) {
        found.push(...hits);
        misses = 0;
      } else {
        misses++;
      }
    }
    return found;
  }

  async function loadImages() {
    setStatus('載入圖片清單中…');

    // 1) 優先讀 manifest.json
    try {
      const data = await fetchJson(MANIFEST_URL);
      const items = (Array.isArray(data) ? data : []).map(normalizeItem).filter(Boolean);
      if (items.length) return items;
      console.warn('[gallery] manifest.json 是空的，改用自動掃描。');
    } catch (err) {
      console.warn('[gallery] 無法載入 manifest.json，改用自動掃描（較慢）。', err);
    }

    // 2) 備援：自動掃描，並盡量套用 meta.json 的標題／標籤
    setStatus('找不到 manifest.json，正在掃描 images/…（執行 tools/generate_manifest.py 可加速載入）');
    let meta = {};
    try {
      const data = await fetchJson(META_URL);
      if (data && typeof data === 'object') meta = data;
    } catch (_) {
      /* 沒有 meta.json 就用檔名當標題 */
    }
    const found = await discoverImages();
    return found
      .map((f) => normalizeItem({ ...f, ...(meta[fileName(f.src)] || {}) }))
      .filter(Boolean);
  }

  /* ------------------------------------------------------------------ */
  /* 渲染                                                                */
  /* ------------------------------------------------------------------ */
  function createCard(item) {
    const fig = document.createElement('figure');
    fig.className = 'card';

    // 用 <a href=原圖> 當卡片本體：天生可聚焦、可用鍵盤開啟，沒有 JS 也能點開原圖。
    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = item.src;
    link.setAttribute('aria-label', `放大檢視：${item.title}`);

    const img = document.createElement('img');
    img.setAttribute('alt', item.title);
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    // 先給寬高，瀏覽器就能預留空間：不會跳版，lazy loading 也才判斷得出哪些圖在視窗外。
    if (item.width && item.height) {
      img.setAttribute('width', String(item.width));
      img.setAttribute('height', String(item.height));
    }
    if (item.thumb) {
      if (item.thumb.width && item.width) {
        img.setAttribute('srcset', `${item.thumb.src} ${item.thumb.width}w, ${item.src} ${item.width}w`);
        img.setAttribute('sizes', SIZES);
      }
      img.setAttribute('src', item.thumb.src);
    } else {
      img.setAttribute('src', item.src);
    }

    const cap = document.createElement('figcaption');
    cap.className = 'caption';
    cap.textContent = item.title;

    link.append(img);
    fig.append(link, cap);

    link.addEventListener('click', (e) => {
      // 保留中鍵／Ctrl／Cmd 點擊「在新分頁開啟原圖」的原生行為
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      openLightbox(currentList.indexOf(item));
    });
    return fig;
  }

  function cardFor(item) {
    let card = cardCache.get(item);
    if (!card) {
      card = createCard(item);
      cardCache.set(item, card);
    }
    return card;
  }

  function render(list) {
    currentList = list;
    ui.gallery.replaceChildren(...list.map(cardFor));

    const total = allImages.length;
    if (list.length === 0) {
      ui.empty.textContent = '找不到符合的圖片 🙈';
      ui.empty.hidden = false;
      setStatus(`符合 0 / ${total} 張`);
    } else {
      ui.empty.hidden = true;
      setStatus(list.length === total ? `共 ${total} 張` : `符合 ${list.length} / ${total} 張`);
    }
  }

  function applySort() {
    const mode = ui.sort.value;
    let list = [...allImages];
    if (mode === 'name') list.sort((a, b) => naturalCompare(a.src, b.src));
    else if (mode === 'name-desc') list.sort((a, b) => naturalCompare(b.src, a.src));
    else if (mode === 'random') list = shuffle(list);
    sortedImages = list;
  }

  function applyFilter() {
    // 空白分隔多個關鍵字，全部都要命中（AND）
    const tokens = ui.search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = tokens.length
      ? sortedImages.filter((it) => tokens.every((t) => it.searchText.includes(t)))
      : sortedImages;
    render(list);
  }

  /* ------------------------------------------------------------------ */
  /* 燈箱                                                                */
  /* ------------------------------------------------------------------ */
  function showAt(index) {
    const n = currentList.length;
    if (!n) return;
    currentIndex = ((index % n) + n) % n; // 頭尾循環
    const item = currentList[currentIndex];

    ui.lightbox.classList.add('is-loading');
    ui.lbImg.alt = item.title;
    ui.lbImg.src = item.src;
    ui.lbCaption.textContent = item.tags.length ? `${item.title} — ${item.tags.join('、')}` : item.title;
    ui.lbCounter.textContent = `${currentIndex + 1} / ${n}`;

    const single = n < 2;
    ui.lbPrev.hidden = single;
    ui.lbNext.hidden = single;

    // 預先載入前後一張，按方向鍵時就不用等
    if (!single) {
      for (const d of [1, -1]) {
        const pre = new Image();
        pre.src = currentList[(currentIndex + d + n) % n].src;
      }
    }
  }

  function openLightbox(index) {
    if (index < 0) return;
    lastFocused = document.activeElement;
    ui.lightbox.hidden = false;
    document.body.classList.add('no-scroll');
    showAt(index);
    ui.lbClose.focus();
  }

  function closeLightbox() {
    if (ui.lightbox.hidden) return;
    ui.lightbox.hidden = true;
    ui.lightbox.classList.remove('is-loading');
    ui.lbImg.removeAttribute('src');
    document.body.classList.remove('no-scroll');
    currentIndex = -1;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  // 焦點留在燈箱內循環（Tab / Shift+Tab）
  function trapFocus(e) {
    const focusables = [ui.lbPrev, ui.lbNext, ui.lbClose].filter((b) => !b.hidden);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!focusables.includes(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  ui.lbImg.addEventListener('load', () => ui.lightbox.classList.remove('is-loading'));
  ui.lbImg.addEventListener('error', () => {
    if (!ui.lbImg.getAttribute('src')) return; // 關閉時移除 src 也會觸發 error，略過
    ui.lightbox.classList.remove('is-loading');
    ui.lbCaption.textContent = '圖片載入失敗';
  });

  ui.lbClose.addEventListener('click', closeLightbox);
  ui.lbPrev.addEventListener('click', () => showAt(currentIndex - 1));
  ui.lbNext.addEventListener('click', () => showAt(currentIndex + 1));
  ui.lightbox.addEventListener('click', (e) => {
    if (e.target === ui.lightbox) closeLightbox(); // 點背景關閉
  });

  document.addEventListener('keydown', (e) => {
    if (ui.lightbox.hidden) return;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeLightbox();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        showAt(currentIndex - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        showAt(currentIndex + 1);
        break;
      case 'Tab':
        trapFocus(e);
        break;
      default:
    }
  });

  // 觸控左右滑動切換
  let touchStartX = 0;
  let touchStartY = 0;
  ui.lightbox.addEventListener(
    'touchstart',
    (e) => {
      const t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    },
    { passive: true }
  );
  ui.lightbox.addEventListener(
    'touchend',
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) showAt(currentIndex + (dx < 0 ? 1 : -1));
    },
    { passive: true }
  );

  /* ------------------------------------------------------------------ */
  /* 啟動                                                                */
  /* ------------------------------------------------------------------ */
  ui.search.addEventListener('input', debounce(applyFilter, SEARCH_DEBOUNCE_MS));
  ui.sort.addEventListener('change', () => {
    applySort();
    applyFilter();
  });

  (async () => {
    try {
      allImages = await loadImages();
    } catch (err) {
      console.error('[gallery]', err);
      allImages = [];
    }
    if (!allImages.length) {
      setStatus('找不到任何圖片');
      ui.empty.textContent =
        '找不到任何圖片 🙈 請確認 images/ 內有圖片，並執行 tools/generate_manifest.py 產生 manifest.json。';
      ui.empty.hidden = false;
      return;
    }
    applySort();
    applyFilter();
  })();
})();
