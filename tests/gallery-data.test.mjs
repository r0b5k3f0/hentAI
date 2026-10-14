import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManifest, filterImages, sortByFilename, shuffle } from "../assets/gallery-data.mjs";

const entry = (src, title, tags) => ({ src, title, tags });

test("accepts an empty gallery without discovery requests", () => {
  assert.deepEqual(normalizeManifest([]), []);
});

test("normalizes missing metadata, tag arrays and filenames with dots", () => {
  const [item] = normalizeManifest([entry("images/my.art.JPG", null, ["風景", 10, "Art"])]);
  assert.equal(item.title, "my.art");
  assert.equal(item.tags, "風景 Art");
  assert.equal(item.filename, "my.art.JPG");
});

test("preserves text markup as data", () => {
  const title = '<img src=x onerror="alert(1)">';
  assert.equal(normalizeManifest([entry("images/a.jpg", title)])[0].title, title);
});

test("rejects malformed manifests and unsafe image paths", () => {
  for (const data of [null, {}, "[]", [null], [{}], [{ src: 42 }]]) {
    assert.throws(() => normalizeManifest(data));
  }
  for (const src of [
    "https://example.com/a.jpg", "javascript:alert(1)", "/images/a.jpg",
    "images/../a.jpg", "images/%2e%2e%2fa.jpg", "images/..%5ca.jpg",
    "images/a.jpg?query", "images/a.jpg#hash", "images/%00a.jpg",
    "images/a.svg", "images/a.jpg/other.png", "images/%.jpg",
  ]) assert.throws(() => normalizeManifest([entry(src)]), src);
});

test("encodes special filename characters and rejects equivalent duplicates", () => {
  const [item] = normalizeManifest([entry("images/%E9%9B%AA%20%23%3F%25.png")]);
  assert.equal(item.filename, "雪 #?%.png");
  assert.equal(item.src, "images/%E9%9B%AA%20%23%3F%25.png");
  assert.throws(() => normalizeManifest([entry("images/a.jpg"), entry("images/%61.jpg")]));
});

test("filters by title, tags and decoded filename, ignoring case and edge spaces", () => {
  const images = normalizeManifest([
    entry("images/01.jpg", "晨曦山湖", "Nature"),
    entry("images/my%20cat.png", "午睡", ["貓"]),
  ]);
  for (const query of ["  NATURE ", "山湖", "01.jpg"]) {
    assert.deepEqual(filterImages(images, query), [images[0]]);
  }
  assert.deepEqual(filterImages(images, "my cat"), [images[1]]);
  assert.deepEqual(filterImages(images, "不存在"), []);
  assert.equal(filterImages(images, "  "), images);
});

test("filename sorting is numeric and does not mutate default order", () => {
  const images = normalizeManifest([entry("images/10.jpg"), entry("images/2.jpg"), entry("images/01.jpg")]);
  assert.deepEqual(sortByFilename(images).map((item) => item.filename), ["01.jpg", "2.jpg", "10.jpg"]);
  assert.equal(images[0].filename, "10.jpg");
});

test("shuffle preserves all entries and original order is untouched", () => {
  const images = [1, 2, 3, 4];
  const shuffled = shuffle(images, () => 0);
  assert.deepEqual(images, [1, 2, 3, 4]);
  assert.deepEqual(shuffled, [2, 3, 4, 1]);
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle([1]), [1]);
});
