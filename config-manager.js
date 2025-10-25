const fs = require('fs');
const path = require('path');
const { parseCurlCommand } = require('./curl-parser');

const CONFIG_FILE = path.join(__dirname, 'config.json');

/**
 * 設定をファイルから読み込み
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
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

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    return { success: true };
  } catch (error) {
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
