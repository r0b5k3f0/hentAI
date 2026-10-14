import { normalizeManifest, shuffle, sortByFilename, filterImages } from "./gallery-data.mjs";

const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const emptyMsg = document.getElementById("empty");
const status = document.getElementById("status");
const retryButton = document.getElementById("retry");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxError = document.getElementById("lightbox-error");
const closeButton = lightbox.querySelector(".lightbox-close");

document.getElementById("year").textContent = new Date().getFullYear();

let images = [];
let orderedImages = [];
let cards = new Map();
let visibleImages = [];
let searchFrame;
let lightboxTrigger;

async function loadImages() {
  searchInput.disabled = true;
  sortSelect.disabled = true;
  retryButton.hidden = true;
  emptyMsg.hidden = true;
  gallery.setAttribute("aria-busy", "true");
  status.textContent = "正在載入圖片清單…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    // Revalidate the small manifest, while allowing browsers to cache images normally.
    const response = await fetch("images/manifest.json", {
      cache: "no-cache", signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    images = normalizeManifest(await response.json());
    cards = new Map(images.map((item) => [item.src, createCard(item)]));
    updateOrder();
    searchInput.disabled = false;
    sortSelect.disabled = false;
    applyFilters();
  } catch (error) {
    console.error("無法載入圖片清單：", error);
    status.textContent = "無法載入圖片清單。請確認網路連線與 images/manifest.json，並使用 HTTP 伺服器開啟網站。";
    retryButton.hidden = false;
  } finally {
    clearTimeout(timeout);
    gallery.setAttribute("aria-busy", "false");
  }
}

function createCard(item) {
  const card = document.createElement("figure");
  card.className = "card";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-open";
  button.dataset.src = item.src;
  button.setAttribute("aria-label", `放大檢視：${item.title}`);
  button.setAttribute("aria-haspopup", "dialog");
  const image = document.createElement("img");
  image.alt = item.title;
  image.loading = "lazy";
  image.decoding = "async";
  const error = document.createElement("span");
  error.className = "image-error";
  error.textContent = "圖片載入失敗，點擊重試檢視";
  error.hidden = true;
  image.addEventListener("error", () => {
    image.hidden = true;
    error.hidden = false;
  }, { once: true });
  button.append(image, error);
  const caption = document.createElement("figcaption");
  caption.className = "caption";
  // Metadata is text, not HTML. Never interpolate it into innerHTML.
  caption.textContent = item.title;
  card.append(button, caption);
  // Assign src only when displayed, so an initial filter does not load hidden images.
  return card;
}

function render(list) {
  const fragment = document.createDocumentFragment();
  for (const item of list) {
    const card = cards.get(item.src);
    const image = card.querySelector("img");
    if (!image.hasAttribute("src")) image.src = item.src;
    fragment.appendChild(card);
  }
  gallery.replaceChildren(fragment);
  emptyMsg.textContent = images.length ? "找不到符合的圖片 🙈" : "圖庫目前沒有圖片。";
  emptyMsg.hidden = list.length !== 0;
  status.textContent = `顯示 ${list.length} / ${images.length} 張圖片`;
  visibleImages = list;
}

function updateOrder() {
  const mode = sortSelect.value;
  orderedImages = mode === "name" ? sortByFilename(images)
    : mode === "random" ? shuffle(images) : images;
}

function applyFilters() {
  render(filterImages(orderedImages, searchInput.value));
}

function openLightbox(item, trigger) {
  lightboxTrigger = trigger;
  lightboxError.hidden = true;
  lightboxImg.hidden = false;
  lightboxImg.alt = item.title;
  lightboxImg.src = item.src;
  lightboxCaption.textContent = item.tags ? `${item.title} — ${item.tags}` : item.title;
  // Native modal dialogs handle focus trapping, Escape, and inert background content.
  lightbox.showModal();
  document.body.classList.add("lightbox-open");
  closeButton.focus();
}

searchInput.addEventListener("input", () => {
  cancelAnimationFrame(searchFrame);
  searchFrame = requestAnimationFrame(applyFilters);
});
sortSelect.addEventListener("change", () => {
  cancelAnimationFrame(searchFrame);
  updateOrder();
  applyFilters();
});
retryButton.addEventListener("click", loadImages);
gallery.addEventListener("click", (event) => {
  const button = event.target.closest(".card")?.querySelector(".card-open");
  if (!button) return;
  const item = visibleImages.find((image) => image.src === button.dataset.src);
  if (item) openLightbox(item, button);
});
closeButton.addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
lightbox.addEventListener("close", () => {
  document.body.classList.remove("lightbox-open");
  lightboxImg.removeAttribute("src");
  lightboxTrigger?.focus();
});
lightboxImg.addEventListener("error", () => {
  if (!lightbox.open) return;
  lightboxImg.hidden = true;
  lightboxError.hidden = false;
});

loadImages();
