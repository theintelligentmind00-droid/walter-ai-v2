const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');

const MEMORY_DIR = config.paths.memory;
const SHORT_TERM_FILE = path.join(MEMORY_DIR, 'short-term.json');
const STATE_FILE = path.join(MEMORY_DIR, 'state.json');
const SOCIAL_FILE = path.join(MEMORY_DIR, 'social-interactions.json');
const MAX_SHORT_TERM = 20;
const MAX_SOCIAL = 50;

const DEFAULT_STATE = {
  mood: 0.1,       // slightly anxious baseline
  energy: 0.6,
  day: 1,
  hour: 9,         // Walter starts at 9am
  tickCount: 0,
};

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

// Atomic write: write to temp file then rename
function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function readJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    logger.error(`Failed to read ${filePath}: ${err.message}`);
    return defaultValue;
  }
}

function loadState() {
  ensureMemoryDir();
  return readJSON(STATE_FILE, { ...DEFAULT_STATE });
}

function saveState(state) {
  ensureMemoryDir();
  atomicWrite(STATE_FILE, state);
}

function loadShortTerm() {
  ensureMemoryDir();
  return readJSON(SHORT_TERM_FILE, []);
}

function addMemory(entry) {
  ensureMemoryDir();
  const memories = loadShortTerm();

  memories.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  // Roll over oldest if over limit
  if (memories.length > MAX_SHORT_TERM) {
    memories.splice(0, memories.length - MAX_SHORT_TERM);
  }

  atomicWrite(SHORT_TERM_FILE, memories);
  logger.debug(`Memory saved: [${entry.action}] ${entry.content.slice(0, 60)}...`);
}

function getRecentMemories(count = 5) {
  const memories = loadShortTerm();
  return memories.slice(-count);
}

function addSocialInteraction(entry) {
  ensureMemoryDir();
  const interactions = readJSON(SOCIAL_FILE, []);

  interactions.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  if (interactions.length > MAX_SOCIAL) {
    interactions.splice(0, interactions.length - MAX_SOCIAL);
  }

  atomicWrite(SOCIAL_FILE, interactions);
  logger.debug(`Social interaction saved: [${entry.type}]`);
}

function getRecentSocialInteractions(count = 5) {
  const interactions = readJSON(SOCIAL_FILE, []);
  return interactions.slice(-count);
}

module.exports = {
  loadState,
  saveState,
  addMemory,
  getRecentMemories,
  loadShortTerm,
  addSocialInteraction,
  getRecentSocialInteractions,
};
