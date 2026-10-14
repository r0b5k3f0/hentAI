// Pure data helpers shared by the browser and dependency-free Node tests.
const filenameCollator = new Intl.Collator("zh-Hant", { numeric: true });

export function normalizeManifest(data) {
  if (!Array.isArray(data)) throw new TypeError("圖片清單必須是陣列");
  const seen = new Set();
  return data.map((item) => {
    if (!item || typeof item.src !== "string") {
      throw new TypeError("圖片缺少有效的 src");
    }
    // Only allow files directly inside images/, never external URLs or traversal.
    const filename = decodeURIComponent(item.src.slice(7));
    if (!item.src.startsWith("images/") || /[?#]/.test(item.src) ||
        /[/\\\u0000-\u001f\u007f]/.test(filename) ||
        !/^.+\.(jpe?g|png|webp|gif|avif)$/i.test(filename)) {
      throw new TypeError("圖片路徑無效");
    }
    const src = `images/${encodeURIComponent(filename)}`;
    if (seen.has(src)) throw new TypeError("圖片路徑重複");
    seen.add(src);
    const title = typeof item.title === "string" && item.title.trim()
      ? item.title : filename.replace(/\.[^.]+$/, "");
    const tags = Array.isArray(item.tags)
      ? item.tags.filter((tag) => typeof tag === "string").join(" ")
      : typeof item.tags === "string" ? item.tags : "";
    return {
      src, title, tags,
      searchText: `${title}\n${tags}\n${filename}`.toLocaleLowerCase(),
      filename,
    };
  });
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sortByFilename(items) {
  return [...items].sort((a, b) => filenameCollator.compare(a.filename, b.filename));
}

export function filterImages(items, query) {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized ? items.filter((item) => item.searchText.includes(normalized)) : items;
}
