import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote

from tools.generate_manifest import ROOT, build_manifest


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.images = Path(self.directory.name)

    def touch(self, *names):
        for name in names:
            (self.images / name).touch()

    def test_empty_directory(self):
        self.assertEqual(build_manifest(self.images), [])

    def test_supported_files_only_and_deterministic_order(self):
        self.touch("b.WEBP", "a.jpg", "c.png", "d.jpeg", "e.gif", "f.avif", "notes.txt", "manifest.json")
        (self.images / "folder.jpg").mkdir()
        (self.images / "linked.jpg").symlink_to(self.images / "a.jpg")
        manifest = build_manifest(self.images)
        self.assertEqual([item["src"] for item in manifest], [
            "images/a.jpg", "images/b.WEBP", "images/c.png",
            "images/d.jpeg", "images/e.gif", "images/f.avif",
        ])
        self.assertEqual(manifest, build_manifest(self.images))

    def test_known_metadata_and_fallback_titles(self):
        self.touch("01.jpg", "23.png", "my.art.jpg", "².png")
        entries = {item["title"]: item for item in build_manifest(self.images)}
        self.assertEqual(entries["晨曦山湖"]["tags"], "風景 自然 山 湖")
        self.assertEqual(entries["23"]["tags"], "二次元 動漫")
        self.assertEqual(entries["my.art"]["tags"], "")
        self.assertEqual(entries["²"]["tags"], "")

    def test_url_special_characters_round_trip(self):
        name = "雪 #?% &.png"
        self.touch(name)
        entry = build_manifest(self.images)[0]
        self.assertEqual(entry["src"], "images/%E9%9B%AA%20%23%3F%25%20%26.png")
        self.assertEqual(unquote(entry["src"][7:]), name)

    def test_repository_manifest_matches_generator(self):
        manifest = json.loads((ROOT / "images/manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest, build_manifest(ROOT / "images"))

    def test_check_command(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/generate_manifest.py"), "--check"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
