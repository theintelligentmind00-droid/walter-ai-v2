const logger = require('./utils/logger');
const config = require('./utils/config');
const tickEngine = require('./core/tick-engine');

logger.info('Walter AI v2 starting...');
logger.info(`Model: ${config.ollama.model} @ ${config.ollama.host}`);
logger.info(`Tick interval: ${config.tick.intervalMinutes} minute(s)`);

tickEngine.start();
