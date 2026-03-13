const cron = require('node-cron');
const config = require('../utils/config');
const logger = require('../utils/logger');
const brain = require('./walter-brain');
const ollamaClient = require('./ollama-client');
const memoryManager = require('../memory/memory-manager');
const xClient = require('../social/x-client');
const postComposer = require('../social/post-composer');
const feedReader = require('../social/feed-reader');

let onTickCallback = null; // Set by index.js to wire dashboard updates

function buildCronExpression(minutes) {
  if (minutes >= 1) {
    return `*/${Math.round(minutes)} * * * *`;
  }
  return null;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function advanceClock(state) {
  const hoursAdvanced = config.tick.intervalMinutes / 60;
  state.hour = (state.hour + hoursAdvanced) % 24;
  if (state.hour < hoursAdvanced) {
    state.day += 1;
  }
}

function isSleeping(state) {
  const { sleepHour, wakeHour } = config.walter;
  const h = Math.floor(state.hour);
  if (sleepHour > wakeHour) {
    return h >= sleepHour || h < wakeHour;
  }
  return h >= sleepHour && h < wakeHour;
}

async function executeSocialAction(decision, state, memories) {
  switch (decision.action) {
    case 'post_x': {
      const tweet = await postComposer.composeTweet(state, memories);
      const posted = await xClient.postTweet(tweet);
      logger.tick(`Walter tweeted: "${tweet}"`);
      memoryManager.addSocialInteraction({ type: 'tweet_posted', content: tweet, tweetId: posted.id });
      decision.content = `Posted on X: "${tweet}"`;
      break;
    }
    case 'read_x': {
      const feedResult = await feedReader.readAndSummarizeFeed(10);
      if (feedResult) {
        logger.tick(`Walter read his feed: ${feedResult.summary.slice(0, 80)}...`);
        state.mood = clamp(state.mood + feedResult.moodImpact, -1, 1);
        memoryManager.addSocialInteraction({ type: 'feed_read', content: feedResult.summary, tweetCount: feedResult.tweetCount });
        decision.content = feedResult.summary;
      }
      break;
    }
    case 'reply_x': {
      const replies = await feedReader.checkReplies();
      if (replies.length === 0) {
        logger.tick('No replies to respond to. Walter thinks instead.');
        decision.action = 'think';
        break;
      }
      const target = replies[0];
      const replyText = await postComposer.composeReply(target.text, target.author, state);
      if (replyText) {
        await xClient.replyToTweet(target.id, replyText);
        logger.tick(`Walter replied to @${target.author}: "${replyText}"`);
        memoryManager.addSocialInteraction({ type: 'reply_posted', content: replyText, toAuthor: target.author, toTweet: target.text });
        memoryManager.updateRelationship(target.author, { sentiment: 0.1, notes: `Replied to them.` });
        decision.content = `Replied to @${target.author}: "${replyText}"`;
      } else {
        logger.tick('Walter decided not to reply.');
        decision.action = 'think';
        decision.content = `Checked replies, saw @${target.author}'s message, had nothing genuine to say.`;
      }
      break;
    }
  }
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
  state.xConfigured = await xClient.isConfigured();

  logger.tick(`Tick #${state.tickCount} | Day ${state.day} | Hour ${state.hour.toFixed(1)} | Mood ${state.mood.toFixed(2)} | Energy ${state.energy.toFixed(2)}`);

  // Sleep check
  if (isSleeping(state)) {
    logger.tick('Walter is asleep. Skipping tick.');
    state.energy = clamp(state.energy + 0.05, 0, 1);
    delete state.xConfigured;
    memoryManager.saveState(state);
    return;
  }

  // Ollama check
  const available = await ollamaClient.isAvailable();
  if (!available) {
    logger.error('Ollama is not available. Skipping tick.');
    delete state.xConfigured;
    memoryManager.saveState(state);
    return;
  }

  // Check for planted thought from god mode
  let plantedThought = null;
  try {
    plantedThought = memoryManager.popPlantedThought();
    if (plantedThought) {
      logger.tick(`Planted thought injected: "${plantedThought.slice(0, 60)}"`);
    }
  } catch (err) {
    logger.error(`Planted thought check failed: ${err.message}`);
  }

  // Gather context for brain
  let memories = [];
  let longTermMemories = [];
  let relationships = [];
  let personality = null;
  let socialContext = null;

  try { memories = memoryManager.getRecentMemories(5); } catch (e) { /* non-fatal */ }
  try { longTermMemories = memoryManager.getRelevantLongTermMemories(3); } catch (e) { /* non-fatal */ }
  try { relationships = memoryManager.loadRelationships(); } catch (e) { /* non-fatal */ }
  try { personality = memoryManager.loadPersonality(); } catch (e) { /* non-fatal */ }

  try {
    const recentSocial = memoryManager.getRecentSocialInteractions(3);
    if (recentSocial.length > 0) {
      socialContext = recentSocial.map(s => `[${s.type}] ${s.content.slice(0, 100)}`).join('\n');
    }
  } catch (e) { /* non-fatal */ }

  // If there's a planted thought, inject it as a pseudo-memory so Walter "notices" it
  if (plantedThought) {
    const plantedMemory = {
      timestamp: new Date().toISOString(),
      action: 'think',
      content: plantedThought,
      innerThought: 'This thought appeared out of nowhere. Where did that come from?',
      tags: ['anomaly', 'planted'],
    };
    memories = [plantedMemory, ...memories].slice(0, 5);
  }

  // Brain decides
  let decision;
  try {
    decision = await brain.decide(state, memories, socialContext, state.lastAction || null, longTermMemories, relationships, personality);
  } catch (err) {
    logger.error(`Brain failed: ${err.message}`);
    delete state.xConfigured;
    memoryManager.saveState(state);
    return;
  }

  logger.tick(`Action: ${decision.action}`);

  // Handle journal action — write to journal file
  if (decision.action === 'journal') {
    try {
      memoryManager.addJournalEntry({
        content: decision.content,
        mood: state.mood,
        energy: state.energy,
        innerThought: decision.innerThought,
        day: state.day,
        hour: state.hour,
      });
    } catch (err) {
      logger.error(`Failed to write journal: ${err.message}`);
    }
  }

  // Execute social actions
  const isSocialAction = ['post_x', 'read_x', 'reply_x'].includes(decision.action);
  if (isSocialAction) {
    if (!state.xConfigured) {
      logger.warn('Walter chose a social action but X is not configured. Falling back to think.');
      decision.action = 'think';
      decision.content = decision.content || 'Thought about posting something but the moment passed.';
    } else {
      try {
        await executeSocialAction(decision, state, memories);
      } catch (err) {
        logger.error(`Social action failed: ${err.message}. Falling back to think.`);
        decision.action = 'think';
        decision.content = "Tried to do something online but it didn't work out. Moved on.";
      }
    }
  }

  logger.tick(`Content: ${decision.content}`);
  logger.tick(`Inner thought: ${decision.innerThought}`);

  // Apply mood/energy
  const moodBefore = state.mood;
  state.mood = clamp(state.mood + decision.moodChange, -1, 1);
  state.energy = clamp(state.energy + decision.energyChange, 0, 1);

  logger.tick(`Mood: ${moodBefore.toFixed(2)} → ${state.mood.toFixed(2)} | Energy: ${state.energy.toFixed(2)}`);

  // Personality evolution
  try {
    memoryManager.evolvePersonality(decision.action, decision.moodChange);
  } catch (err) {
    logger.error(`Personality evolution failed: ${err.message}`);
  }

  // Store in short-term memory
  try {
    memoryManager.addMemory({
      action: decision.action,
      content: decision.content,
      innerThought: decision.innerThought,
      mood_before: moodBefore,
      mood_after: state.mood,
      energy: state.energy,
      tags: decision.action === 'journal' ? ['journal'] : [decision.action],
    });
  } catch (err) {
    logger.error(`Failed to save memory: ${err.message}`);
  }

  // Compress short-term → long-term if needed
  try {
    memoryManager.compressMemories();
  } catch (err) {
    logger.error(`Memory compression failed: ${err.message}`);
  }

  // Persist last action, save state
  state.lastAction = decision.action;
  delete state.xConfigured;

  try {
    memoryManager.saveState(state);
  } catch (err) {
    logger.error(`Failed to save state: ${err.message}`);
  }

  logger.tick('--- TICK END ---\n');

  // Notify observer dashboard
  if (onTickCallback) {
    try {
      onTickCallback({
        state: memoryManager.loadState(),
        decision,
        personality: memoryManager.loadPersonality(),
        anomalyCount: memoryManager.getAnomalyCount(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`onTick callback failed: ${err.message}`);
    }
  }
}

function start(options = {}) {
  onTickCallback = options.onTick || null;

  const minutes = config.tick.intervalMinutes;
  logger.info(`Tick engine starting. Interval: ${minutes} minute(s).`);

  runTick();

  if (minutes < 1) {
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
