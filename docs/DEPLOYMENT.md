# Deployment Guide

This guide covers manually deploying the Battleships game to Cloudflare infrastructure.

## Prerequisites

1. **Cloudflare Account**: Sign up at https://cloudflare.com
2. **Wrangler CLI**: Install globally for worker deployment
   ```bash
   npm install -g wrangler
   ```
3. **Cloudflare Authentication**: Login to your Cloudflare account
   ```bash
   wrangler login
   ```

## Architecture

- **Web App**: React frontend deployed to Cloudflare Pages
- **Worker**: WebSocket server with Durable Objects for multiplayer game state

## Manual Deployment

### Step 1: Build and Deploy Worker

#### Prerequisites
1. **Install dependencies** (from project root):
   ```bash
   pnpm install
   ```

2. **Build the engine** (required dependency):
   ```bash
   pnpm -C engine build
   ```

3. **Build the worker**:
   ```bash
   cd worker
   pnpm build
   ```

#### Option A: Deploy via Cloudflare Dashboard (Recommended)

1. **Create the worker**:
   - Go to [Cloudflare Dashboard > Workers & Pages](https://dash.cloudflare.com/workers-and-pages)
   - Click "Create" → "Create Worker"
   - Name it `battleships-ws`
   - Click "Deploy" (with default Hello World code for now)

2. **Upload your code**:
   - In the worker dashboard, click "Edit code"
   - Delete the default code
   - Copy and paste the contents of `worker/dist/index.js`
   - Click "Save and deploy"
   
   > **Note**: The `worker/dist/index.js` file is created when you run `pnpm build` in the worker directory. If it doesn't exist, make sure you completed the build step above.

3. **Configure Durable Objects**:
   - Go to "Settings" tab in your worker
   - Scroll to "Durable Objects"
   - Add a new Durable Object binding:
     - **Variable name**: `GAME_ROOMS`
     - **Class name**: `GameRoom`
     - **Script name**: `battleships-ws` (same as your worker)
   - Click "Save"

4. **Enable Durable Objects** (if first time):
   - Go to your Cloudflare account dashboard
   - Navigate to "Workers & Pages" → "Durable Objects"
   - If prompted, enable Durable Objects for your account

#### Option B: Deploy via CLI

1. **Ensure wrangler is authenticated**:
   ```bash
   wrangler login
   ```

2. **Deploy the worker** (from project root):
   ```bash
   # Build dependencies first
   pnpm -C engine build
   pnpm -C worker build
   
   # Deploy using wrangler from project root
   pnpm dlx wrangler deploy -c worker/wrangler.toml
   ```

   Or from worker directory:
   ```bash
   cd worker
   pnpm build
   pnpm dlx wrangler deploy
   ```

**Result**: The worker will be available at:
`https://battleships-ws.<your-subdomain>.workers.dev`

### Step 2: Deploy Web App to Cloudflare Pages

#### Option A: Via Dashboard (Recommended)

1. **Build the web app**:
   ```bash
   # From project root
   pnpm build
   ```

2. **Upload to Cloudflare Pages**:
   - Go to [Cloudflare Dashboard > Pages](https://dash.cloudflare.com/pages)
   - Create new project → Upload assets
   - Upload the `web/dist` folder
   - Set project name to `battleships`

#### Option B: Via Wrangler CLI

1. **Create Pages project**:
   ```bash
   wrangler pages project create battleships
   ```

2. **Deploy the built web app**:
   ```bash
   wrangler pages deploy web/dist --project-name battleships
   ```

### Step 3: Configure Environment Variables

Update the WebSocket URL in your web app build:

```bash
# Set environment variable before building web app
export VITE_WS_URL=wss://battleships-ws.<your-subdomain>.workers.dev
pnpm -C web build
```

Or set it in your `.env` file in the `web/` directory:
```
VITE_WS_URL=wss://battleships-ws.<your-subdomain>.workers.dev
```

## Configuration

### Worker Configuration (wrangler.toml)
- **Name**: `battleships-ws`
- **Durable Object**: `GameRoom` for multiplayer state (SQLite-backed for free tier)
- **WebSocket endpoint**: `/ws?room=<ROOM_CODE>`
- **Migration**: Uses `new_sqlite_classes` for free plan compatibility

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

### Common Issues

- **Build failures**: 
  - Ensure all workspace dependencies are properly linked with `pnpm install`
  - Build engine first before building web or worker: `pnpm -C engine build`

- **Worker deployment**:
  - Check Durable Objects quota in Cloudflare dashboard
  - If using CLI: Ensure you're authenticated with `wrangler whoami`
  - If using dashboard: Verify the `worker/dist/index.js` file exists after building
  - Make sure Durable Objects are properly configured with correct variable name `GAME_ROOMS`
  - **Free plan**: Ensure `wrangler.toml` uses `new_sqlite_classes` instead of `new_classes`
  - Verify wrangler.toml configuration matches the expected format

- **WebSocket connections**:
  - Verify CORS and WebSocket upgrade headers in worker
  - Check that VITE_WS_URL points to correct worker URL
  - Test worker endpoint directly: `curl -H "Upgrade: websocket" <worker-url>/ws`

- **Pages deployment**:
  - Ensure web app is built before uploading (`pnpm build`)
  - Check that dist folder contains index.html and assets
  - Verify environment variables are set during build time

### Worker URL Format

Your worker will be available at:
```
https://battleships-ws.<your-cloudflare-subdomain>.workers.dev
```

Find your subdomain in the Cloudflare dashboard under Workers & Pages > Overview.