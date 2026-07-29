import { readFileSync, writeFileSync } from "fs";
const ids = process.argv.slice(2);
const file = new URL("../data/albums.json", import.meta.url).pathname;
const albums = JSON.parse(readFileSync(file, "utf8"));
const filtered = albums.filter(a => !ids.includes(a.id));
writeFileSync(file, JSON.stringify(filtered, null, 2) + "\n");
console.log(`${albums.length} → ${filtered.length} (removed ${albums.length - filtered.length})`);
