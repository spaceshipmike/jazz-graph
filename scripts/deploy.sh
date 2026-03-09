#!/usr/bin/env bash
set -euo pipefail

# Deploy The Jazz Graph to NAS
# Usage:
#   ./scripts/deploy.sh              # full deploy (app + data)
#   ./scripts/deploy.sh --app-only   # just the app (no image sync)
#   ./scripts/deploy.sh --data-only  # just sync data/images

NAS="mike@192.168.10.10"
NAS_SERVICE_DIR="docker/services/jazz"
NAS_DATA_DIR="docker/volumes/jazz/data"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR"

app_only=false
data_only=false

for arg in "$@"; do
  case $arg in
    --app-only) app_only=true ;;
    --data-only) data_only=true ;;
  esac
done

# ── Sync data (images + JSON) ──────────────────────────────────

sync_data() {
  echo "==> Syncing data to NAS..."

  # Ensure remote directories exist
  ssh "$NAS" "mkdir -p ~/$NAS_DATA_DIR/images/covers-webp"

  # UGREEN NAS has restricted rsync and scp — use tar+ssh and ssh pipes

  # Sync optimized WebP covers
  if [ -d data/images/covers-webp ]; then
    echo "    Syncing WebP covers..."
    local count
    count=$(ls data/images/covers-webp/ | wc -l | tr -d ' ')
    echo "    $count WebP files to sync..."
    COPYFILE_DISABLE=1 tar cf - -C data/images/covers-webp . \
      | ssh "$NAS" "tar xf - -C ~/$NAS_DATA_DIR/images/covers-webp/"
  else
    echo "    No WebP covers found. Run: node scripts/optimize-images.mjs"
    echo "    Syncing original JPG covers..."
    ssh "$NAS" "mkdir -p ~/$NAS_DATA_DIR/images/covers"
    COPYFILE_DISABLE=1 tar cf - -C data/images/covers . \
      | ssh "$NAS" "tar xf - -C ~/$NAS_DATA_DIR/images/covers/"
  fi

  # Sync JSON data files via ssh pipe (scp fails on UGREEN NAS)
  echo "    Syncing JSON data..."
  cat data/albums.json | ssh "$NAS" "cat > ~/$NAS_DATA_DIR/albums.json"

  # Sync artist-photos.json if it exists
  if [ -f data/artist-photos.json ]; then
    cat data/artist-photos.json | ssh "$NAS" "cat > ~/$NAS_DATA_DIR/artist-photos.json"
  fi

  # Sync artist photos if they exist
  if [ -d data/images/artists ] && [ "$(ls -A data/images/artists 2>/dev/null)" ]; then
    ssh "$NAS" "mkdir -p ~/$NAS_DATA_DIR/images/artists"
    COPYFILE_DISABLE=1 tar cf - -C data/images/artists . \
      | ssh "$NAS" "tar xf - -C ~/$NAS_DATA_DIR/images/artists/"
  fi

  # Ensure nginx (non-root) can read the data
  echo "    Setting permissions..."
  ssh "$NAS" "chmod -R o+rX ~/$NAS_DATA_DIR/"

  echo "    Data sync complete."
}

# ── Deploy app container ────────────────────────────────────────

deploy_app() {
  echo "==> Deploying app container..."

  # Ensure service directory exists on NAS
  ssh "$NAS" "mkdir -p ~/$NAS_SERVICE_DIR"

  # Copy compose file
  cat deploy/compose.yml | ssh "$NAS" "cat > ~/$NAS_SERVICE_DIR/compose.yml"

  # Pull latest image and restart
  ssh "$NAS" "cd ~/$NAS_SERVICE_DIR && docker compose pull && docker compose up -d"

  echo "    Container deployed."
  ssh "$NAS" "docker ps --filter name=jazz --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
}

# ── Main ────────────────────────────────────────────────────────

if [ "$data_only" = true ]; then
  sync_data
elif [ "$app_only" = true ]; then
  deploy_app
else
  sync_data
  deploy_app
fi

echo ""
echo "==> Done. Site will be available at https://jazz.h3r3.com"
