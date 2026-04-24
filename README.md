# Curation App

Desktop app for the Curation personal AI news platform. Built with Tauri + React + TypeScript.

## Quick Start

```bash
npm install

cp .env.example .env
# Fill in values (see comments in .env.example)

npm run tauri dev
```

## Web Build (Preview)

Browser-only variant that drops persistent cache, ChatInput/ACP, admin panel, and native dialogs. Lives in the same tree — toggled by `__IS_WEB__` compile-time define in `vite.config.web.ts`. See `src/lib/platform/` for the capability abstractions.

```bash
# Dev (expects VITE_API_BASE pointing at a curation-server)
npm run dev:web

# Production build
VITE_API_BASE=https://curationcurationcuration.cc \
VITE_WS_BASE=wss://curationcurationcuration.cc \
VITE_AUTHING_APP_ID=<app_id> \
VITE_AUTHING_DOMAIN=https://curation.authing.cn \
VITE_AUTHING_REDIRECT_URI=https://preview.curationcurationcuration.cc/auth/callback \
npm run build:web

# Deploy (Aliyun, served by curation-web systemd unit + Cloudflare Tunnel)
rsync -avz --delete dist-web/ root@47.99.247.46:/opt/curation/curation-web/
ssh root@47.99.247.46 systemctl restart curation-web
```

Live at https://preview.curationcurationcuration.cc

## Architecture

See [CLAUDE.md](CLAUDE.md) for detailed architecture, key files, and design docs.

## Related Repos

- [curation-server](https://github.com/curation-x3/curation-server) — Orchestration server (FastAPI)
- [curation-agent](https://github.com/curation-x3/curation-agent) — AI analysis pipeline
- [curation-cli](https://github.com/curation-x3/curation-cli) — Terminal client
