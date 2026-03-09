#!/usr/bin/env node

/**
 * Convert cover art JPGs to WebP and update albums.json paths.
 * Uses sharp (already a devDependency).
 *
 * Usage:
 *   node scripts/optimize-images.mjs                  # convert all
 *   node scripts/optimize-images.mjs --quality 85     # custom quality (default: 82)
 *   node scripts/optimize-images.mjs --dry-run        # preview without writing
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, basename, extname } from "path";
import sharp from "sharp";

const DATA_DIR = join(process.cwd(), "data");
const COVERS_DIR = join(DATA_DIR, "images", "covers");
const WEBP_DIR = join(DATA_DIR, "images", "covers-webp");
const ALBUMS_PATH = join(DATA_DIR, "albums.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const qualityIdx = args.indexOf("--quality");
const quality = qualityIdx !== -1 ? parseInt(args[qualityIdx + 1], 10) : 82;

async function main() {
  if (!existsSync(COVERS_DIR)) {
    console.error(`Cover directory not found: ${COVERS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(COVERS_DIR).filter(
    (f) => /\.(jpe?g|png)$/i.test(f)
  );
  console.log(`Found ${files.length} images to convert (quality: ${quality})`);

  if (!dryRun && !existsSync(WEBP_DIR)) {
    mkdirSync(WEBP_DIR, { recursive: true });
  }

  let converted = 0;
  let skipped = 0;
  let totalSavedBytes = 0;

  for (const file of files) {
    const src = join(COVERS_DIR, file);
    const webpName = basename(file, extname(file)) + ".webp";
    const dest = join(WEBP_DIR, webpName);

    if (existsSync(dest)) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] ${file} → ${webpName}`);
      converted++;
      continue;
    }

    try {
      const inputBuf = readFileSync(src);
      const outputBuf = await sharp(inputBuf)
        .webp({ quality, effort: 4 })
        .toBuffer();

      writeFileSync(dest, outputBuf);
      const saved = inputBuf.length - outputBuf.length;
      totalSavedBytes += saved;
      converted++;

      if (converted % 200 === 0) {
        console.log(`  Converted ${converted}/${files.length}...`);
      }
    } catch (err) {
      console.error(`  Failed: ${file} — ${err.message}`);
    }
  }

  console.log(
    `\nDone: ${converted} converted, ${skipped} skipped (already exist)`
  );
  if (totalSavedBytes > 0) {
    console.log(
      `Saved ${(totalSavedBytes / 1024 / 1024).toFixed(1)} MB total`
    );
  }

  // Update albums.json paths
  if (!dryRun && converted > 0) {
    console.log("\nUpdating albums.json coverPath entries...");
    const albums = JSON.parse(readFileSync(ALBUMS_PATH, "utf-8"));
    let updated = 0;

    for (const album of albums) {
      if (album.coverPath && album.coverPath.includes("images/covers/")) {
        const oldPath = album.coverPath;
        const newPath = oldPath
          .replace("images/covers/", "images/covers-webp/")
          .replace(/\.(jpe?g|png)$/i, ".webp");

        // Only update if the webp file actually exists
        const webpFile = join(DATA_DIR, newPath);
        if (existsSync(webpFile)) {
          album.coverPath = newPath;
          updated++;
        }
      }
    }

    writeFileSync(ALBUMS_PATH, JSON.stringify(albums, null, 2) + "\n");
    console.log(`Updated ${updated} album paths`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
