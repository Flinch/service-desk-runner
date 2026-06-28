# desk-playwright-runner

Express server that runs Playwright smoke tests on demand and streams output live via SSE.
Designed to power a "live demo" button on your portfolio site.

## Architecture

```
Portfolio site / desk app
      ↓ GET /run-tests (SSE)
This Express server (Railway)
      ↓ spawns Playwright
      ↓ streams stdout line by line
Browser renders live terminal output
```

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium --with-deps

# 3. Copy env file and fill in your desk app URL
cp .env.example .env

# 4. Start the server
npm run dev

# Server runs at http://localhost:3001
```

## Deploy to Railway

### One-time setup

1. Push this folder as its own GitHub repo (or subfolder)
2. Go to railway.app → New Project → Deploy from GitHub
3. Select this repo
4. Railway auto-detects the `railway.toml` config

### Environment variables to set in Railway dashboard

| Variable | Value |
|---|---|
| `BASE_URL` | Your Vercel desk app URL e.g. `https://desk-abc.vercel.app` |
| `ALLOWED_ORIGIN` | Your portfolio site URL e.g. `https://yoursite.com` |

Railway sets `PORT` automatically — don't override it.

### After deploy

Copy your Railway public URL (looks like `https://desk-playwright-runner-production.up.railway.app`)
and set it as `VITE_RUNNER_URL` in your desk app's Vercel environment variables.

## Adding the React component to your desk app

Copy `src/PlaywrightDemo.jsx` into your desk app's `src/components/` folder.

Add `VITE_RUNNER_URL` to your Vercel project:
- Vercel Dashboard → Your Project → Settings → Environment Variables
- Key: `VITE_RUNNER_URL`
- Value: your Railway server URL

Then use the component:

```jsx
import PlaywrightDemo from './components/PlaywrightDemo';

// Drop it anywhere on your page
<PlaywrightDemo />
```

## Updating the smoke tests

Edit `tests/smoke.spec.js`. All tests tagged `@smoke` run when the demo button is pressed.
Keep the suite under ~30 seconds for a good demo experience — 3 to 5 tests is ideal.

Make sure your test selectors match your actual desk app's `data-testid` attributes.
