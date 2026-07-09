// hentAI Gallery - 自動掃描版
const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const emptyMsg = document.getElementById("empty");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");

document.getElementById("year").textContent = new Date().getFullYear();

let IMAGES = [];

// 預設 metadata：有提供就用，沒有就用檔名自動生成
const META_FALLBACK = {
  "images/01.jpg": { title: "晨曦山湖", tags: "風景 自然 山 湖" },
  "images/02.jpg": { title: "藍紫流波", tags: "抽象 數位藝術 漸層" },
  "images/03.jpg": { title: "霓虹夜城", tags: "城市 賽博龐克 夜景" },
  "images/04.jpg": { title: "向日葵花田", tags: "自然 花 暖色" },
  "images/05.jpg": { title: "極簡和室", tags: "室內 日式 禪" },
  "images/06.jpg": { title: "宇宙星雲", tags: "星空 太空 星雲" },
  "images/07.jpg": { title: "枯山水庭園", tags: "日式 禪 庭園" },
  "images/08.jpg": { title: "雨夜市集", tags: "城市 賽博龐克 夜景 台北" },
  "images/09.jpg": { title: "流體泡泡", tags: "抽象 3D 柔和" },
  "images/10.jpg": { title: "窗邊午睡貓", tags: "貓 療癒 室內" },
  "images/11.jpg": { title: "沙漠星河", tags: "星空 沙漠 銀河" },
  "images/12.jpg": { title: "北歐客廳", tags: "室內 北歐 極簡" },
  "images/13.jpg": { title: "粉髮圖書魔法師", tags: "二次元 動漫 萌系 女角 魔法" },
  "images/14.jpg": { title: "咖啡廳吧檯女孩", tags: "二次元 動漫 萌系 女角 咖啡" },
  "images/15.jpg": { title: "雪夜圍巾少女", tags: "二次元 動漫 萌系 女角 冬天" },
  "images/16.jpg": { title: "櫻花巫女", tags: "二次元 動漫 萌系 女角 和風" },
  "images/17.jpg": { title: "工坊機械師", tags: "二次元 動漫 萌系 女角 機械 科幻" },
  "images/18.jpg": { title: "森林巡守員", tags: "二次元 動漫 萌系 女角 自然" },
  "images/19.jpg": { title: "航海旗袍魔法陣", tags: "二次元 動漫 女角 PicX OnePiece 魔法" },
  "images/20.jpg": { title: "鏡中倒影", tags: "二次元 動漫 女角 PicX 鏡像" },
  "images/21.jpg": { title: "闇黑魔導女王", tags: "二次元 動漫 女角 PicX 奇幻" },
  "images/22.jpg": { title: "浮空島夕景", tags: "二次元 動漫 萌系 女角 風景 4K" },
};

function prettyTitleFromSrc(src) {
  const name = src.split('/').pop().split('.')[0];
  return name;
}

function getMeta(src) {
  return META_FALLBACK[src] || { title: prettyTitleFromSrc(src), tags: "二次元 動漫" };
}

// 嘗試載入一張圖片，回傳 true/false
function testImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src + '?v=' + Date.now(); // 避免快取誤判
  });
}

// 自動掃描 images/ 資料夾
// 策略：01-99，支援 jpg/jpeg/png/webp
async function autoDiscoverImages() {
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  const found = [];
  const maxNum = 99;

  // 並行批次偵測，避免一次爆量
  const candidates = [];
  for (let i = 1; i <= maxNum; i++) {
    const num = String(i).padStart(2, '0');
    for (const ext of exts) {
      candidates.push(`images/${num}.${ext}`);
    }
  }
  // 也嘗試無前導零的 1-99
  for (let i = 1; i <= maxNum; i++) {
    for (const ext of exts) {
      candidates.push(`images/${i}.${ext}`);
    }
  }

  // 去重
  const unique = [...new Set(candidates)];

  // 分批並行測
  const batchSize = 12;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(src => testImage(src).then(ok => ({src, ok}))));
    for (const r of results) {
      if (r.ok) found.push(r.src);
    }
  }
  
  // 依檔名排序，去重
  const deduped = [...new Set(found)].sort();
  return deduped.map(src => ({
    src,
    ...getMeta(src)
  }));
}

async function loadImages() {
  gallery.innerHTML = `<p class="empty">掃描 images/ 中…</p>`;
  try {
    // 1. 優先嘗試讀取 manifest.json (由 tools/generate_manifest.py 產生)
    const res = await fetch('images/manifest.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        IMAGES = data;
        applyFilters();
        return;
      }
    }
  } catch(e) {}
  
  // 2. Fallback: 自動掃描
  const discovered = await autoDiscoverImages();
  IMAGES = discovered;
  applyFilters();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function render(list) {
  gallery.innerHTML = "";
  if (list.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;
  list.forEach((item) => {
    const card = document.createElement("figure");
    card.className = "card";
    card.innerHTML = `
      <img src="${item.src}" alt="${item.title}" loading="lazy" />
      <figcaption class="caption">${item.title}</figcaption>
    `;
    card.addEventListener("click", () => openLightbox(item));
    gallery.appendChild(card);
  });
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  let list = IMAGES.filter((it) => {
    if (!q) return true;
    return (
      (it.title || '').toLowerCase().includes(q) ||
      (it.tags || '').toLowerCase().includes(q) ||
      it.src.toLowerCase().includes(q)
    );
  });

  const mode = sortSelect.value;
  if (mode === "name") list = [...list].sort((a, b) => a.src.localeCompare(b.src));
  else if (mode === "random") list = shuffle(list);

  render(list);
}

function openLightbox(item) {
  lightboxImg.src = item.src;
  lightboxImg.alt = item.title;
  lightboxCaption.textContent = `${item.title} — ${item.tags || ''}`;
  lightbox.hidden = false;
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = "";
}

searchInput.addEventListener("input", applyFilters);
sortSelect.addEventListener("change", applyFilters);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox || e.target.classList.contains("lightbox-close")) {
    closeLightbox();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

// 啟動
loadImages();
