const fs = require('fs');
const path = require('path');
const { parseCurlCommand } = require('./curl-parser');

// Get config directory based on environment
function getConfigPath() {
  try {
    // Try to use Electron's app if available
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'config.json');
  } catch (error) {
    // Fall back to current directory for development/non-Electron environments
    return path.join(__dirname, 'config.json');
  }
}

const CONFIG_FILE = getConfigPath();

/**
 * 設定をファイルから読み込み
 */
function loadConfig() {
  try {
    console.log('Loading config from:', CONFIG_FILE);
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } else {
      console.log('Config file does not exist yet');
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }

  return null;
}

/**
 * curlコマンドから設定を保存
 */
function saveCurlSettings(curlCommand) {
  try {
    const parsed = parseCurlCommand(curlCommand);

    const config = {
      orgId: parsed.orgId,
      cookies: parsed.cookies,
      headers: parsed.headers,
      updatedAt: new Date().toISOString()
    };

    // Ensure the directory exists
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    console.log('Saving config to:', CONFIG_FILE);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    return { success: true };
  } catch (error) {
    console.error('Failed to save config:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 設定が存在するかチェック
 */
function hasConfig() {
  return fs.existsSync(CONFIG_FILE);
}

module.exports = {
  loadConfig,
  saveCurlSettings,
  hasConfig
};
