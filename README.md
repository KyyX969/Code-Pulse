# CodePulse — Developer Project Monitoring & Deployment Hub (v1.0 MVP)

CodePulse is a collaborative software engineering workspace built from [prd_codepulse.md](./prd_codepulse.md), integrating interactive Kanban project tracking, automated GitHub webhook synchronization, `main` branch protection (**Gatekeeper**), one-click Vercel deployments, and peer-to-peer WebRTC IDE screen monitoring.

## Implemented Features

- **F-01 Autentikasi & Integrasi OAuth**:
  - GitHub OAuth (`/api/auth/github`, `/api/auth/github/callback`) and Vercel OAuth / Personal Access Token linking (`/api/auth/vercel`, `/api/auth/vercel/token`).
  - OAuth tokens encrypted at rest using **AES-256-GCM** (`server/src/utils/crypto.ts`).
  - Built-in **Quick Persona Access** (`Project Leader` & `Team Member`) for immediate local testing without external OAuth credentials.
- **F-02 Manajemen Workspace & Kanban Board**:
  - Drag-and-drop Kanban board (`@dnd-kit/core` + `@dnd-kit/sortable`) across `To Do`, `In Progress`, `In Review`, and `Done` with unique task codes (`#CP-01`, `#CP-02`, ...).
- **F-03 Otomatisasi Status via GitHub Webhook**:
  - `POST /api/webhooks/github` verifies `X-Hub-Signature-256` (HMAC-SHA256), parses `#CP-XX` from commits/PRs, automatically transitions cards to `In Review`, and broadcasts real-time updates over WebSocket (`/ws`).
  - Includes a built-in **GitHub Webhook & Push Simulator** in the Gatekeeper tab for testing without external tunneling.
- **F-04 Branch Protection & Approval Gatekeeper**:
  - Automatically configures `main` branch protection via `@octokit/rest` when linking a repository.
  - Rejects direct pushes to `main` (`Zero Direct Push` audit log) and restricts merging/moving tasks to `Done` to the **Project Leader** after inspecting the code diff (`Approve & Merge` / `Request Changes`).
- **F-05 One-Click Vercel Deployment**:
  - Project Leader can deploy `main` to Vercel via `POST /api/workspaces/:id/deployments` (or auto-deploy on merge), streaming build statuses (`QUEUED` → `BUILDING` → `READY` / `ERROR`), logs, and live preview URLs.
- **F-06 Live Screen Monitor (WebRTC)**:
  - Browser-native `navigator.mediaDevices.getDisplayMedia` screen/IDE sharing over WebRTC Peer-to-Peer (`RTCPeerConnection` + STUN/TURN) with WebSocket / Supabase Realtime signaling and live FPS/bitrate telemetry.

## Quick Start (Local Mode)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run both the Express + WebSocket API server (`:4000`) and Vite React client (`:5173`):
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` and choose **Project Leader** (`@rizky-lead`) or **Team Member** (`@nadia-dev`).

## Production Integrations (Optional `.env`)

Copy `.env.example` to `.env` to enable live external services:

- **Supabase PostgreSQL & Realtime**: Execute `supabase/schema.sql` in your Supabase SQL editor and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. When omitted, CodePulse automatically uses the local JSON store (`server/data/codepulse-db.json`).
- **GitHub OAuth & Webhooks**: Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_WEBHOOK_SECRET`.
- **Vercel Deployment**: Set `VERCEL_CLIENT_ID` / `VERCEL_CLIENT_SECRET` or link a Vercel Personal Access Token inside **Integrations**.
- **WebRTC TURN Server**: Optionally set `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL` for strict symmetric-NAT networks.

## Verification Scripts

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
