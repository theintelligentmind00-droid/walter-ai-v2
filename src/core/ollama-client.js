const { Ollama } = require('ollama');
const config = require('../utils/config');
const logger = require('../utils/logger');

const client = new Ollama({ host: config.ollama.host });

async function chat(systemPrompt, userMessage) {
  const response = await client.chat({
    model: config.ollama.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: false,
  });
  return response.message.content;
}

async function isAvailable() {
  try {
    await client.list();
    return true;
  } catch (err) {
    logger.error(`Ollama unavailable: ${err.message}`);
    return false;
  }
}

module.exports = { chat, isAvailable };
