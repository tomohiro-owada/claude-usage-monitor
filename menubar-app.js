const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fetchClaudeUsage } = require('./claude-api');
const { saveCurlSettings, hasConfig } = require('./config-manager');

let tray = null;
let usageData = null;
let lastUpdate = null;
let settingsWindow = null;

// 更新間隔（ミリ秒）- 1分
const UPDATE_INTERVAL = 60 * 1000;

// アプリ起動時
app.whenReady().then(() => {
  createTray();

  // 設定がない場合は設定画面を開く
  if (!hasConfig()) {
    openSettings();
  } else {
    // 初回データ取得
    updateUsageData();

    // 定期更新（1分ごと）
    setInterval(updateUsageData, UPDATE_INTERVAL);
  }
});

// macOSでウィンドウを全て閉じてもアプリを終了しない
app.on('window-all-closed', (e) => {
  if (!app.isQuitting) {
    e.preventDefault();
  }
});

// IPCハンドラー
ipcMain.handle('save-curl-settings', async (event, curlCommand) => {
  const result = saveCurlSettings(curlCommand);
  if (result.success) {
    // 設定保存後にデータを更新
    setTimeout(() => {
      updateUsageData();
      // 定期更新を開始（まだ開始していない場合）
      if (!hasConfig()) {
        setInterval(updateUsageData, UPDATE_INTERVAL);
      }
    }, 500);
  }
  return result;
});

ipcMain.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

function createTray() {
  // トレイアイコンを作成（テキストベース）
  const icon = createIcon('...');
  tray = new Tray(icon);

  tray.setToolTip('Claude Usage Monitor');
  updateTrayMenu();
}

function createIcon(text) {
  // 16x16のアイコンを作成
  const canvas = require('canvas');
  const canvasInstance = canvas.createCanvas(22, 22);
  const ctx = canvasInstance.getContext('2d');

  // 背景を透明に
  ctx.clearRect(0, 0, 22, 22);

  // テキストを描画
  ctx.font = 'bold 14px -apple-system';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 11, 12);

  const buffer = canvasInstance.toBuffer('image/png');
  return nativeImage.createFromBuffer(buffer);
}

function createTitleImage(text) {
  // メニューバー用のテキスト画像を作成（白い大きな文字）
  const canvas = require('canvas');

  const fontSize = 20; // フォントサイズ
  console.log(`Creating title image: "${text}" with fontSize=${fontSize}`);

  const canvasInstance = canvas.createCanvas(400, 22);
  const ctx = canvasInstance.getContext('2d');
  ctx.font = `bold ${fontSize}px -apple-system`;
  const metrics = ctx.measureText(text);
  const width = Math.ceil(metrics.width) + 8;
  const height = 22;

  console.log(`Canvas size: ${width}x${height}`);

  // 実際のサイズでキャンバスを再作成
  const finalCanvas = canvas.createCanvas(width, height);
  const finalCtx = finalCanvas.getContext('2d');

  // 背景を透明に
  finalCtx.clearRect(0, 0, width, height);

  // 白い文字で描画
  finalCtx.font = `bold ${fontSize}px -apple-system`;
  finalCtx.fillStyle = 'white';
  finalCtx.textAlign = 'left';
  finalCtx.textBaseline = 'middle';
  finalCtx.fillText(text, 4, height / 2);

  const buffer = finalCanvas.toBuffer('image/png');
  const image = nativeImage.createFromBuffer(buffer);
  image.setTemplateImage(true); // テンプレート画像として設定（システムが色調整）
  console.log('Title image created successfully');
  return image;
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 700,
    resizable: true,
    title: 'Claude Usage Monitor - 設定',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

async function updateUsageData() {
  try {
    console.log('Fetching usage data...');
    usageData = await fetchClaudeUsage();
    lastUpdate = new Date();

    console.log('Usage data updated:', usageData);
    updateTrayMenu();
  } catch (error) {
    console.error('Failed to update usage data:', error);
    usageData = { error: error.message };
    updateTrayMenu();
  }
}

function updateTrayMenu() {
  if (!usageData) {
    tray.setTitle('読込中...');
    const contextMenu = Menu.buildFromTemplate([
      { label: '読込中...', enabled: false },
      { type: 'separator' },
      { label: '設定', click: openSettings },
      { label: '終了', click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);
    return;
  }

  if (usageData.error) {
    tray.setTitle('エラー');
    const contextMenu = Menu.buildFromTemplate([
      { label: 'データ取得エラー', enabled: false },
      { label: usageData.error, enabled: false },
      { type: 'separator' },
      { label: '更新', click: updateUsageData },
      { label: '設定', click: openSettings },
      { label: '終了', click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);
    return;
  }

  // メニューバーのタイトルを更新（S:8% W:91%形式）
  const sevenDayUtil = usageData.seven_day?.utilization || 0;
  const fiveHourUtil = usageData.five_hour?.utilization || 0;

  // 画像を半角スペース、テキストを実際の内容
  const titleText = `S:${fiveHourUtil}% W:${sevenDayUtil}%`;
  console.log('Setting title:', titleText);

  const titleImage = createTitleImage(' '); // 半角スペース
  tray.setImage(titleImage);

  tray.setTitle(titleText); // 実際の内容

  // コンテキストメニューを作成
  const contextMenu = Menu.buildFromTemplate([
    { label: `Claude 使用状況`, enabled: false, type: 'normal' },
    { type: 'separator' },
    {
      label: `5時間制限: ${fiveHourUtil}%`,
      enabled: false,
      type: 'normal'
    },
    {
      label: `  リセット: ${formatDate(usageData.five_hour?.resets_at)}`,
      enabled: false,
      type: 'normal'
    },
    { type: 'separator' },
    {
      label: `7日間制限: ${sevenDayUtil}%`,
      enabled: false,
      type: 'normal'
    },
    {
      label: `  リセット: ${formatDate(usageData.seven_day?.resets_at)}`,
      enabled: false,
      type: 'normal'
    },
    { type: 'separator' },
    {
      label: `Opus (7日): ${usageData.seven_day_opus?.utilization || 0}%`,
      enabled: false,
      type: 'normal'
    },
    { type: 'separator' },
    {
      label: `最終更新: ${lastUpdate ? formatTime(lastUpdate) : 'N/A'}`,
      enabled: false,
      type: 'normal'
    },
    { label: '今すぐ更新', click: updateUsageData, type: 'normal' },
    { type: 'separator' },
    { label: '設定', click: openSettings, type: 'normal' },
    { label: '終了', click: () => app.quit(), type: 'normal' }
  ]);

  tray.setContextMenu(contextMenu);
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  const now = new Date();
  const diff = date - now;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours < 24) {
    return `${hours}時間${minutes}分後`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days}日${hours % 24}時間後`;
  }
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
