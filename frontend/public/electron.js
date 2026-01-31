/**
 * 🧬 Helix - AI Pair Programming
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

// 开发模式检测
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 全局变量
let mainWindow = null;
let agentServer = null;
let currentWorkDir = null;

// Agent Server 配置
const AGENT_PORT = 3456;
const AGENT_URL = `http://127.0.0.1:${AGENT_PORT}`;

// ============ 窗口管理 ============

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      devTools: true
    },
    titleBarStyle: 'hidden',  // 隐藏标题栏但保留系统按钮
    trafficLightPosition: { x: 12, y: 12 },
    show: false
  });

  // 加载应用
  // 优先加载 build 目录（开发时），如果不存在则加载 app.asar（打包后）
  const buildPath = path.join(__dirname, '../build/index.html');
  const asarPath = path.join(__dirname, 'index.html');
  
  if (require('fs').existsSync(buildPath)) {
    console.log('Loading from build directory:', buildPath);
    mainWindow.loadFile(buildPath);
  } else {
    console.log('Loading from app.asar:', asarPath);
    mainWindow.loadFile(asarPath);
  }
  mainWindow.webContents.openDevTools();

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 处理窗口关闭
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 创建应用菜单
  createApplicationMenu();
  
  // 注册复制粘贴快捷键
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      if (input.key.toLowerCase() === 'c') {
        mainWindow.webContents.copy();
        event.preventDefault();
      } else if (input.key.toLowerCase() === 'v') {
        mainWindow.webContents.paste();
        event.preventDefault();
      } else if (input.key.toLowerCase() === 'x') {
        mainWindow.webContents.cut();
        event.preventDefault();
      } else if (input.key.toLowerCase() === 'a') {
        mainWindow.webContents.selectAll();
        event.preventDefault();
      }
    }
  });
}

function createApplicationMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开工作目录',
          accelerator: 'CmdOrCtrl+O',
          click: () => selectWorkDirectory()
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: '设置',
      submenu: [
        {
          label: '模型设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-settings');
            }
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reload();
          }
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '快捷键',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-shortcuts');
            }
          }
        },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Kimi Cowork',
              message: 'Kimi Cowork',
              detail: 'AI 结对编程桌面应用\n版本: 1.0.0'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ============ Agent Server 管理 ============

function findAgentServerPath() {
  // 按优先级查找 agent-server 路径
  const possiblePaths = [
    // 开发模式
    path.join(__dirname, '../../agent-server/main.py'),
    // 打包后 - 相邻目录
    path.join(process.resourcesPath, 'agent-server/main.py'),
    path.join(process.resourcesPath, '../agent-server/main.py'),
    path.join(app.getPath('exe'), '../../agent-server/main.py'),
    // 打包后 - app.asar.unpacked 或 build 目录
    path.join(process.resourcesPath, 'app.asar.unpacked/agent-server/main.py'),
    path.join(process.resourcesPath, 'app/agent-server/main.py'),
    // 当前工作目录
    path.join(process.cwd(), 'agent-server/main.py'),
    path.join(process.cwd(), '../agent-server/main.py'),
  ];
  
  for (const p of possiblePaths) {
    console.log('检查路径:', p, fs.existsSync(p) ? '存在' : '不存在');
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

function checkHealth() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`${AGENT_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.abort();
      resolve(false);
    });
  });
}

function startAgentServer() {
  return new Promise(async (resolve, reject) => {
    // 首先检查 server 是否已经在运行
    const isRunning = await checkHealth();
    if (isRunning) {
      console.log('Agent Server 已经在运行');
      resolve();
      return;
    }

    // 查找后端路径
    const serverPath = findAgentServerPath();
    
    if (!serverPath) {
      reject(new Error('找不到 agent-server/main.py 文件'));
      return;
    }

    // 尝试多种方式找到 Python 并获取 site-packages
    let pythonCmd = '/opt/homebrew/bin/python3'; // 默认使用 Homebrew Python
    let pythonSitePackages = [];
    
    // 检测可用的 Python 并获取 site-packages
    const pythonPaths = [
      '/opt/homebrew/bin/python3',
      '/usr/local/bin/python3',
      '/usr/bin/python3',
      'python3'
    ];
    
    for (const pyPath of pythonPaths) {
      try {
        const checkResult = require('child_process').execSync(
          `${pyPath} -c "import sys; print(sys.executable); [print(p) for p in sys.path if 'site-packages' in p]"`,
          { encoding: 'utf8', shell: true, env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } }
        );
        const lines = checkResult.trim().split('\n');
        pythonCmd = lines[0] || pyPath;
        pythonSitePackages = lines.slice(1).filter(p => p.trim());
        console.log('找到 Python:', pythonCmd);
        console.log('Site-packages:', pythonSitePackages);
        break;
      } catch (e) {
        console.log(`尝试 ${pyPath} 失败:`, e.message);
      }
    }
    
    if (!pythonCmd) {
      reject(new Error('找不到 Python 解释器'));
      return;
    }

    console.log('启动 Agent Server:', serverPath);

    // 启动 Agent Server
    const serverDir = path.dirname(serverPath);
    const env = { 
      ...process.env,
      PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + (process.env.PATH || ''),
      PYTHONPATH: [serverDir, ...pythonSitePackages].join(':')
    };
    console.log('PYTHONPATH:', env.PYTHONPATH);
    
    agentServer = spawn('python3', [serverPath], {
      env: env,
      detached: false,
      cwd: serverDir,
      shell: true
    });

    let startupError = '';

    agentServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Agent Server: ${output}`);
    });

    agentServer.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`Agent Server Error: ${output}`);
      startupError += output;
    });

    agentServer.on('error', (err) => {
      console.error('启动 Agent Server 失败:', err);
      reject(err);
    });

    agentServer.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Agent Server 退出，代码: ${code}`);
      }
    });

    // 等待 server 启动
    let attempts = 0;
    const maxAttempts = 60; // 60秒超时
    const checkInterval = setInterval(async () => {
      const healthy = await checkHealth();
      if (healthy) {
        clearInterval(checkInterval);
        console.log('Agent Server 启动成功');
        resolve();
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          // 杀掉失败的进程
          if (agentServer) {
            agentServer.kill();
            agentServer = null;
          }
          reject(new Error(`Agent Server 启动超时 (60秒)\n可能原因：\n- Python 依赖未安装: pip install -r agent-server/requirements.txt\n- Python 错误: ${startupError.slice(0, 200)}`));
        }
      }
    }, 1000);
  });
}

function stopAgentServer() {
  if (agentServer) {
    agentServer.kill();
    agentServer = null;
  }
}

// ============ IPC 处理 ============

// 选择工作目录
async function selectWorkDirectory() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择工作目录'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    currentWorkDir = result.filePaths[0];
    if (mainWindow) {
      mainWindow.webContents.send('work-dir-selected', currentWorkDir);
    }
    return currentWorkDir;
  }
  return null;
}

ipcMain.handle('select-work-directory', selectWorkDirectory);

// 获取当前工作目录
ipcMain.handle('get-work-directory', () => {
  return currentWorkDir || process.cwd();
});

// 文件系统操作
ipcMain.handle('list-directory', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
      size: entry.isFile() ? fs.statSync(path.join(dirPath, entry.name)).size : null
    }));
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 在文件管理器中打开
ipcMain.handle('show-in-folder', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  try {
    // 确保 URL 正确编码
    let encodedUrl = url;
    // 如果 URL 包含非 ASCII 字符，需要进行编码
    if (/[^\x00-\x7F]/.test(url)) {
      try {
        // 尝试解码再重新编码，避免双重编码
        const decoded = decodeURIComponent(url);
        encodedUrl = encodeURI(decoded);
      } catch (e) {
        // 解码失败，直接使用 encodeURI
        encodedUrl = encodeURI(url);
      }
    }
    console.log('Opening external URL:', encodedUrl);
    await shell.openExternal(encodedUrl);
  } catch (error) {
    console.error('Failed to open external URL:', error);
    throw error;
  }
});

// 获取 Agent Server URL
ipcMain.handle('get-agent-url', () => {
  return AGENT_URL;
});

// ============ Git 操作 ============

ipcMain.handle('git-status', async (event, repoPath) => {
  return new Promise((resolve) => {
    exec('git status --porcelain', { cwd: repoPath }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      const files = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => ({
          status: line.substring(0, 2),
          file: line.substring(3)
        }));
      resolve({ success: true, files });
    });
  });
});

ipcMain.handle('git-branch', async (event, repoPath) => {
  return new Promise((resolve) => {
    exec('git branch --show-current', { cwd: repoPath }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, branch: stdout.trim() });
    });
  });
});

// ============ 应用生命周期 ============

app.whenReady().then(async () => {
  let serverStarted = false;
  
  try {
    await startAgentServer();
    serverStarted = true;
  } catch (error) {
    console.error('Agent Server 启动失败:', error);
    // 显示警告但不退出应用
    dialog.showMessageBox(null, {
      type: 'warning',
      title: 'Agent Server 启动警告',
      message: '无法自动启动 Agent Server',
      detail: `${error.message}\n\n您可以：\n1. 检查 Python3 是否已安装\n2. 检查依赖是否已安装: pip install -r agent-server/requirements.txt\n3. 手动启动后端: python agent-server/main.py\n\n应用将继续运行，但部分功能可能不可用。`,
      buttons: ['确定'],
      defaultId: 0
    });
  }
  
  createWindow();
  
  // 通知前端服务器状态
  if (mainWindow && !serverStarted) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('server-status', { 
        connected: false, 
        message: 'Agent Server 未启动，请手动启动后端服务' 
      });
    });
  }
});

app.on('window-all-closed', () => {
  stopAgentServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  stopAgentServer();
});
