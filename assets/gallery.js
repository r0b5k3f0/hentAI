// 圖片清單：新增圖片時，把檔名與標題加進這裡即可
const IMAGES = [
  { src: "images/01.jpg", title: "晨曦山湖", tags: "風景 自然 山 湖" },
  { src: "images/02.jpg", title: "藍紫流波", tags: "抽象 數位藝術 漸層" },
  { src: "images/03.jpg", title: "霓虹夜城", tags: "城市 賽博龐克 夜景" },
  { src: "images/04.jpg", title: "向日葵花田", tags: "自然 花 暖色" },
  { src: "images/05.jpg", title: "極簡和室", tags: "室內 日式 禪" },
  { src: "images/06.jpg", title: "宇宙星雲", tags: "星空 太空 星雲" },
];

const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const emptyMsg = document.getElementById("empty");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");

document.getElementById("year").textContent = new Date().getFullYear();

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
      it.title.toLowerCase().includes(q) ||
      it.tags.toLowerCase().includes(q) ||
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
  lightboxCaption.textContent = `${item.title} — ${item.tags}`;
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

applyFilters();
