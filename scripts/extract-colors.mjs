#!/usr/bin/env node

/**
 * Extract color data from each album cover using node-vibrant for perceptual
 * palette extraction and culori for OKLCH conversion.
 *
 * K-means runs in CIELAB space for perceptually uniform clustering.
 *
 * Writes per album:
 *   palette: [{ r, g, b, h, s, l, lab: {L,a,b}, pct }]  (k-means in CIELAB)
 *   vibrant: { rgb, oklch, swatch }                        (best perceptual color)
 *   dominantColor: { h, s, l }                             (backward compat)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { Vibrant } from "node-vibrant/node";
import { converter } from "culori";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");

const toOklch = converter("oklch");
const toLab = converter("lab");

// ─── K-Means in CIELAB (perceptually uniform clustering) ────────────

const K = 5;
const MAX_ITER = 20;

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
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convert RGB [0-255] to CIELAB [L:0-100, a:-128-127, b:-128-127]
function rgbToLab(r, g, b) {
  const result = toLab({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return [result.l, result.a, result.b];
}

// K-means clustering in CIELAB space (ΔE ≈ Euclidean distance in Lab)
function kmeansLab(labPixels, k, maxIter) {
  const step = Math.max(1, Math.floor(labPixels.length / k));
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const p = labPixels[Math.min(i * step, labPixels.length - 1)];
    centroids.push([p[0], p[1], p[2]]);
  }
  const assignments = new Uint16Array(labPixels.length);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < labPixels.length; i++) {
      const [pL, pa, pb] = labPixels[i];
      let bestDist = Infinity, bestK = 0;
      for (let c = 0; c < k; c++) {
        const dL = pL - centroids[c][0], da = pa - centroids[c][1], db = pb - centroids[c][2];
        const dist = dL * dL + da * da + db * db; // ΔE76² (Euclidean in Lab)
        if (dist < bestDist) { bestDist = dist; bestK = c; }
      }
      if (assignments[i] !== bestK) { assignments[i] = bestK; changed = true; }
    }
    if (!changed) break;
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < labPixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += labPixels[i][0]; sums[c][1] += labPixels[i][1]; sums[c][2] += labPixels[i][2]; sums[c][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c][0] = sums[c][0] / sums[c][3];
        centroids[c][1] = sums[c][1] / sums[c][3];
        centroids[c][2] = sums[c][2] / sums[c][3];
      }
    }
  }
  const counts = new Array(k).fill(0);
  for (let i = 0; i < labPixels.length; i++) counts[assignments[i]]++;
  const total = labPixels.length;
  return centroids.map((c, i) => ({
    lab: { L: Math.round(c[0] * 10) / 10, a: Math.round(c[1] * 10) / 10, b: Math.round(c[2] * 10) / 10 },
    pct: Math.round((counts[i] / total) * 100),
  }));
}

async function extractPalette(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize(64, 64, { fit: "cover" }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });

  // Convert all pixels to CIELAB for clustering
  const labPixels = [];
  for (let i = 0; i < info.width * info.height; i++) {
    labPixels.push(rgbToLab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]));
  }

  const clusters = kmeansLab(labPixels, K, MAX_ITER);

  // Convert centroids back to RGB and add HSL
  const toSrgb = converter("rgb");
  const result = clusters
    .filter(c => c.pct > 0)
    .map(c => {
      const rgb = toSrgb({ mode: "lab", l: c.lab.L, a: c.lab.a, b: c.lab.b });
      const r = Math.round(Math.max(0, Math.min(255, rgb.r * 255)));
      const g = Math.round(Math.max(0, Math.min(255, rgb.g * 255)));
      const b = Math.round(Math.max(0, Math.min(255, rgb.b * 255)));
      return { r, g, b, ...rgbToHsl(r, g, b), lab: c.lab, pct: c.pct };
    });

  result.sort((a, b) => b.pct - a.pct);
  return result;
}

// ─── Vibrant extraction ─────────────────────────────────────────────

function rgbToOklch(r, g, b) {
  const result = toOklch({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return {
    l: Math.round(result.l * 1000) / 1000,       // 0–1
    c: Math.round((result.c || 0) * 1000) / 1000, // 0–~0.4
    h: Math.round(result.h || 0),                  // 0–360
  };
}

async function extractVibrant(imagePath) {
  const palette = await Vibrant.from(imagePath).quality(5).getPalette();

  // Priority order: Vibrant > Muted > DarkVibrant > LightVibrant > DarkMuted > LightMuted
  const priority = ["Vibrant", "Muted", "DarkVibrant", "LightVibrant", "DarkMuted", "LightMuted"];
  let chosen = null;
  let chosenName = null;
  for (const name of priority) {
    if (palette[name]) {
      chosen = palette[name];
      chosenName = name;
      break;
    }
  }

  if (!chosen) return null;

  const [r, g, b] = chosen.rgb.map(Math.round);
  return {
    rgb: [r, g, b],
    oklch: rgbToOklch(r, g, b),
    swatch: chosenName,
  };
}

// ─── Main ───────────────────────────────────────────────────────────

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Extracting colors: k-means (CIELAB) + node-vibrant + OKLCH");
console.log(`  ${albums.length} albums to process`);
console.log("═══════════════════════════════════════════════════════════════\n");

let extracted = 0, noCover = 0, failed = 0;

for (let i = 0; i < albums.length; i++) {
  const album = albums[i];
  const prefix = `[${i + 1}/${albums.length}]`;

  if (!album.coverPath) {
    album.dominantColor = null;
    album.palette = null;
    album.vibrant = null;
    noCover++;
    continue;
  }

  const imagePath = join(ROOT, "data", album.coverPath);
  if (!existsSync(imagePath)) {
    album.dominantColor = null;
    album.palette = null;
    album.vibrant = null;
    noCover++;
    continue;
  }

  try {
    // K-means palette + Vibrant extraction (concurrent)
    const [palette, vibrant] = await Promise.all([
      extractPalette(imagePath),
      extractVibrant(imagePath),
    ]);
    album.palette = palette;
    album.dominantColor = palette.length > 0
      ? { h: palette[0].h, s: palette[0].s, l: palette[0].l }
      : null;
    album.vibrant = vibrant;

    extracted++;
    if (i % 100 === 0 || i === albums.length - 1) {
      const v = album.vibrant;
      const tag = v ? `${v.swatch} oklch(${v.oklch.l},${v.oklch.c},${v.oklch.h})` : "no vibrant";
      console.log(`${prefix} ✓ ${album.title} → ${tag}`);
    }
  } catch (e) {
    album.dominantColor = null;
    album.palette = null;
    album.vibrant = null;
    failed++;
    console.log(`${prefix} ✗ ${album.title} (${e.message})`);
  }
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

console.log();
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Extracted: ${extracted}  No cover: ${noCover}  Failed: ${failed}`);
console.log("═══════════════════════════════════════════════════════════════");
