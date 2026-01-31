const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });
  
  // 加载打包好的构建文件
  win.loadFile('/Users/moonshot/kimi-cowork/frontend/build/index.html');
  
  // 打开开发者工具
  win.webContents.openDevTools();
  
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[${level}] ${message}`);
  });
}

app.whenReady().then(createWindow);
