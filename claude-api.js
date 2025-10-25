const puppeteer = require('puppeteer');
const { loadConfig } = require('./config-manager');

async function fetchClaudeUsage() {
  let browser;
  try {
    // 設定を読み込み
    const config = loadConfig();
    if (!config) {
      throw new Error('設定が見つかりません。設定画面でcurlコマンドを貼り付けてください。');
    }

    browser = await puppeteer.launch({
      headless: true, // バックグラウンドで実行
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // User-Agentを設定
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

    // Cookieを設定
    await page.setCookie(...config.cookies);

    // 追加のヘッダーを設定
    const headers = {
      'anthropic-client-platform': 'web_claude_ai',
      'anthropic-client-sha': 'unknown',
      'anthropic-client-version': '1.0.0',
      ...config.headers
    };
    await page.setExtraHTTPHeaders(headers);

    const response = await page.goto(
      `https://claude.ai/api/organizations/${config.orgId}/usage`,
      { waitUntil: 'networkidle2', timeout: 30000 }
    );

    const status = response.status();

    if (status === 200) {
      const content = await page.content();
      const jsonMatch = content.match(/<pre[^>]*>(.*?)<\/pre>/s);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      } else {
        return await response.json();
      }
    } else {
      throw new Error(`Failed to fetch data. Status: ${status}`);
    }
  } catch (error) {
    console.error('Error fetching usage data:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { fetchClaudeUsage };
