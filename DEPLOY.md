# Deploying The Jazz Graph

Static SPA served by nginx on the NAS, exposed at `jazz.h3r3.com` via Cloudflare Tunnel.

## Architecture

```
Internet → Cloudflare Tunnel → cloudflared (NAS) → jazz container :4600
LAN      → Traefik (M1:443)  → jazz container (NAS:4600)
```

The Docker image contains only the built app (HTML/JS/CSS). Album data and cover art are volume-mounted from the NAS filesystem, so data updates don't require a new image build.

## Prerequisites

- SSH access to NAS (`mike@192.168.10.10`) and M1 (`mike@192.168.10.20`)
- Docker + `homelab_network` on NAS
- GitHub Container Registry access (automatic via GitHub Actions)

## First-Time Setup

### 1. Optimize images (one-time, re-run when covers change)

```bash
node scripts/optimize-images.mjs
```

Converts ~4,000 JPG covers to WebP (~50% smaller) and updates `albums.json` paths. Uses sharp at quality 82 — visually lossless.

### 2. Deploy data + app to NAS

```bash
./scripts/deploy.sh
```

This syncs data (WebP covers + JSON) and pulls the latest container image.

### 3. Add Traefik route (M1)

Edit `~/docker/traefik/dynamic/nas-services.yml` on M1:

```yaml
# Under http.routers:
jazz:
  rule: "Host(`jazz.h3r3.com`)"
  service: jazz
  entryPoints: [websecure]
  tls: {}

# Under http.services:
jazz:
  loadBalancer:
    servers:
      - url: "http://192.168.10.10:4600"
```

Traefik picks up changes automatically — no restart needed.

### 4. Add Cloudflare Tunnel ingress (WAN access)

In the Cloudflare Zero Trust dashboard, add a public hostname:

- **Subdomain:** `jazz`
- **Domain:** `h3r3.com`
- **Service:** `http://localhost:4600`

## Ongoing Deployments

### Code changes (automatic)

Push to `main` → GitHub Actions builds a new Docker image → pushes to `ghcr.io/spaceshipmike/jazz-graph:latest` → WUD detects the update and restarts the container.

No manual steps needed for code/UI changes.

### Data changes (manual)

When album data or cover art changes (new albums added, colors re-extracted, etc.):

```bash
# Optimize any new images
node scripts/optimize-images.mjs

# Sync data to NAS
./scripts/deploy.sh --data-only
```

### Manual app deploy (if needed)

```bash
./scripts/deploy.sh --app-only
```

## Deployment Scripts

| Script | Purpose |
|--------|---------|
| `scripts/optimize-images.mjs` | JPG → WebP conversion + albums.json path update |
| `scripts/deploy.sh` | Full deploy (data sync + container update) |
| `scripts/deploy.sh --data-only` | Sync data/images only |
| `scripts/deploy.sh --app-only` | Pull + restart container only |

## Port

**4600** — registered in homelab ports reference.

## Image Optimization

Cover art is converted from JPG to WebP using sharp:

- Quality: 82 (visually lossless)
- Effort: 4 (balanced speed/compression)
- Output: `data/images/covers-webp/`
- Original JPGs preserved in `data/images/covers/`
- `albums.json` paths updated to reference WebP versions
- Incremental: skips already-converted images

To re-optimize all (e.g., after quality change):

```bash
rm -rf data/images/covers-webp
node scripts/optimize-images.mjs --quality 85
```
