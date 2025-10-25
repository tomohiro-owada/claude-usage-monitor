/**
 * curlコマンドからcookie情報とorg IDを抽出
 */
function parseCurlCommand(curlCommand) {
  const result = {
    cookies: [],
    orgId: null,
    headers: {}
  };

  try {
    // URLからOrg IDを抽出
    const urlMatch = curlCommand.match(/organizations\/([a-f0-9-]+)\/usage/);
    if (urlMatch) {
      result.orgId = urlMatch[1];
    }

    // -b オプションからcookieを抽出
    const cookieOptionMatch = curlCommand.match(/-b\s+'([^']+)'/);
    if (cookieOptionMatch) {
      const cookieString = cookieOptionMatch[1];
      const cookiePairs = cookieString.split('; ');

      cookiePairs.forEach(pair => {
        const [name, ...valueParts] = pair.split('=');
        const value = valueParts.join('=');
        if (name && value) {
          result.cookies.push({
            name: name.trim(),
            value: value.trim(),
            domain: '.claude.ai',
            path: '/'
          });
        }
      });
    }

    // -H オプションからヘッダーを抽出
    const headerMatches = curlCommand.matchAll(/-H\s+'([^:]+):\s*([^']+)'/g);
    for (const match of headerMatches) {
      const headerName = match[1].trim();
      const headerValue = match[2].trim();
      result.headers[headerName] = headerValue;
    }

  } catch (error) {
    throw new Error(`curlコマンドの解析に失敗しました: ${error.message}`);
  }

  // 必須項目のチェック
  if (!result.orgId) {
    throw new Error('Organization IDが見つかりません');
  }

  if (result.cookies.length === 0) {
    throw new Error('Cookieが見つかりません');
  }

  const hasSessionKey = result.cookies.some(c => c.name === 'sessionKey');
  if (!hasSessionKey) {
    throw new Error('sessionKeyが見つかりません');
  }

  return result;
}

module.exports = { parseCurlCommand };
