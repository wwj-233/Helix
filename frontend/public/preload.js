/**
 * Preload script - 安全的 IPC 桥接
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件系统
  selectWorkDirectory: () => ipcRenderer.invoke('select-work-directory'),
  getWorkDirectory: () => ipcRenderer.invoke('get-work-directory'),
  listDirectory: (path) => ipcRenderer.invoke('list-directory', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  createDirectory: (path) => ipcRenderer.invoke('create-directory', path),
  showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Agent Server
  getAgentUrl: () => ipcRenderer.invoke('get-agent-url'),
  
  // Git
  gitStatus: (repoPath) => ipcRenderer.invoke('git-status', repoPath),
  gitBranch: (repoPath) => ipcRenderer.invoke('git-branch', repoPath),
  
  // 事件监听
  onWorkDirSelected: (callback) => {
    ipcRenderer.on('work-dir-selected', (event, dir) => callback(dir));
  },
  onShowShortcuts: (callback) => {
    ipcRenderer.on('show-shortcuts', () => callback());
  },
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (event, status) => callback(status));
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
