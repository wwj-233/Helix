import React, { useState, useEffect, useRef, useCallback } from 'react';
import FileExplorer from './components/FileExplorer';
import ChatPanel from './components/ChatPanel';
import GitPanel from './components/GitPanel';
import CodeEditor from './components/CodeEditor';
import WelcomeScreen from './components/WelcomeScreen';

function App() {
  // ============ 状态 ============
  const [workDir, setWorkDir] = useState(null);
  const [activeTab, setActiveTab] = useState('files'); // files, git
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // 左侧选中的文件（用于AI操作）
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    model: '',
    apiKey: '',
  });
  const [tempModel, setTempModel] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');

  // ============ 初始化 ============
  useEffect(() => {
    // 检查是否有保存的工作目录
    const savedWorkDir = localStorage.getItem('kimiCowork_workDir');
    if (savedWorkDir) {
      setWorkDir(savedWorkDir);
      setShowWelcome(false);
    }

    // 加载保存的设置
    const savedSettings = localStorage.getItem('kimiCowork_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        const newSettings = {
          model: parsed.model || '',
          apiKey: parsed.apiKey || '',
        };
        setSettings(newSettings);
        setTempModel(newSettings.model);
        setTempApiKey(newSettings.apiKey);
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }

    // 监听来自主进程的事件
    if (window.electronAPI) {
      window.electronAPI.onWorkDirSelected((dir) => {
        setWorkDir(dir);
        setShowWelcome(false);
        localStorage.setItem('kimiCowork_workDir', dir);
      });
      
      // 监听打开设置事件
      window.electronAPI.onOpenSettings?.(() => {
        setShowSettings(true);
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('work-dir-selected');
      }
    };
  }, []);

  // 保存设置
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('kimiCowork_settings', JSON.stringify(newSettings));
    
    // 通知 agent-server 更新设置
    if (window.electronAPI) {
      window.electronAPI.updateSettings?.(newSettings).catch(() => {
        // 如果 IPC 调用失败，设置会在下次请求时通过 WebSocket 发送
      });
    }
  };

  // ============ 文件操作 ============
  const handleSelectWorkDir = async () => {
    if (window.electronAPI) {
      const dir = await window.electronAPI.selectWorkDirectory();
      if (dir) {
        setWorkDir(dir);
        setShowWelcome(false);
        localStorage.setItem('kimiCowork_workDir', dir);
      }
    }
  };

  const handleFileSelect = (file) => {
    // 始终更新选中的文件（用于AI上下文）
    setSelectedFile(file);
    
    if (file.isDirectory) return;

    // 添加到打开的文件列表
    if (!openFiles.find(f => f.path === file.path)) {
      setOpenFiles([...openFiles, file]);
    }
    setActiveFile(file);
  };

  // 判断是否可以在浏览器中预览
  const isPreviewableFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['html', 'htm', 'svg'].includes(ext);
  };

  const handleFileClose = (file) => {
    const newOpenFiles = openFiles.filter(f => f.path !== file.path);
    setOpenFiles(newOpenFiles);
    
    if (activeFile && activeFile.path === file.path) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  const handleFileContentChange = (file, content) => {
    // 更新文件内容（标记为已修改）
    const updatedFiles = openFiles.map(f => 
      f.path === file.path ? { ...f, content, isModified: true } : f
    );
    setOpenFiles(updatedFiles);
    
    if (activeFile && activeFile.path === file.path) {
      setActiveFile({ ...activeFile, content, isModified: true });
    }
  };

  // 引用 ChatPanel 来调用其方法
  const chatPanelRef = useRef(null);

  // 让 AI 分析文件
  const handleAskAI = (file) => {
    if (chatPanelRef.current) {
      chatPanelRef.current.askAIAboutFile(file);
    }
  };

  // 处理 AI 修改文件后的刷新
  const handleFileModified = async (filePath) => {
    console.log('AI modified file, refreshing:', filePath);
    
    // 检查文件是否已在打开列表中
    const isOpen = openFiles.find(f => f.path === filePath);
    
    if (isOpen && window.electronAPI) {
      try {
        // 重新读取文件内容
        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
          // 更新文件内容（不标记为修改，因为是 AI 的修改）
          const updatedFiles = openFiles.map(f => 
            f.path === filePath ? { ...f, content: result.content, isModified: false } : f
          );
          setOpenFiles(updatedFiles);
          
          if (activeFile && activeFile.path === filePath) {
            setActiveFile({ ...activeFile, content: result.content, isModified: false });
          }
          
          console.log('File content refreshed:', filePath);
        }
      } catch (error) {
        console.error('Failed to refresh file:', error);
      }
    }
  };

  // ============ 渲染 ============
  if (showWelcome) {
    return (
      <WelcomeScreen 
        onSelectWorkDir={handleSelectWorkDir}
        onClose={() => setShowWelcome(false)}
      />
    );
  }

  return (
    <div className="app">
      {/* 顶部栏 */}
      <div className="topbar">
        <div className="logo">
          <span>🤖</span>
          <span>Helix</span>
        </div>
        
        <div className="work-dir-section">
          <button className="btn btn-secondary" onClick={handleSelectWorkDir}>
            📁 打开
          </button>
          {workDir && (
            <div className="work-dir-display" title={workDir}>
              {workDir}
            </div>
          )}
        </div>

        <div className="topbar-actions">
          {activeFile && isPreviewableFile(activeFile.name) && (
            <button 
              className="btn btn-secondary"
              onClick={() => {
                if (window.electronAPI && activeFile) {
                  window.electronAPI.openExternal(`file://${activeFile.path}`);
                }
              }}
              title="在浏览器中预览"
              style={{ marginRight: '8px' }}
            >
              🌐 预览
            </button>
          )}
          <button 
            className="btn btn-secondary"
            onClick={() => setShowSettings(true)}
            title="设置"
            style={{ marginRight: '8px' }}
          >
            ⚙️ 设置
          </button>
          <button 
            className="btn-icon"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title="切换侧边栏"
          >
            {isSidebarCollapsed ? '→' : '←'}
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 侧边栏 */}
        {!isSidebarCollapsed && (
          <div className="sidebar">
            <div className="sidebar-tabs">
              <button 
                className={`sidebar-tab ${activeTab === 'files' ? 'active' : ''}`}
                onClick={() => setActiveTab('files')}
              >
                📁 文件
              </button>
              <button 
                className={`sidebar-tab ${activeTab === 'git' ? 'active' : ''}`}
                onClick={() => setActiveTab('git')}
              >
                🔀 Git
              </button>
            </div>

            <div className="sidebar-content">
              {activeTab === 'files' && workDir && (
                <FileExplorer 
                  rootPath={workDir}
                  onFileSelect={handleFileSelect}
                  activeFile={activeFile}
                  onAskAI={handleAskAI}
                />
              )}
              {activeTab === 'git' && workDir && (
                <GitPanel repoPath={workDir} />
              )}
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="content-area">
          {/* 编辑器区域 */}
          {openFiles.length > 0 && (
            <CodeEditor 
              openFiles={openFiles}
              activeFile={activeFile}
              onFileSelect={setActiveFile}
              onFileClose={handleFileClose}
              onContentChange={handleFileContentChange}
            />
          )}
          
          {/* 聊天区域 */}
          <ChatPanel ref={chatPanelRef} workDir={workDir} selectedFile={selectedFile} onFileModified={handleFileModified} settings={settings} />
        </div>
      </div>
      
      {/* 设置面板 - 内联实现 */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#252526',
            borderRadius: '8px',
            width: '480px',
            maxWidth: '90%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            border: '1px solid #3e3e42',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #3e3e42',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#e0e0e0' }}>⚙️ 设置</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#ccc' }}>选择模型</label>
                <select
                  value={tempModel}
                  onChange={(e) => setTempModel(e.target.value)}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#3c3c3c', border: '1px solid #5a5a5a', borderRadius: '4px', color: '#e0e0e0' }}
                >
                  <option value="">使用服务器默认</option>
                  <option value="kimi-k2-thinking-turbo">kimi-k2-thinking-turbo</option>
                  <option value="kimi-k2.5">kimi-k2.5</option>
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#ccc' }}>API Key</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{ width: '100%', padding: '10px', backgroundColor: '#3c3c3c', border: '1px solid #5a5a5a', borderRadius: '4px', color: '#e0e0e0' }}
                />
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #3e3e42', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowSettings(false)} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #5a5a5a', borderRadius: '4px', color: '#ccc' }}>取消</button>
              <button onClick={() => { handleSaveSettings({ model: tempModel, apiKey: tempApiKey }); setShowSettings(false); }} style={{ padding: '8px 16px', backgroundColor: '#c96442', border: 'none', borderRadius: '4px', color: '#fff' }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
