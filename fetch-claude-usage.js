const puppeteer = require('puppeteer');
const { loadConfig } = require('./config-manager');

async function getClaudeUsage() {
  console.log('Loading configuration...');
  const config = loadConfig();

  if (!config) {
    console.error('❌ Error: config.json not found.');
    console.log('\nPlease run the app first and configure it via the settings window,');
    console.log('or manually create config.json by pasting a curl command.');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // 動作確認のため表示
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // User-Agentを設定
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

  // 設定からcookieを取得
  console.log('Setting cookies...');
  await page.setCookie(...config.cookies);

  // 追加のヘッダーを設定
  const headers = {
    'anthropic-client-platform': 'web_claude_ai',
    'anthropic-client-sha': 'unknown',
    'anthropic-client-version': '1.0.0',
    ...config.headers
  };
  await page.setExtraHTTPHeaders(headers);

  try {
    console.log('Fetching usage data...');
    const response = await page.goto(
      `https://claude.ai/api/organizations/${config.orgId}/usage`,
      { waitUntil: 'networkidle2', timeout: 30000 }
    );

    // レスポンスのステータスを確認
    const status = response.status();
    console.log(`Response status: ${status}`);

    if (status === 200) {
      // JSONデータを取得
      const content = await page.content();

      // <pre>タグ内のJSONを抽出（APIレスポンスの場合）
      const jsonMatch = content.match(/<pre[^>]*>(.*?)<\/pre>/s);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        console.log('\n=== Claude Usage Data ===');
        console.log(JSON.stringify(data, null, 2));

        // ファイルに保存
        const fs = require('fs');
        fs.writeFileSync('claude-usage-data.json', JSON.stringify(data, null, 2));
        console.log('\n✅ Data saved to claude-usage-data.json');
      } else {
        // JSONを直接取得
        const data = await response.json();
        console.log('\n=== Claude Usage Data ===');
        console.log(JSON.stringify(data, null, 2));

        // ファイルに保存
        const fs = require('fs');
        fs.writeFileSync('claude-usage-data.json', JSON.stringify(data, null, 2));
        console.log('\n✅ Data saved to claude-usage-data.json');
      }
    } else {
      console.error(`Failed to fetch data. Status: ${status}`);
      const text = await response.text();
      console.log('Response:', text.substring(0, 500));
    }
  } catch (error) {
    console.error('Error fetching usage data:', error.message);

    // エラー時にページのスクリーンショットを撮る
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('Screenshot saved to error-screenshot.png');
  }

  console.log('\nClosing browser...');
  await browser.close();
}

// 実行
getClaudeUsage().catch(console.error);
