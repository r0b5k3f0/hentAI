#!/usr/bin/env python3
"""
掃描 images/ 資料夾，自動產生 images/manifest.json
讓 gallery.js 可以直接載入，速度比前端逐張探測快很多。

用法:
  python tools/generate_manifest.py
"""
import json
import argparse
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
OUTPUT = IMAGES_DIR / "manifest.json"

# 內建的標題/tags庫 - 有的話就用，沒有就自動用檔名
KNOWN_META = {
  "01.jpg": {"title": "晨曦山湖", "tags": "風景 自然 山 湖"},
  "02.jpg": {"title": "藍紫流波", "tags": "抽象 數位藝術 漸層"},
  "03.jpg": {"title": "霓虹夜城", "tags": "城市 賽博龐克 夜景"},
  "04.jpg": {"title": "向日葵花田", "tags": "自然 花 暖色"},
  "05.jpg": {"title": "極簡和室", "tags": "室內 日式 禪"},
  "06.jpg": {"title": "宇宙星雲", "tags": "星空 太空 星雲"},
  "07.jpg": {"title": "枯山水庭園", "tags": "日式 禪 庭園"},
  "08.jpg": {"title": "雨夜市集", "tags": "城市 賽博龐克 夜景 台北"},
  "09.jpg": {"title": "流體泡泡", "tags": "抽象 3D 柔和"},
  "10.jpg": {"title": "窗邊午睡貓", "tags": "貓 療癒 室內"},
  "11.jpg": {"title": "沙漠星河", "tags": "星空 沙漠 銀河"},
  "12.jpg": {"title": "北歐客廳", "tags": "室內 北歐 極簡"},
  "13.jpg": {"title": "粉髮圖書魔法師", "tags": "二次元 動漫 萌系 女角 魔法"},
  "14.jpg": {"title": "咖啡廳吧檯女孩", "tags": "二次元 動漫 萌系 女角 咖啡"},
  "15.jpg": {"title": "雪夜圍巾少女", "tags": "二次元 動漫 萌系 女角 冬天"},
  "16.jpg": {"title": "櫻花巫女", "tags": "二次元 動漫 萌系 女角 和風"},
  "17.jpg": {"title": "工坊機械師", "tags": "二次元 動漫 萌系 女角 機械 科幻"},
  "18.jpg": {"title": "森林巡守員", "tags": "二次元 動漫 萌系 女角 自然"},
  "19.jpg": {"title": "航海旗袍魔法陣", "tags": "二次元 動漫 女角 PicX OnePiece 魔法"},
  "20.jpg": {"title": "鏡中倒影", "tags": "二次元 動漫 女角 PicX 鏡像"},
  "21.jpg": {"title": "闇黑魔導女王", "tags": "二次元 動漫 女角 PicX 奇幻"},
  "22.jpg": {"title": "浮空島夕景", "tags": "二次元 動漫 萌系 女角 風景 4K"},
  "23.jpg": {"title": "星河觀測者", "tags": "二次元 動漫 女角 星空 銀河 流星 天文 觀測站"},
  "24.jpg": {"title": "海風候車時光", "tags": "二次元 動漫 女角 夏日 海邊 鐵道 旅行 日常"},
  "25.jpg": {"title": "螢光溫室的精靈", "tags": "二次元 動漫 女角 精靈 奇幻 自然 植物 溫室 療癒"},
  "26.jpg": {"title": "霓雨巷弄的邂逅", "tags": "二次元 動漫 女角 城市 台北 雨夜 霓虹 科幻 貓 療癒"},
}

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


def build_manifest(images_dir):
    """Build deterministic metadata for top-level image files only."""
    files = sorted(
        p for p in images_dir.iterdir()
        if p.suffix.lower() in SUPPORTED_EXTENSIONS
        and p.is_file() and not p.is_symlink()
    )
    manifest = []
    for image in files:
        meta = KNOWN_META.get(image.name, {
            "title": image.stem,
            "tags": "二次元 動漫" if image.stem.isdecimal() and int(image.stem) >= 13 else "",
        })
        manifest.append({
            # Escape URL delimiters in filenames (e.g. #, ?, %, spaces).
            "src": f"images/{quote(image.name, safe='')}",
            "title": meta["title"],
            "tags": meta["tags"],
        })
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="檢查清單是否最新，不寫入檔案")
    args = parser.parse_args()
    manifest = build_manifest(IMAGES_DIR)
    content = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != content:
            parser.exit(1, "清單需要更新，請執行 python tools/generate_manifest.py\n")
        print("✓ manifest.json 已是最新版本")
        return
    OUTPUT.write_text(content, encoding="utf-8")
    print(f"✓ 掃描到 {len(manifest)} 張圖片 -> {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
