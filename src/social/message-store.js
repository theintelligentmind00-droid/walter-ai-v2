const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const MSG_DIR = 'data/messages';

function ensureDir() {
  if (!fs.existsSync(MSG_DIR)) {
    fs.mkdirSync(MSG_DIR, { recursive: true });
  }
}

function nameToSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function threadFile(name) {
  return path.join(MSG_DIR, nameToSlug(name) + '.json');
}

function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function getThread(name) {
  ensureDir();
  const file = threadFile(name);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    logger.error(`Failed to read message thread for ${name}: ${err.message}`);
    return [];
  }
}

function addMessage(name, from, message) {
  ensureDir();
  const thread = getThread(name);
  thread.push({
    timestamp: new Date().toISOString(),
    from,
    message,
  });
  atomicWrite(threadFile(name), thread);
  logger.debug(`Message stored [${name}] from ${from}: "${message.slice(0, 50)}"`);
}

// Returns { name: [messages] } for all known threads
function getAllThreads() {
  ensureDir();
  const threads = {};
  let files;
  try {
    files = fs.readdirSync(MSG_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));
  } catch (err) {
    return threads;
  }

  for (const file of files) {
    const name = path.basename(file, '.json');
    try {
      threads[name] = JSON.parse(fs.readFileSync(path.join(MSG_DIR, file), 'utf8'));
    } catch (err) {
      threads[name] = [];
    }
  }

  return threads;
}

function getRecentMessages(name, count = 5) {
  return getThread(name).slice(-count);
}

module.exports = { getThread, addMessage, getAllThreads, getRecentMessages };
