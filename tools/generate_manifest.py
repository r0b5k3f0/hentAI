#!/usr/bin/env python3
"""
掃描 images/ 資料夾，產生：

  - images/manifest.json  圖片清單（尺寸、標題、標籤、縮圖資訊），給 assets/gallery.js 讀取
  - images/thumbs/        WebP 縮圖（需要 Pillow；沒安裝就略過，前端會改用原圖）

標題與標籤請維護在 images/meta.json；manifest.json 與 thumbs/ 都是產生物，請勿手動修改。

用法:
  python tools/generate_manifest.py              # 一般使用（只補缺少的縮圖）
  python tools/generate_manifest.py --force      # 重新產生所有縮圖
  python tools/generate_manifest.py --no-thumbs  # 不產生縮圖，只更新 manifest
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
THUMBS_DIR = IMAGES_DIR / "thumbs"
META_PATH = IMAGES_DIR / "meta.json"
MANIFEST_PATH = IMAGES_DIR / "manifest.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}

# 縮圖上限（寬, 高）。桌機 4 欄每格約 280px，640px 剛好對應 2x DPR；
# 更寬的版面瀏覽器會依 srcset 自動改抓原圖。
THUMB_MAX_SIZE = (640, 1280)
THUMB_QUALITY = 80

try:
    from PIL import Image, ImageOps

    HAS_PIL = True
except ImportError:  # Pillow 是選用的，只有產縮圖才需要
    HAS_PIL = False


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------
def natural_key(name: str):
    """讓 2.jpg 排在 10.jpg 前面。"""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def normalize_tags(value) -> list[str]:
    """tags 允許寫成「空白分隔字串」或陣列，統一輸出為陣列。"""
    if isinstance(value, str):
        return [t for t in re.split(r"[\s,，、]+", value) if t]
    if isinstance(value, (list, tuple)):
        return [str(t).strip() for t in value if str(t).strip()]
    return []


def title_from_name(name: str) -> str:
    """沒有設定標題時，用檔名（去副檔名、底線／連字號換成空白）當標題。"""
    return re.sub(r"[-_]+", " ", Path(name).stem).strip() or name


def short_hash(path: Path) -> str:
    """原圖內容的短雜湊，用在縮圖檔名：換圖後縮圖會自動重做，舊的會被清掉。"""
    h = hashlib.sha1()
    with open(path, "rb") as fp:
        for chunk in iter(lambda: fp.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()[:8]


def load_meta() -> dict[str, dict]:
    if not META_PATH.exists():
        return {}
    with open(META_PATH, encoding="utf-8") as fp:
        data = json.load(fp)
    if not isinstance(data, dict):
        print(f'⚠ {META_PATH.name} 最外層必須是物件 {{"檔名": {{...}}}}，已略過', file=sys.stderr)
        return {}
    meta: dict[str, dict] = {}
    for name, value in data.items():
        if name.startswith(("_", "$")):  # _comment 之類的說明欄位
            continue
        if not isinstance(value, dict):
            print(f'⚠ meta.json: "{name}" 的值必須是物件，已略過', file=sys.stderr)
            continue
        meta[name] = value
    return meta


# ---------------------------------------------------------------------------
# 不依賴 Pillow 的尺寸讀取（JPEG / PNG / GIF / WebP）
# ---------------------------------------------------------------------------
_JPEG_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def _jpeg_size(fp) -> Optional[tuple[int, int]]:
    fp.seek(2)
    while True:
        byte = fp.read(1)
        if not byte:
            return None
        if byte != b"\xff":
            continue
        marker = fp.read(1)
        while marker == b"\xff":  # 允許填充的 0xFF
            marker = fp.read(1)
        if not marker:
            return None
        m = marker[0]
        if m == 0x01 or 0xD0 <= m <= 0xD8:  # 沒有長度欄位的獨立 marker
            continue
        if m in (0xD9, 0xDA):  # EOI / SOS：之後不會再有 SOF
            return None
        length_bytes = fp.read(2)
        if len(length_bytes) < 2:
            return None
        (length,) = struct.unpack(">H", length_bytes)
        if m in _JPEG_SOF:
            data = fp.read(5)
            if len(data) < 5:
                return None
            height, width = struct.unpack(">HH", data[1:5])
            return width, height
        fp.seek(length - 2, 1)


def _webp_size(head: bytes) -> Optional[tuple[int, int]]:
    chunk = head[12:16]
    if chunk == b"VP8X" and len(head) >= 30:
        return (
            int.from_bytes(head[24:27], "little") + 1,
            int.from_bytes(head[27:30], "little") + 1,
        )
    if chunk == b"VP8 " and len(head) >= 30 and head[23:26] == b"\x9d\x01\x2a":
        return (
            int.from_bytes(head[26:28], "little") & 0x3FFF,
            int.from_bytes(head[28:30], "little") & 0x3FFF,
        )
    if chunk == b"VP8L" and len(head) >= 25 and head[20] == 0x2F:
        bits = int.from_bytes(head[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    return None


def read_size_stdlib(path: Path) -> Optional[tuple[int, int]]:
    """只讀檔頭取得寬高；不支援的格式（如 AVIF）回傳 None。"""
    with open(path, "rb") as fp:
        head = fp.read(32)
        if head.startswith(b"\x89PNG\r\n\x1a\n") and head[12:16] == b"IHDR":
            w, h = struct.unpack(">II", head[16:24])
            return w, h
        if head[:6] in (b"GIF87a", b"GIF89a"):
            w, h = struct.unpack("<HH", head[6:10])
            return w, h
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            return _webp_size(head)
        if head[:2] == b"\xff\xd8":
            return _jpeg_size(fp)
    return None


# ---------------------------------------------------------------------------
# Pillow：讀尺寸（考慮 EXIF 方向）＋ 產縮圖
# ---------------------------------------------------------------------------
def _has_alpha(im) -> bool:
    return im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info)


def process_with_pil(src: Path, thumb_dst: Optional[Path]) -> tuple[int, int, bool]:
    """回傳 (寬, 高, 是否產生了縮圖)。thumb_dst 為 None 時只讀尺寸。"""
    with Image.open(src) as opened:
        im = ImageOps.exif_transpose(opened)  # 依 EXIF 轉正，縮圖才不會轉錯方向
        width, height = im.size
        made = False
        if thumb_dst is not None and (width > THUMB_MAX_SIZE[0] or height > THUMB_MAX_SIZE[1]):
            thumb = im.convert("RGBA" if _has_alpha(im) else "RGB")
            thumb.thumbnail(THUMB_MAX_SIZE, Image.Resampling.LANCZOS)
            thumb_dst.parent.mkdir(parents=True, exist_ok=True)
            thumb.save(thumb_dst, "WEBP", quality=THUMB_QUALITY, method=6)
            made = True
        return width, height, made


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--force", action="store_true", help="重新產生所有縮圖")
    parser.add_argument("--no-thumbs", action="store_true", help="不產生縮圖，只更新 manifest")
    args = parser.parse_args()

    if not IMAGES_DIR.is_dir():
        print(f"✗ 找不到 {IMAGES_DIR}", file=sys.stderr)
        return 1

    make_thumbs = not args.no_thumbs and HAS_PIL
    if not args.no_thumbs and not HAS_PIL:
        print("ℹ 未安裝 Pillow，略過縮圖產生（pip install -r tools/requirements.txt 可啟用）")

    meta = load_meta()
    order = {name: i for i, name in enumerate(meta)}  # meta.json 的順序 = 預設顯示順序
    files = sorted(
        (p for p in IMAGES_DIR.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS),
        key=lambda p: (order.get(p.name, len(order)), natural_key(p.name)),
    )

    manifest: list[dict] = []
    expected_thumbs: set[str] = set()
    created = 0

    for path in files:
        name = path.name
        thumb_path = THUMBS_DIR / f"{path.stem}.{short_hash(path)}.webp"
        width = height = None

        if HAS_PIL:
            regenerate = make_thumbs and (args.force or not thumb_path.exists())
            try:
                width, height, made = process_with_pil(path, thumb_path if regenerate else None)
                created += int(made)
            except Exception as exc:  # 壞檔或不支援的格式：仍列入清單，只是沒有尺寸
                print(f"⚠ 無法讀取 {name}：{exc}", file=sys.stderr)
        else:
            size = read_size_stdlib(path)
            if size:
                width, height = size

        entry: dict = {"src": f"images/{name}"}
        if width and height:
            entry["width"], entry["height"] = int(width), int(height)

        if thumb_path.exists():  # 剛產生的、或先前（例如 CI）已產生的縮圖
            expected_thumbs.add(thumb_path.name)
            entry["thumb"] = {"src": f"images/thumbs/{thumb_path.name}"}
            tsize = read_size_stdlib(thumb_path)
            if tsize:
                entry["thumb"]["width"], entry["thumb"]["height"] = tsize

        m = meta.get(name, {})
        title = m.get("title")
        entry["title"] = title.strip() if isinstance(title, str) and title.strip() else title_from_name(name)
        entry["tags"] = normalize_tags(m.get("tags"))
        manifest.append(entry)

    # 清掉已經沒有對應原圖的舊縮圖（檔名含原圖雜湊，換圖後舊檔自然失效）
    pruned = 0
    if not args.no_thumbs and THUMBS_DIR.is_dir():
        for stale in THUMBS_DIR.glob("*.webp"):
            if stale.name not in expected_thumbs:
                stale.unlink()
                pruned += 1

    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # 摘要
    missing = [n for n in meta if not (IMAGES_DIR / n).is_file()]
    for n in missing:
        print(f"⚠ meta.json 有「{n}」但 images/ 裡沒有這個檔案", file=sys.stderr)

    with_thumb = sum(1 for e in manifest if "thumb" in e)
    print(f"✓ 掃描到 {len(manifest)} 張圖片 -> {MANIFEST_PATH.relative_to(ROOT)}")
    print(f"  縮圖：{with_thumb} 張有縮圖（新產生 {created}、清除過期 {pruned}）")
    for e in manifest:
        dims = f"{e['width']}x{e['height']}" if "width" in e else "尺寸未知"
        mark = "🖼" if "thumb" in e else "  "
        print(f"  {mark} {e['src']:<28} {dims:<10} {e['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
