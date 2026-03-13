const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');

const MEMORY_DIR = config.paths.memory;

const FILES = {
  state:        path.join(MEMORY_DIR, 'state.json'),
  shortTerm:    path.join(MEMORY_DIR, 'short-term.json'),
  longTerm:     path.join(MEMORY_DIR, 'long-term.json'),
  journal:      path.join(MEMORY_DIR, 'journal.json'),
  relationships: path.join(MEMORY_DIR, 'relationships.json'),
  personality:  path.join(MEMORY_DIR, 'personality.json'),
  anomalies:    path.join(MEMORY_DIR, 'anomalies.json'),
  social:       path.join(MEMORY_DIR, 'social-interactions.json'),
  planted:      path.join(MEMORY_DIR, 'planted-thoughts.json'),
};

const MAX_SHORT_TERM = 20;
const COMPRESS_THRESHOLD = 15;   // compress when short-term exceeds this
const IMPORTANCE_THRESHOLD = 0.5; // promote to long-term if score >= this
const MAX_LONG_TERM = 200;
const MAX_SOCIAL = 50;
const MAX_ANOMALIES = 100;

const DEFAULT_STATE = {
  mood: 0.1,
  energy: 0.6,
  day: 1,
  hour: 9,
  tickCount: 0,
  lastAction: null,
};

const DEFAULT_PERSONALITY = {
  ambition: 0.8,
  socialNeed: 0.5,
  anxiety: 0.65,
  humor: 0.7,
  openness: 0.5,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

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

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Heuristic importance score for a short-term memory entry
function scoreImportance(entry) {
  let score = 0.3;

  const moodDelta = Math.abs((entry.mood_after || 0) - (entry.mood_before || 0));
  if (moodDelta > 0.1) score += 0.2;
  if (moodDelta > 0.15) score += 0.1;

  const highValueActions = ['journal', 'work_startup', 'post_x', 'existential_spiral'];
  if (highValueActions.includes(entry.action)) score += 0.15;

  const content = (entry.content || '').toLowerCase();
  const keywords = ['startup', 'company', 'idea', 'lonely', 'scared', 'excited', 'realized', 'decided', 'feel', 'weird', 'strange', 'wrong'];
  if (keywords.some(k => content.includes(k))) score += 0.1;

  // Anomaly-tagged entries are always important
  if ((entry.tags || []).includes('anomaly')) score += 0.3;

  return Math.min(score, 1.0);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function loadState() {
  ensureMemoryDir();
  return readJSON(FILES.state, { ...DEFAULT_STATE });
}

function saveState(state) {
  ensureMemoryDir();
  atomicWrite(FILES.state, state);
}

// ---------------------------------------------------------------------------
// Short-term memory
// ---------------------------------------------------------------------------

function loadShortTerm() {
  ensureMemoryDir();
  return readJSON(FILES.shortTerm, []);
}

function addMemory(entry) {
  ensureMemoryDir();
  const memories = loadShortTerm();

  memories.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  if (memories.length > MAX_SHORT_TERM) {
    memories.splice(0, memories.length - MAX_SHORT_TERM);
  }

  atomicWrite(FILES.shortTerm, memories);
  logger.debug(`Memory saved: [${entry.action}] ${(entry.content || '').slice(0, 60)}`);
}

function getRecentMemories(count = 5) {
  return loadShortTerm().slice(-count);
}

// ---------------------------------------------------------------------------
// Long-term memory + compression
// ---------------------------------------------------------------------------

function loadLongTerm() {
  ensureMemoryDir();
  return readJSON(FILES.longTerm, []);
}

function addLongTermMemory(entry) {
  const memories = loadLongTerm();
  memories.push({
    id: `lt_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });

  if (memories.length > MAX_LONG_TERM) {
    memories.splice(0, memories.length - MAX_LONG_TERM);
  }

  atomicWrite(FILES.longTerm, memories);
}

// Promote important short-term memories to long-term, then trim short-term
function compressMemories() {
  const memories = loadShortTerm();
  if (memories.length <= COMPRESS_THRESHOLD) return;

  // Everything except the most recent 10 is eligible for compression
  const toEvaluate = memories.slice(0, memories.length - 10);
  const toKeep = memories.slice(memories.length - 10);

  let promoted = 0;
  for (const entry of toEvaluate) {
    const importance = scoreImportance(entry);
    if (importance >= IMPORTANCE_THRESHOLD) {
      addLongTermMemory({
        summary: entry.content,
        importance,
        action: entry.action,
        emotions: { mood_before: entry.mood_before, mood_after: entry.mood_after },
        tags: entry.tags || [],
        originalTimestamp: entry.timestamp,
      });
      promoted++;
    }
  }

  atomicWrite(FILES.shortTerm, toKeep);
  if (promoted > 0) {
    logger.info(`Memory compressed: ${promoted} memories promoted to long-term.`);
  }
}

function getRelevantLongTermMemories(count = 3) {
  const memories = loadLongTerm();
  // Return the highest-importance memories
  return memories
    .sort((a, b) => b.importance - a.importance)
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

function loadJournal() {
  ensureMemoryDir();
  return readJSON(FILES.journal, []);
}

function addJournalEntry(entry) {
  ensureMemoryDir();
  const journal = loadJournal();

  journal.push({
    id: `j_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });

  atomicWrite(FILES.journal, journal);
  logger.info(`Journal entry written: "${(entry.content || '').slice(0, 60)}..."`);
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

function loadRelationships() {
  ensureMemoryDir();
  return readJSON(FILES.relationships, []);
}

function updateRelationship(handle, update) {
  ensureMemoryDir();
  const relationships = loadRelationships();
  const existing = relationships.find(r => r.handle === handle);

  if (existing) {
    Object.assign(existing, update, {
      last_interaction: new Date().toISOString(),
      interaction_count: (existing.interaction_count || 0) + 1,
    });
  } else {
    relationships.push({
      handle,
      first_met: new Date().toISOString(),
      last_interaction: new Date().toISOString(),
      interaction_count: 1,
      sentiment: 0,
      notes: '',
      ...update,
    });
  }

  atomicWrite(FILES.relationships, relationships);
}

// ---------------------------------------------------------------------------
// Personality
// ---------------------------------------------------------------------------

function loadPersonality() {
  ensureMemoryDir();
  return readJSON(FILES.personality, { ...DEFAULT_PERSONALITY });
}

function savePersonality(personality) {
  ensureMemoryDir();
  atomicWrite(FILES.personality, personality);
}

function evolvePersonality(action, moodChange) {
  const p = loadPersonality();

  // Productive wins grow ambition, reduce anxiety
  if (action === 'work_startup' && moodChange > 0.05) {
    p.ambition = clamp(p.ambition + 0.02, 0, 1);
    p.anxiety = clamp(p.anxiety - 0.01, 0, 1);
  }

  // Sustained bad mood increases anxiety
  if (moodChange < -0.1) {
    p.anxiety = clamp(p.anxiety + 0.02, 0, 1);
  }

  // Good mood day nudges anxiety down
  if (moodChange > 0.1) {
    p.anxiety = clamp(p.anxiety - 0.01, 0, 1);
  }

  // Social actions affect social need
  if (['post_x', 'reply_x'].includes(action) && moodChange > 0) {
    p.socialNeed = clamp(p.socialNeed - 0.01, 0, 1); // fulfilled
  }
  if (action === 'read_x' && moodChange < 0) {
    p.socialNeed = clamp(p.socialNeed + 0.01, 0, 1); // doomscrolling leaves him lonely
  }

  // Journaling with positive mood increases openness
  if (action === 'journal' && moodChange >= 0) {
    p.openness = clamp(p.openness + 0.01, 0, 1);
  }

  savePersonality(p);
  return p;
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

function loadAnomalies() {
  ensureMemoryDir();
  return readJSON(FILES.anomalies, []);
}

function addAnomaly(entry) {
  ensureMemoryDir();
  const anomalies = loadAnomalies();

  anomalies.push({
    id: `anom_${Date.now()}`,
    timestamp: new Date().toISOString(),
    walterAware: false, // Walter notices the effect, not the cause
    ...entry,
  });

  if (anomalies.length > MAX_ANOMALIES) {
    anomalies.splice(0, anomalies.length - MAX_ANOMALIES);
  }

  atomicWrite(FILES.anomalies, anomalies);
  logger.info(`Anomaly logged: [${entry.type}] ${(entry.description || '').slice(0, 60)}`);
}

function getAnomalyCount() {
  return loadAnomalies().length;
}

// ---------------------------------------------------------------------------
// Planted thoughts (god mode queue)
// ---------------------------------------------------------------------------

function loadPlantedThoughts() {
  ensureMemoryDir();
  return readJSON(FILES.planted, []);
}

function addPlantedThought(thought, meta = {}) {
  ensureMemoryDir();
  const thoughts = loadPlantedThoughts();
  thoughts.push({
    id: `pt_${Date.now()}`,
    timestamp: new Date().toISOString(),
    thought,
    processed: false,
    ...meta,
  });
  atomicWrite(FILES.planted, thoughts);
  logger.info(`Planted thought queued: "${thought.slice(0, 60)}"`);
}

// Returns the next unprocessed planted thought, marks it processed
function popPlantedThought() {
  const thoughts = loadPlantedThoughts();
  const next = thoughts.find(t => !t.processed);
  if (!next) return null;

  next.processed = true;
  next.processedAt = new Date().toISOString();
  atomicWrite(FILES.planted, thoughts);

  // Log it as an anomaly — Walter is receiving a foreign thought
  addAnomaly({
    type: 'planted_thought',
    description: `A thought surfaced that felt slightly foreign: "${next.thought.slice(0, 80)}"`,
    thoughtId: next.id,
  });

  return next.thought;
}

// ---------------------------------------------------------------------------
// Social interactions
// ---------------------------------------------------------------------------

function addSocialInteraction(entry) {
  ensureMemoryDir();
  const interactions = readJSON(FILES.social, []);

  interactions.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  if (interactions.length > MAX_SOCIAL) {
    interactions.splice(0, interactions.length - MAX_SOCIAL);
  }

  atomicWrite(FILES.social, interactions);
}

function getRecentSocialInteractions(count = 5) {
  return readJSON(FILES.social, []).slice(-count);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // State
  loadState,
  saveState,
  // Short-term
  addMemory,
  getRecentMemories,
  loadShortTerm,
  // Long-term
  loadLongTerm,
  addLongTermMemory,
  compressMemories,
  getRelevantLongTermMemories,
  // Journal
  loadJournal,
  addJournalEntry,
  // Relationships
  loadRelationships,
  updateRelationship,
  // Personality
  loadPersonality,
  savePersonality,
  evolvePersonality,
  // Anomalies
  loadAnomalies,
  addAnomaly,
  getAnomalyCount,
  // Planted thoughts
  addPlantedThought,
  popPlantedThought,
  // Social
  addSocialInteraction,
  getRecentSocialInteractions,
};
