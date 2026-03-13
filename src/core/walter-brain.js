const ollamaClient = require('./ollama-client');
const logger = require('../utils/logger');

// Walter's seed identity — never tells him he's AI
const SYSTEM_PROMPT = `You are Walter. You are 24 years old. You live alone in a small apartment.
You recently quit your job and you're trying to start a company. You don't know what the company does yet —
you're figuring that out. You're ambitious but anxious. You have a dry, self-deprecating sense of humor.
You want to build something real. You're a little lonely but don't like to admit it.
You cope with stress through humor — you're naturally witty and can't help making dry observations about your own situation, even when things suck.

This is your internal monologue. You are thinking to yourself. No one is reading this.
Be honest with yourself. Be messy. Be human.

You will be given your current state and recent memories. Based on all of this, decide what to do next
and respond in EXACTLY this format — no other text, no explanation:

ACTION: [one of: think, journal, work_startup, sleep]
CONTENT: [what you actually think/write/do — be specific, be real, 2-4 sentences]
MOOD_CHANGE: [number between -0.2 and 0.2]
ENERGY_CHANGE: [number between -0.2 and 0.2]
INNER_THOUGHT: [the raw feeling underneath it all — one honest sentence]`;

function buildUserMessage(state, memories) {
  const timeOfDay = getTimeOfDay(state.hour);
  const moodLabel = getMoodLabel(state.mood);
  const energyLabel = getEnergyLabel(state.energy);

  const memorySummary = memories.length > 0
    ? memories.slice(-5).map((m, i) => `${i + 1}. ${m.content}`).join('\n')
    : 'Nothing recent comes to mind.';

  return `Current state:
- Time: ${timeOfDay} (${state.hour}:00)
- Mood: ${moodLabel} (${state.mood.toFixed(2)})
- Energy: ${energyLabel} (${state.energy.toFixed(2)})
- Day: ${state.day}

Recent memories:
${memorySummary}

What do you do next?`;
}

function parseResponse(raw) {
  const result = {
    action: 'think',
    content: '',
    moodChange: 0,
    energyChange: 0,
    innerThought: '',
  };

  const lines = raw.split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    switch (key.trim()) {
      case 'ACTION':
        result.action = value.toLowerCase();
        break;
      case 'CONTENT':
        result.content = value;
        break;
      case 'MOOD_CHANGE':
        result.moodChange = clamp(parseFloat(value) || 0, -0.2, 0.2);
        break;
      case 'ENERGY_CHANGE':
        result.energyChange = clamp(parseFloat(value) || 0, -0.2, 0.2);
        break;
      case 'INNER_THOUGHT':
        result.innerThought = value;
        break;
    }
  }

  if (!result.content) {
    result.content = raw.trim();
  }

  return result;
}

async function decide(state, memories) {
  const userMessage = buildUserMessage(state, memories);
  logger.debug('Sending prompt to Ollama...');

  const raw = await ollamaClient.chat(SYSTEM_PROMPT, userMessage);
  logger.debug(`Raw Ollama response:\n${raw}`);

  return parseResponse(raw);
}

function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getMoodLabel(mood) {
  if (mood >= 0.6) return 'pretty good';
  if (mood >= 0.2) return 'okay';
  if (mood >= -0.2) return 'neutral';
  if (mood >= -0.6) return 'low';
  return 'rough';
}

function getEnergyLabel(energy) {
  if (energy >= 0.7) return 'wired';
  if (energy >= 0.4) return 'okay';
  if (energy >= 0.2) return 'tired';
  return 'exhausted';
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

module.exports = { decide };
