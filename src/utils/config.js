require('dotenv').config();

const config = {
  ollama: {
    model: process.env.OLLAMA_MODEL || 'llama3.1',
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  },

  x: {
    appKey: process.env.X_APP_KEY,
    appSecret: process.env.X_APP_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  },

  tick: {
    intervalMinutes: parseFloat(process.env.TICK_INTERVAL_MINUTES) || 20,
  },

  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT) || 3000,
    password: process.env.DASHBOARD_PASSWORD || 'walter',
  },

  walter: {
    timezone: process.env.WALTER_TIMEZONE || 'America/New_York',
    sleepHour: parseInt(process.env.WALTER_SLEEP_HOUR) || 23,
    wakeHour: parseInt(process.env.WALTER_WAKE_HOUR) || 7,
  },

  paths: {
    data: 'data',
    memory: 'data/memory',
    logs: 'data/logs',
    characters: 'data/characters',
  },
};

module.exports = config;
