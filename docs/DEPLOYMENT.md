# Deployment Guide

This guide covers deploying the Battleships game to Cloudflare infrastructure using GitHub Actions.

## Prerequisites

1. **Cloudflare Account**: Sign up at https://cloudflare.com
2. **Cloudflare API Token**: Create an API token with these recommended permissions:
   - **Account**: Cloudflare Pages: Edit
   - **Zone**: Zone: Read
   - **Zone**: Zone Settings: Edit
   - **Zone**: Zone Settings: Read

> *Note: Some previously listed permissions (e.g., Account Settings:Read, User Details:Read) are no longer available or necessary for deployment. Use the minimum required permissions above for secure automation.*

3. **GitHub Repository Secrets**: Add these secrets to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (found in dashboard sidebar)

## Architecture

- **Web App**: React frontend deployed to Cloudflare Pages
- **Worker**: WebSocket server with Durable Objects for multiplayer game state

## Automatic Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically deploys on pushes to `main`:

1. **Builds the monorepo**: Engine → Web → Worker
2. **Deploys Web App** to Cloudflare Pages as `battleships` project
3. **Deploys Worker** with Durable Objects for WebSocket multiplayer

## Manual Deployment

### Deploy Worker
```bash
cd worker
pnpm deploy
```

### Deploy Web App
```bash
pnpm build
# Upload web/dist to Cloudflare Pages manually or via CLI
```

## Configuration

### Worker Configuration (wrangler.toml)
- **Name**: `battleships-ws`
- **Durable Object**: `GameRoom` for multiplayer state
- **WebSocket endpoint**: `/ws?room=<ROOM_CODE>`

### Web App Configuration
- **Build output**: `web/dist/`
- **Build command**: `pnpm build` (builds engine first, then web)
- **Node version**: 18

## Environment Variables

The worker runs without additional environment variables. The web app connects to the worker via WebSocket at the deployed worker URL.

## Custom Domain Setup (Optional)

1. Add your domain to Cloudflare
2. Set up Pages custom domain for the web app
3. Set up Worker custom domain/route for the WebSocket server

## Troubleshooting

- **Build failures**: Ensure all workspace dependencies are properly linked
- **Worker deployment**: Check Durable Objects quota and configuration
- **WebSocket connections**: Verify CORS and WebSocket upgrade headers