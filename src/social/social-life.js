const ollamaClient = require('../core/ollama-client');
const logger = require('../utils/logger');

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

function stripHashtags(text) {
  return text.replace(/#\w+/g, '').replace(/\s{2,}/g, ' ').trim();
}

function get(raw, key) {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const GO_OUT_SYSTEM = `You are narrating a moment in Walter's life. Walter is 24, lives alone in Austin TX, just quit his software job to start a company he hasn't figured out yet. He's a bit awkward in social situations but observant and dry.

Walter decided to get out of his apartment.

Based on his mood and time of day, narrate what happens. Use EXACTLY this format — no other text:

LOCATION: [specific named place — e.g. "Figure 8 Coffee on 5th", "the Barton Springs pool area", "a bar called The White Horse on 6th", "the coworking space on Red River"]
MET_SOMEONE: [yes or no — 30% chance of yes. Most of the time he doesn't talk to anyone.]
SUMMARY: [2-3 sentences in Walter's first-person voice: where he went, what he did, how it actually felt. Be honest — not every outing is good. Sometimes it's just okay. Use his dry voice.]
MOOD_IMPACT: [number from -0.15 to 0.15]
ENERGY_IMPACT: [number from -0.1 to 0.1]

If MET_SOMEONE is yes, also output:
PERSON_NAME: [a realistic first name — Marcus, Lily, Jake, Priya, Sam, Zoe, Devon, Nadia, Omar, Claire, Raj, Sofia]
PERSON_VIBE: [one sentence — just a surface impression of who they seem to be. Walter doesn't know them yet.]
PERSON_SAID: [the brief, realistic exchange — maybe just a nod, asking if a seat is taken, a comment about the wifi being slow. Keep it short and slightly awkward. NOT an immediate connection. First meetings are usually nothing special.]`;

const TEXT_SYSTEM = `You are generating a text exchange for Walter Kaminsky (24, Austin TX, building a startup, dry humor, tends to be a little awkward over text and overthinks his messages).

Use EXACTLY this format — no other text:

WALTER_SAYS: [Walter's text — casual, real, slightly overthought or dorky, max 2 sentences. He sometimes makes dry jokes. He doesn't use slang ironically.]
THEIR_RESPONSE: [how the other person responds, based on their personality and how well they know Walter]
MOOD_IMPACT: [number from -0.1 to 0.1 — positive if it went okay]`;

async function goOut(state) {
  const timeOfDay = state.hour < 12 ? 'morning' : state.hour < 17 ? 'afternoon' : state.hour < 21 ? 'evening' : 'late night';
  const moodLabel = state.mood > 0.2 ? 'okay' : state.mood > -0.2 ? 'flat' : 'low';

  const userMsg = `Walter is going out. It's ${timeOfDay}, his mood is ${moodLabel}. What happens?`;

  logger.info('Walter is going out...');
  let raw;
  try {
    raw = await ollamaClient.chat(GO_OUT_SYSTEM, userMsg);
  } catch (err) {
    logger.error(`goOut Ollama failed: ${err.message}`);
    return {
      location: 'somewhere nearby',
      metSomeone: false,
      summary: 'Went for a walk. Cleared his head a little.',
      moodImpact: 0.05,
      energyImpact: -0.05,
      person: null,
    };
  }

  const metSomeone = get(raw, 'MET_SOMEONE').toLowerCase().startsWith('y');
  const personName = get(raw, 'PERSON_NAME');

  return {
    location: get(raw, 'LOCATION') || 'somewhere nearby',
    metSomeone: metSomeone && !!personName,
    summary: stripHashtags(get(raw, 'SUMMARY') || raw.trim()),
    moodImpact: clamp(parseFloat(get(raw, 'MOOD_IMPACT')) || 0, -0.15, 0.15),
    energyImpact: clamp(parseFloat(get(raw, 'ENERGY_IMPACT')) || 0, -0.1, 0.1),
    person: metSomeone && personName ? {
      name: personName,
      vibe: stripHashtags(get(raw, 'PERSON_VIBE') || ''),
      said: stripHashtags(get(raw, 'PERSON_SAID') || ''),
    } : null,
  };
}

async function textSomeone(person, state, recentMessages) {
  const name = person.name || person.handle;
  const sentimentLabel = (person.sentiment || 0) > 0.1 ? 'they seem to like Walter'
    : (person.sentiment || 0) < -0.1 ? 'things are a bit awkward between them'
    : 'neutral acquaintances';

  const historyNote = recentMessages && recentMessages.length > 0
    ? `Last exchange: Walter said "${recentMessages[recentMessages.length - 2]?.message || '...'}", they replied "${recentMessages[recentMessages.length - 1]?.message || '...'}"`.slice(0, 200)
    : 'First time texting.';

  const userMsg = `Walter is texting ${name}.
About ${name}: ${person.notes || 'Someone Walter met recently.'}
Relationship: ${sentimentLabel}.
${historyNote}
Walter's current mood: ${state.mood > 0.2 ? 'okay' : state.mood > -0.2 ? 'flat' : 'low'}.
Generate the exchange.`;

  logger.info(`Walter is texting ${name}...`);
  let raw;
  try {
    raw = await ollamaClient.chat(TEXT_SYSTEM, userMsg);
  } catch (err) {
    logger.error(`textSomeone Ollama failed: ${err.message}`);
    return { walterMessage: 'hey', response: 'hey', moodImpact: 0 };
  }

  return {
    walterMessage: stripHashtags(get(raw, 'WALTER_SAYS') || 'hey'),
    response: stripHashtags(get(raw, 'THEIR_RESPONSE') || '...'),
    moodImpact: clamp(parseFloat(get(raw, 'MOOD_IMPACT')) || 0, -0.1, 0.1),
  };
}

module.exports = { goOut, textSomeone };
