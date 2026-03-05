#!/usr/bin/env node

/**
 * Extract a 5-color palette from each album cover using k-means clustering.
 * Writes palette: [{ r, g, b, h, s, l, pct }] sorted by area descending,
 * plus dominantColor (HSL of largest cluster) for backward compat.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");

const K = 5;           // number of palette colors
const MAX_ITER = 20;   // k-means iterations
const SAMPLE_SIZE = 64; // resize to 64x64 = 4096 pixels

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function kmeans(pixels, k, maxIter) {
  // Initialize centroids by picking evenly spaced pixels
  const step = Math.max(1, Math.floor(pixels.length / k));
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const p = pixels[Math.min(i * step, pixels.length - 1)];
    centroids.push([p[0], p[1], p[2]]);
  }

  const assignments = new Uint16Array(pixels.length);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign pixels to nearest centroid
    let changed = false;
    for (let i = 0; i < pixels.length; i++) {
      const [pr, pg, pb] = pixels[i];
      let bestDist = Infinity;
      let bestK = 0;
      for (let c = 0; c < k; c++) {
        const dr = pr - centroids[c][0];
        const dg = pg - centroids[c][1];
        const db = pb - centroids[c][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestK = c;
        }
      }
      if (assignments[i] !== bestK) {
        assignments[i] = bestK;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]); // r, g, b, count
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      sums[c][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c][0] = sums[c][0] / sums[c][3];
        centroids[c][1] = sums[c][1] / sums[c][3];
        centroids[c][2] = sums[c][2] / sums[c][3];
      }
    }
  }

  // Count cluster sizes
  const counts = new Array(k).fill(0);
  for (let i = 0; i < pixels.length; i++) counts[assignments[i]]++;
  const total = pixels.length;

  return centroids.map((c, i) => ({
    r: Math.round(c[0]),
    g: Math.round(c[1]),
    b: Math.round(c[2]),
    pct: Math.round((counts[i] / total) * 100),
  }));
}

async function extractPalette(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  const total = info.width * info.height;
  for (let i = 0; i < total; i++) {
    pixels.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);
  }

  const clusters = kmeans(pixels, K, MAX_ITER);

  // Sort by percentage descending
  clusters.sort((a, b) => b.pct - a.pct);

  // Add HSL to each
  return clusters
    .filter((c) => c.pct > 0)
    .map((c) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      ...rgbToHsl(c.r, c.g, c.b),
      pct: c.pct,
    }));
}

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Extracting 5-color palettes from cover art (k-means)");
console.log(`  ${albums.length} albums to process`);
console.log("═══════════════════════════════════════════════════════════════");
console.log();

let extracted = 0;
let noCover = 0;
let failed = 0;

for (let i = 0; i < albums.length; i++) {
  const album = albums[i];
  const prefix = `[${i + 1}/${albums.length}]`;

  if (!album.coverPath) {
    album.dominantColor = null;
    album.palette = null;
    noCover++;
    continue;
  }

  const imagePath = join(ROOT, "data", album.coverPath);
  if (!existsSync(imagePath)) {
    album.dominantColor = null;
    album.palette = null;
    noCover++;
    continue;
  }

  try {
    const palette = await extractPalette(imagePath);
    album.palette = palette;
    // Backward compat: dominantColor = largest cluster
    album.dominantColor = palette.length > 0
      ? { h: palette[0].h, s: palette[0].s, l: palette[0].l }
      : null;
    extracted++;
    const colors = palette.slice(0, 3).map((c) => `hsl(${c.h},${c.s}%,${c.l}%) ${c.pct}%`).join("  ");
    if (i % 100 === 0 || i === albums.length - 1) {
      console.log(`${prefix} ✓ ${album.title} → ${colors}`);
    }
  } catch (e) {
    album.dominantColor = null;
    album.palette = null;
    failed++;
    console.log(`${prefix} ✗ ${album.title} (${e.message})`);
  }
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

console.log();
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Extracted: ${extracted}  No cover: ${noCover}  Failed: ${failed}`);
console.log("═══════════════════════════════════════════════════════════════");
