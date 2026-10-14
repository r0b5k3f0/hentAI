# hentAI 圖片展示

> 一個簡單、輕量、響應式的靜態圖片展示網站，使用 GitHub Pages 部署。

這是一個練功用的靜態圖庫專案。不需要後端、不需要資料庫，純 HTML / CSS / JavaScript，丟上 GitHub Pages 就能跑。

## 線上預覽

```
https://r0b5k3f0.github.io/hentAI/
```

> 注意：GitHub Pages 從 `gh-pages` 分支部署，推送後通常需要等個幾分鐘才會生效。

## 功能特色

- 🖼️ **響應式瀑布格**：手機、平板、桌機自動排版；圖片事先知道尺寸，載入時不會跳版
- ⚡ **自動縮圖**：格狀檢視載入 WebP 縮圖（整體約為原圖的 1/4），點開燈箱才載原圖
- 🔍 **關鍵字搜尋**：依標題、標籤或檔名過濾；用空白分隔可同時下多個關鍵字
- ↕️ **多種排序**：預設（`meta.json` 的順序）/ 依檔名 A→Z / Z→A / 隨機打散
- 🔎 **燈箱檢視**：點擊放大，支援 ← → 切換、Esc 關閉、手機左右滑動
- ♿ **鍵盤與輔助科技友善**：卡片可用 Tab 聚焦、Enter 開啟；燈箱有焦點管理與 ARIA 標記
- 🤖 **自動維護**：圖片丟進 `images/` 推上去，GitHub Actions 自動產生清單與縮圖
- 📦 **前端零相依**：沒有框架、沒有打包工具

## 目錄結構

```
hentAI/
├── index.html                  # 首頁（圖庫介面）
├── assets/
│   ├── style.css               # 樣式
│   └── gallery.js              # 互動邏輯（讀取 manifest、搜尋、排序、燈箱）
├── images/
│   ├── 01.jpg … 22.jpg         # 你的圖片（含測試圖）
│   ├── meta.json               # ✏️ 標題／標籤設定（你要編輯的是這個）
│   ├── manifest.json           # 🤖 自動產生的圖片清單（不要手改）
│   └── thumbs/                 # 🤖 自動產生的 WebP 縮圖（不要手改）
├── tools/
│   ├── generate_manifest.py    # 產生 manifest.json 與縮圖的腳本
│   └── requirements.txt        # 腳本相依（Pillow，只有產縮圖需要）
├── .github/workflows/
│   └── generate-manifest.yml   # 推送圖片後自動執行上面的腳本並提交結果
├── .nojekyll                   # 讓 GitHub Pages 跳過 Jekyll，直接提供靜態檔
├── README.md                   # 本檔（繁體中文）
└── README_en.md                # 英文版說明
```

## 如何新增圖片

1. 把圖片丟進 `images/`（支援 jpg / jpeg / png / webp / gif / avif）。
2. （選用）打開 `images/meta.json`，加一筆標題與標籤：

   ```json
   "你的圖片.jpg": { "title": "圖片標題", "tags": "標籤1 標籤2" }
   ```

   - 沒設定的圖片會以檔名當標題（`my-photo.jpg` → `my photo`）。
   - `meta.json` 裡的**順序就是網頁的「預設順序」**，想調整排列直接搬動即可；沒列在裡面的圖片會依檔名自然排序接在後面。
   - `tags` 可以是空白分隔的字串，也可以是陣列。
3. 推送到 `gh-pages`。GitHub Actions 會自動產生 `images/manifest.json` 與 `images/thumbs/`，提交回分支後 Pages 會重新部署。

想在本機先產生（例如要離線預覽）：

```bash
pip install -r tools/requirements.txt   # 只需一次；沒裝 Pillow 也能產 manifest，只是不會有縮圖
python tools/generate_manifest.py
```

常用參數：`--force` 強制重做所有縮圖、`--no-thumbs` 只更新 manifest。

> `manifest.json` 與 `thumbs/` 都是產生物，請不要手動編輯；要改標題／標籤一律改 `meta.json`。
> 縮圖檔名含原圖內容的雜湊，換圖（即使檔名相同）會自動重做並清掉舊檔。

## 本地預覽

請用本地伺服器開啟，不要直接雙擊 `index.html`：

```bash
python3 -m http.server 8000
# 然後瀏覽 http://localhost:8000
```

> 為什麼？瀏覽器在 `file://` 下會擋住 `fetch()`，網頁讀不到 `manifest.json`，只能退回逐張探測的慢速備援模式。

## 部署到 GitHub Pages

本專案內容放在 `gh-pages` 分支：

```bash
git checkout -b gh-pages
git add .
git commit -m "deploy gallery"
git push origin gh-pages
```

再到倉庫 **Settings → Pages**，Source 選 `gh-pages` / `root` 就完成了。

### 關於自動化 Workflow

- 在 `images/**` 或 `tools/**` 有變動時觸發，也可以到 **Actions → Generate Gallery Manifest → Run workflow** 手動執行（建議第一次先手動跑一次，確認權限正常）。
- 它用內建的 `GITHUB_TOKEN` 提交，需要 `contents: write`（workflow 檔內已宣告）。
- 由 bot 提交的 commit 不會再次觸發這個 workflow，不會無限循環；Pages 部署則照常進行。

## 授權

本專案目前僅供練習用途。圖片為 AI 生成的測試素材，可自由替換。
