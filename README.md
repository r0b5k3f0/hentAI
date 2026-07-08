# hentAI 圖片展示

> 一個簡單、輕量、響應式的靜態圖片展示網站，使用 GitHub Pages 部署。

這是一個練功用的靜態圖庫專案。不需要後端、不需要資料庫，純 HTML / CSS / JavaScript，丟上 GitHub Pages 就能跑。

## 線上預覽

```
https://r0b5k3f0.github.io/hentAI/
```

> 注意：GitHub Pages 從 `gh-pages` 分支部署，首次推送後通常需要等個幾分鐘才會生效。

## 功能特色

- 🖼️ **響應式瀑布格**：手機、平板、桌機自動排版
- 🔍 **關鍵字搜尋**：依標題、標籤或檔名過濾
- ↕️ **多種排序**：預設 / 依檔名 / 隨機打散
- 🔎 **燈箱檢視**：點擊圖片放大，支援 ESC 關閉
- ⚡ **零相依**：沒有套件、沒有建置步驟，開箱即用

## 目錄結構

```
hentAI/
├── index.html          # 首頁（圖庫介面）
├── assets/
│   ├── style.css       # 樣式
│   └── gallery.js      # 圖片清單與互動邏輯
├── images/             # 放你的圖片（含測試圖）
├── README.md           # 本檔（繁體中文）
└── README_en.md        # 英文版說明
```

## 如何新增圖片

1. 把圖片丟進 `images/` 資料夾（建議 `jpg` / `png`，控制在 1MB 以內較順）。
2. 打開 `assets/gallery.js`，在 `IMAGES` 陣列裡加一筆：

   ```js
   { src: "images/你的圖片.jpg", title: "圖片標題", tags: "標籤1 標籤2" }
   ```

3. 推送即可，網頁會自動列出。

## 本地預覽

直接用瀏覽器打開 `index.html` 就行；或者起個簡單的本地伺服器：

```bash
# Python 3
python3 -m http.server 8000
# 然後瀏覽 http://localhost:8000
```

## 部署到 GitHub Pages

本專案內容放在 `gh-pages` 分支：

```bash
git checkout -b gh-pages
git add .
git commit -m "deploy gallery"
git push origin gh-pages
```

再到倉庫 **Settings → Pages**，Source 選 `gh-pages` / `root` 就完成了。

## 授權

本專案目前僅供練習用途。圖片為 AI 生成的測試素材，可自由替換。
