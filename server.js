import express from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://qa-blueprint.vercel.app';

let isRunning = false;

// Manual CORS middleware — handles SSE correctly
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.use(express.json());

// Serve the Playwright HTML report as static files
app.use('/report', express.static(path.join(__dirname, 'playwright-report')));

// Health check
app.get('/health', (req, res) => {
  const reportReady = existsSync(path.join(__dirname, 'playwright-report', 'index.html'));
  res.json({ status: 'ok', running: isRunning, reportReady });
});

// SSE endpoint — streams Playwright output line by line
app.get('/run-tests', (req, res) => {
  if (isRunning) {
    res.status(429).json({ error: 'A test run is already in progress. Try again in a moment.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data, ts: Date.now() })}\n\n`);
  };

  isRunning = true;
  send('status', 'Starting Playwright test run...');
  send('status', `Target: ${process.env.BASE_URL || 'https://your-desk-app.vercel.app'}`);
  send('divider', '─'.repeat(50));

  const env = {
    ...process.env,
    BASE_URL: process.env.BASE_URL || 'https://your-desk-app.vercel.app',
    FORCE_COLOR: '0',
  };

  // Run with both line reporter (for streaming) and html reporter (for the report)
  const playwright = spawn(
    'npx',
    ['playwright', 'test', '--grep', '@smoke', '--reporter=line,html'],
    { env, cwd: __dirname }
  );

  playwright.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => send('log', line));
  });

  playwright.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => send('log', line));
  });

  playwright.on('close', (code) => {
    isRunning = false;
    send('divider', '─'.repeat(50));

    if (code === 0) {
      send('result', 'PASS');
      send('status', 'All tests passed ✓');
    } else {
      send('result', 'FAIL');
      send('status', `Tests finished with failures (exit code ${code})`);
    }

    // Send report link if it was generated
    const reportExists = existsSync(path.join(__dirname, 'playwright-report', 'index.html'));
    if (reportExists) {
      send('report', `${process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:' + PORT}/report`);
    }

    send('done', true);
    res.end();
  });

  req.on('close', () => {
    if (isRunning) {
      playwright.kill();
      isRunning = false;
    }
  });
});

app.listen(PORT, () => {
  console.log(`Playwright runner server listening on port ${PORT}`);
});
