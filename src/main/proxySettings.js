const path = require('path');
const os = require('os');
const fs = require('fs');

// Settings file location
const SETTINGS_PATH = path.join(os.homedir(), 'no1team', 'brain', 'proxy-settings.json');

// Default settings — user configures these in Settings page
const DEFAULT_SETTINGS = {
  proxyUrl: 'http://localhost:20128',
  apiKey: 'your-9router-api-key',
  claudeBaseUrl: 'http://localhost:20128',
  openaiBaseUrl: 'http://localhost:20128/v1',
  geminiBaseUrl: 'http://localhost:20128/v1',
};

function loadProxySettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch(e) {
    console.error('Failed to parse proxy config:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveProxySettings(settings) {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch(e) {
    console.error('Failed to save proxy settings:', e);
  }
}

module.exports = { loadProxySettings, saveProxySettings };
