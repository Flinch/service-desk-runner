import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Track if a run is in progress (prevent concurrent runs)
let isRunning = false;

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));

app.use(express.json());

//allow requests from vercel domain
app.use(cors({
  origin: 'https://qa-blueprint.vercel.app',
  methods: ['GET', 'POST'],
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://qa-blueprint.vercel.app',
  methods: ['GET', 'POST'],
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', running: isRunning });
});

// SSE endpoint — streams Playwright output line by line
app.get('/run-tests', (req, res) => {
  if (isRunning) {
    res.status(429).json({ error: 'A test run is already in progress. Try again in a moment.' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // important for Railway/nginx proxies
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
    FORCE_COLOR: '0', // disable color codes in streamed output
  };

  // Run only @smoke tagged tests
  const playwright = spawn(
    'npx',
    ['playwright', 'test', '--grep', '@smoke', '--reporter=line'],
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

    // Check if a video was recorded
    const videoDir = path.join(__dirname, 'test-results');
    if (existsSync(videoDir)) {
      send('video', '/test-video');
    }

    send('done', true);
    res.end();
  });

  // Clean up if client disconnects
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
