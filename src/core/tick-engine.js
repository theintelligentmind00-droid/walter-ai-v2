const cron = require('node-cron');
const config = require('../utils/config');
const logger = require('../utils/logger');
const brain = require('./walter-brain');
const ollamaClient = require('./ollama-client');
const memoryManager = require('../memory/memory-manager');

// Convert minutes to a cron expression
// For sub-minute intervals in testing, we use setInterval instead
function buildCronExpression(minutes) {
  if (minutes >= 1) {
    return `*/${Math.round(minutes)} * * * *`;
  }
  return null; // Signal to use setInterval
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Advance Walter's simulated clock by one tick
function advanceClock(state) {
  // Each tick = intervalMinutes of real time = same in Walter's simulated time
  const minutesPerTick = config.tick.intervalMinutes;
  const hoursAdvanced = minutesPerTick / 60;

  state.hour = (state.hour + hoursAdvanced) % 24;

  // Increment day when hour wraps past midnight
  if (state.hour < hoursAdvanced) {
    state.day += 1;
  }
}

function isSleeping(state) {
  const { sleepHour, wakeHour } = config.walter;
  const h = Math.floor(state.hour);
  if (sleepHour > wakeHour) {
    // Spans midnight: e.g. sleep 23, wake 7
    return h >= sleepHour || h < wakeHour;
  }
  return h >= sleepHour && h < wakeHour;
}

async function runTick() {
  logger.tick('--- TICK START ---');

  let state;
  try {
    state = memoryManager.loadState();
  } catch (err) {
    logger.error(`Failed to load state: ${err.message}`);
    return;
  }

  state.tickCount = (state.tickCount || 0) + 1;
  advanceClock(state);

  logger.tick(`Tick #${state.tickCount} | Day ${state.day} | Hour ${state.hour.toFixed(1)} | Mood ${state.mood.toFixed(2)} | Energy ${state.energy.toFixed(2)}`);

  // Skip tick if Walter is sleeping
  if (isSleeping(state)) {
    logger.tick('Walter is asleep. Skipping tick.');
    state.energy = clamp(state.energy + 0.05, 0, 1); // Recover energy while sleeping
    memoryManager.saveState(state);
    return;
  }

  // Check Ollama is up
  const available = await ollamaClient.isAvailable();
  if (!available) {
    logger.error('Ollama is not available. Skipping tick.');
    memoryManager.saveState(state);
    return;
  }

  // Get recent memories for context
  let memories;
  try {
    memories = memoryManager.getRecentMemories(5);
  } catch (err) {
    logger.error(`Failed to load memories: ${err.message}`);
    memories = [];
  }

  // Ask Walter's brain what to do
  let decision;
  try {
    decision = await brain.decide(state, memories);
  } catch (err) {
    logger.error(`Brain failed: ${err.message}`);
    memoryManager.saveState(state);
    return;
  }

  logger.tick(`Action: ${decision.action}`);
  logger.tick(`Content: ${decision.content}`);
  logger.tick(`Inner thought: ${decision.innerThought}`);

  // Apply mood and energy changes
  const moodBefore = state.mood;
  state.mood = clamp(state.mood + decision.moodChange, -1, 1);
  state.energy = clamp(state.energy + decision.energyChange, 0, 1);

  logger.tick(`Mood: ${moodBefore.toFixed(2)} → ${state.mood.toFixed(2)} | Energy: ${state.energy.toFixed(2)}`);

  // Store this tick in short-term memory
  try {
    memoryManager.addMemory({
      action: decision.action,
      content: decision.content,
      innerThought: decision.innerThought,
      mood_before: moodBefore,
      mood_after: state.mood,
      energy: state.energy,
      tags: [decision.action],
    });
  } catch (err) {
    logger.error(`Failed to save memory: ${err.message}`);
  }

  // Save updated state
  try {
    memoryManager.saveState(state);
  } catch (err) {
    logger.error(`Failed to save state: ${err.message}`);
  }

  logger.tick('--- TICK END ---\n');
}

function start() {
  const minutes = config.tick.intervalMinutes;
  logger.info(`Tick engine starting. Interval: ${minutes} minute(s).`);

  // Run one tick immediately on start
  runTick();

  if (minutes < 1) {
    // Sub-minute interval for testing (e.g. 0.17 ≈ 10 seconds)
    const ms = Math.round(minutes * 60 * 1000);
    logger.info(`Using setInterval (${ms}ms) for fast testing mode.`);
    setInterval(runTick, ms);
  } else {
    const expr = buildCronExpression(minutes);
    logger.info(`Cron expression: ${expr}`);
    cron.schedule(expr, runTick);
  }
}

module.exports = { start, runTick };
