# bkaanp.github.io
 
Portfolio of small, focused experiments at the intersection of AI and frontend engineering.
 
**Live:** [bkaanp.github.io](https://bkaanp.github.io)
 
## Projects
 
| Project | Description | Live | Status |
|---------|-------------|------|--------|
| Semantic Image Search | CLIP-powered browser-native image search using transformers.js. No server, no uploads. | [→](https://bkaanp.github.io/image-search/) | In progress |
| Local-First RAG | Chat with your PDFs. Embeddings and retrieval run fully client-side. | [→](https://bkaanp.github.io/rag/) | In progress |
| MCP Client | Browser-based Model Context Protocol client with live tool-call visualization. | [→](https://bkaanp.github.io/mcp-client/) | In progress |
 
## Stack
 
- **Monorepo:** pnpm workspaces + Turborepo
- **Landing:** Astro 5
- **Apps:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 with a shared theme preset
- **Deployment:** GitHub Actions → GitHub Pages, single domain with per-app subpaths
## Architecture notes
 
The monorepo keeps design language, TypeScript config, and build tooling consistent across every experiment — adding a new project is scaffolding one Vite app and a single line in the landing page. Each app is deployed as a static build under its own subpath (`/image-search/`, `/rag/`, `/mcp-client/`), so the same domain hosts everything without routing gymnastics.
 
The CI pipeline builds all packages in parallel via Turborepo and assembles the output into a single `dist/` before publishing to Pages. Conditional copy steps let new apps slot in without touching the workflow.
 
## Local development
 
```bash
pnpm install
pnpm dev      # runs landing + all apps in parallel
pnpm build    # production build for all packages
```
 
Requires Node 20+ and pnpm 9+.
 
## About
 
Built by [Batuhan-Kaan Piskin](https://github.com/bkaanp) — Medieninformatik graduate (HTW Berlin, 2025), working at the intersection of frontend engineering and AI tooling. Previously built an Azure-based RAG chatbot at Sparkassen Rating & Risikosysteme.