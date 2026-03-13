const logger = require('./utils/logger');
const config = require('./utils/config');
const observerServer = require('./observer/server');
const tickEngine = require('./core/tick-engine');

logger.info('Walter AI v2 starting...');
logger.info(`Model: ${config.ollama.model} @ ${config.ollama.host}`);
logger.info(`Tick interval: ${config.tick.intervalMinutes} minute(s)`);

// Start observer dashboard first
observerServer.start();

// Start tick engine, wiring its post-tick callback to the dashboard
tickEngine.start({ onTick: observerServer.onTick });
