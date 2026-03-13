const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('../utils/config');
const logger = require('../utils/logger');
const memoryManager = require('../memory/memory-manager');
const messageStore = require('../social/message-store');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const COOKIE_NAME = 'walter_auth';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Simple cookie auth
// ---------------------------------------------------------------------------

function setAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${config.dashboard.password}; Path=/; Max-Age=${COOKIE_MAX_AGE / 1000}; HttpOnly`);
}

function isAuthenticated(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(s => s.trim()))
  );
  const authHeader = req.headers['x-dashboard-password'];
  return cookies[COOKIE_NAME] === config.dashboard.password || authHeader === config.dashboard.password;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  if (req.path === '/login') return next();
  if (req.path.startsWith('/god/') || req.path.startsWith('/state') || req.path.startsWith('/memory') || req.path.startsWith('/journal') || req.path.startsWith('/personality') || req.path.startsWith('/messages')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/login');
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>Walter — Login</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0d0d12; color: #e0e0e0; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; }
  .box { border: 1px solid #333; padding: 2rem; width: 300px; }
  h2 { color: #00ff88; margin-bottom: 1.5rem; font-size: 1rem; letter-spacing: 2px; }
  input { width: 100%; padding: 0.6rem; background: #1a1a24; border: 1px solid #333; color: #e0e0e0; font-family: monospace; margin-bottom: 1rem; }
  button { width: 100%; padding: 0.6rem; background: #00ff88; color: #0d0d12; border: none; font-family: monospace; font-weight: bold; cursor: pointer; }
  .err { color: #ff4444; font-size: 0.8rem; margin-top: 0.5rem; }
</style>
</head>
<body>
<div class="box">
  <h2>WALTER AI — GOD MODE</h2>
  <form method="POST" action="/login">
    <input type="password" name="password" placeholder="password" autofocus />
    <button type="submit">ENTER</button>
    ${req.query.err ? '<p class="err">wrong password</p>' : ''}
  </form>
</div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  if (req.body.password === config.dashboard.password) {
    setAuthCookie(res);
    res.redirect('/');
  } else {
    res.redirect('/login?err=1');
  }
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0`);
  res.redirect('/login');
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

app.use(requireAuth);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ---------------------------------------------------------------------------
// State + memory API
// ---------------------------------------------------------------------------

app.get('/state', (req, res) => {
  try {
    const state = memoryManager.loadState();
    const personality = memoryManager.loadPersonality();
    const anomalyCount = memoryManager.getAnomalyCount();
    res.json({ state, personality, anomalyCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/memory/:type', (req, res) => {
  const validTypes = ['short-term', 'long-term', 'relationships', 'anomalies', 'social-interactions', 'planted'];
  const type = req.params.type;
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Unknown memory type' });

  try {
    let data;
    switch (type) {
      case 'short-term':    data = memoryManager.loadShortTerm(); break;
      case 'long-term':     data = memoryManager.loadLongTerm(); break;
      case 'relationships': data = memoryManager.loadRelationships(); break;
      case 'anomalies':     data = memoryManager.loadAnomalies(); break;
      case 'social-interactions': data = memoryManager.getRecentSocialInteractions(50); break;
      case 'planted':       data = memoryManager.loadAnomalies(); break; // show anomaly log for planted
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/journal', (req, res) => {
  try {
    res.json(memoryManager.loadJournal());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/personality', (req, res) => {
  try {
    res.json(memoryManager.loadPersonality());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/messages', (req, res) => {
  try {
    res.json(messageStore.getAllThreads());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// God mode endpoints
// ---------------------------------------------------------------------------

app.post('/god/thought', (req, res) => {
  const { thought } = req.body;
  if (!thought || typeof thought !== 'string') return res.status(400).json({ error: 'thought required' });

  try {
    memoryManager.addPlantedThought(thought.trim(), { source: 'god_mode' });
    logger.info(`[GOD MODE] Thought planted: "${thought.slice(0, 60)}"`);
    broadcast('god_action', { type: 'thought_planted', thought });
    res.json({ ok: true, message: 'Thought queued for next tick.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/god/event', (req, res) => {
  const { event } = req.body;
  if (!event || typeof event !== 'string') return res.status(400).json({ error: 'event required' });

  try {
    // Events get injected as planted thoughts and logged as memories
    memoryManager.addPlantedThought(`Something just happened: ${event.trim()}`, { source: 'god_event', event });
    memoryManager.addAnomaly({ type: 'god_event', description: event });
    logger.info(`[GOD MODE] Event created: "${event.slice(0, 60)}"`);
    broadcast('god_action', { type: 'event_created', event, anomalyCount: memoryManager.getAnomalyCount() });
    res.json({ ok: true, message: 'Event injected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/god/glitch', (req, res) => {
  const { description } = req.body;
  if (!description || typeof description !== 'string') return res.status(400).json({ error: 'description required' });

  try {
    const glitchThought = `Something feels deeply wrong and I can't explain why. ${description.trim()}`;
    memoryManager.addPlantedThought(glitchThought, { source: 'god_glitch' });
    memoryManager.addAnomaly({ type: 'glitch', description, walterAware: true });
    logger.info(`[GOD MODE] Glitch triggered: "${description.slice(0, 60)}"`);
    broadcast('god_action', { type: 'glitch_triggered', description, anomalyCount: memoryManager.getAnomalyCount() });
    res.json({ ok: true, message: 'Glitch triggered.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/god/trait', (req, res) => {
  const { trait, value } = req.body;
  const validTraits = ['ambition', 'socialNeed', 'anxiety', 'humor', 'openness'];
  if (!validTraits.includes(trait)) return res.status(400).json({ error: 'invalid trait' });
  const num = parseFloat(value);
  if (isNaN(num) || num < 0 || num > 1) return res.status(400).json({ error: 'value must be 0-1' });

  try {
    const personality = memoryManager.loadPersonality();
    personality[trait] = num;
    memoryManager.savePersonality(personality);
    logger.info(`[GOD MODE] Trait adjusted: ${trait} → ${num}`);
    broadcast('god_action', { type: 'trait_adjusted', trait, value: num, personality });
    res.json({ ok: true, personality });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

wss.on('connection', (ws) => {
  logger.info('Observer connected to dashboard.');

  // Send current full state on connect
  try {
    ws.send(JSON.stringify({
      type: 'connected',
      state: memoryManager.loadState(),
      personality: memoryManager.loadPersonality(),
      anomalyCount: memoryManager.getAnomalyCount(),
      recentMemories: memoryManager.getRecentMemories(10),
      journal: memoryManager.loadJournal().slice(-5),
    }));
  } catch (err) {
    logger.error(`Failed to send initial state: ${err.message}`);
  }

  ws.on('close', () => logger.info('Observer disconnected.'));
  ws.on('error', (err) => logger.error(`WebSocket error: ${err.message}`));
});

function broadcast(type, data) {
  const msg = JSON.stringify({ type, ...data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      try { client.send(msg); } catch (e) { /* skip dead clients */ }
    }
  });
}

// Called by tick engine after every tick
function onTick(tickData) {
  broadcast('tick_update', tickData);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function start() {
  const port = config.dashboard.port;
  server.listen(port, () => {
    logger.info(`Observer dashboard running at http://localhost:${port}`);
  });
}

module.exports = { start, broadcast, onTick };
