# Curation App

Desktop app for the Curation personal AI news platform. Built with Tauri + React + TypeScript.

## Quick Start

```bash
npm install

cp .env.example .env
# Fill in values (see comments in .env.example)

npm run tauri dev
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for detailed architecture, key files, and design docs.

## Related Repos

- [curation-server](https://github.com/curation-x3/curation-server) — Orchestration server (FastAPI)
- [curation-agent](https://github.com/curation-x3/curation-agent) — AI analysis pipeline
- [curation-cli](https://github.com/curation-x3/curation-cli) — Terminal client
