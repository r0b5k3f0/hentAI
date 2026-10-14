# hentAI 圖片展示

> 一個簡單、輕量、響應式的靜態圖片展示網站，使用 GitHub Pages 部署。

不需要後端、資料庫或前端建置，網站執行時只有 HTML / CSS / JavaScript。Node.js 套件僅用於開發測試。

## 線上預覽

https://r0b5k3f0.github.io/hentAI/

## 功能特色

- 🖼️ **響應式瀑布格**：手機、平板、桌機自動排版，圖片延遲載入與非同步解碼
- 🔍 **關鍵字搜尋**：依標題、標籤或檔名過濾，重用卡片而非重新建立
- ↕️ **多種排序**：預設 / 依檔名自然排序 / 隨機打散；搜尋不會改變隨機順序
- 🔎 **燈箱檢視**：滑鼠點擊或以 Tab 選取圖片、Enter／空白鍵開啟，ESC 關閉並還原焦點
- 🛟 **明確的狀態提示**：載入中、空圖庫、無搜尋結果、圖片失敗與清單重試
- 🛡️ **安全的資料呈現**：標題只當文字顯示，圖片限定為 `images/` 內的檔案

支援具備 JavaScript modules、`fetch` 與原生 `<dialog>` 的現代瀏覽器。

## 目錄結構

```text
hentAI/
├── .github/workflows/
│   ├── generate-manifest.yml # 自動更新圖片清單
│   └── tests.yml             # 單元與瀏覽器測試
├── index.html
├── assets/
│   ├── style.css
│   ├── gallery.js           # 畫面、事件、載入與燈箱
│   └── gallery-data.mjs     # 清單驗證、搜尋與排序
├── images/
│   ├── manifest.json       # 自動產生的圖片清單
│   └── ...                 # 圖片原檔
├── tools/generate_manifest.py
├── tests/                  # Node、Python 與 Playwright 測試
├── package.json             # 僅開發測試相依與指令
├── package-lock.json
├── playwright.config.mjs
├── README.md
└── README_en.md
```

## 如何新增或移除圖片

1. 將圖片放在 `images/` 的第一層，或移除不需要的圖片。支援 `.jpg`、`.jpeg`、`.png`、`.webp`、`.gif`、`.avif`（不分大小寫）。建議每張控制在 1 MB 以內。
2. 如需自訂標題與標籤，在 `tools/generate_manifest.py` 的 `KNOWN_META` 加入以完整檔名為 key 的資料：

   ```python
   "my-image.jpg": {"title": "圖片標題", "tags": "標籤1 標籤2"},
   ```

   未提供標題時使用不含最後一個副檔名的檔名。無須修改前端 JavaScript。
3. 在專案根目錄執行：

   ```bash
   python3 tools/generate_manifest.py
   ```

4. 將圖片、metadata 變更與 `images/manifest.json` 一起提交並部署。不要直接編輯產生的清單，否則重新產生時會覆蓋。

產生器會編碼檔名中的空白、中文、`#`、`?` 等 URL 特殊字元，忽略子目錄與符號連結。清單為空時會顯示空圖庫，不會猜測圖片檔名。

現有 `Generate Gallery Manifest` workflow 也會在 `gh-pages`、`main`、`master` 的圖片或產生器變更後更新清單。不過由 `GITHUB_TOKEN` 推送的提交不會觸發另一輪 Pages 分支建置；為確保同次部署包含正確清單，建議在提交前執行產生器。

## 本地預覽

必須透過 HTTP 伺服器開啟；直接雙擊 `index.html`（`file://`）會受瀏覽器的模組與 fetch 限制。

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# 瀏覽 http://localhost:8000
```

清單請求會重新驗證快取，圖片則使用瀏覽器正常快取。若清單載入超過 10 秒、HTTP 失敗或資料格式錯誤，會顯示錯誤與「重新載入」按鈕，而非發出大量圖片探測請求。

## 測試

資料邏輯與產生器測試只需 Node.js 20+ 與 Python 3.11+，不需安裝套件：

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 tools/generate_manifest.py --check
```

瀏覽器互動測試使用 Playwright（僅開發相依）：

```bash
npm ci
npx playwright install chromium
npm run test:browser
```

測試會自動啟動本地 HTTP 伺服器，或重用已啟動的 8000 埠伺服器。Linux 若缺少瀏覽器系統函式庫，可使用 `npx playwright install --with-deps chromium`。也可設定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 使用已安裝的 Chromium。

`Tests` workflow（`.github/workflows/tests.yml`）已包含在專案中，會在 push 與 pull request 執行產生器、單元測試與 Chromium 互動測試。同一分支推送且已有 PR 時，兩種事件會各執行一次測試，屬於正常行為。

CI 會先重新產生清單，但不會提交產生的變更；提交前仍應在本地執行 `python3 tools/generate_manifest.py --check`，確保部署使用的清單已更新。網站部署不需 `node_modules`，也不需執行建置。

## 部署到 GitHub Pages

在倉庫 **Settings → Pages**，選擇 **Deploy from a branch**，來源設為 `gh-pages` / `root`。將已通過 PR 測試的變更合併至部署分支後，到 **Actions** 確認 **pages build and deployment** 成功。`Tests` 通過只代表測試成功，不代表網站已完成部署。

## 授權

本專案目前僅供練習用途。圖片為 AI 生成的測試素材，可自由替換。
