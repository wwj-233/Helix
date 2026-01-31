import React, { useState, useEffect, useCallback } from 'react';

function FileExplorer({ rootPath, onFileSelect, activeFile, onAskAI }) {
  const [files, setFiles] = useState([]);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // 加载目录内容
  const loadDirectory = useCallback(async (dirPath) => {
    if (!window.electronAPI) return;
    
    try {
      const result = await window.electronAPI.listDirectory(dirPath);
      if (result.success) {
        // 排序：目录在前，文件在后
        const sorted = result.files.sort((a, b) => {
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });
        return sorted;
      }
    } catch (error) {
      console.error('加载目录失败:', error);
    }
    return [];
  }, []);

  // 初始加载
  useEffect(() => {
    if (rootPath) {
      setIsLoading(true);
      loadDirectory(rootPath).then(files => {
        setFiles(files);
        setIsLoading(false);
      });
    }
  }, [rootPath, loadDirectory]);

  // 切换目录展开/折叠
  const toggleDir = async (dirPath) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
    }
    setExpandedDirs(newExpanded);
  };

  // 获取文件图标
  const getFileIcon = (file) => {
    if (file.isDirectory) {
      return expandedDirs.has(file.path) ? '📂' : '📁';
    }
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const iconMap = {
      'js': '📜',
      'ts': '📘',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'py': '🐍',
      'html': '🌐',
      'css': '🎨',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
    };
    return iconMap[ext] || '📄';
  };

  // 处理 AI 分析文件
  const handleAskAI = (e, file) => {
    e.stopPropagation();
    if (onAskAI) {
      onAskAI(file);
    }
  };

  // 渲染文件项
  const renderFileItem = (file, depth = 0) => {
    const isExpanded = expandedDirs.has(file.path);
    const isSelected = activeFile && activeFile.path === file.path;
    const indentClass = `indent-${Math.min(depth, 3)}`;

    return (
      <div key={file.path}>
        <div 
          className={`file-item ${indentClass} ${isSelected ? 'selected' : ''}`}
          onClick={() => file.isDirectory ? toggleDir(file.path) : onFileSelect(file)}
        >
          <span className="file-item-icon">
            {getFileIcon(file)}
          </span>
          <span className="file-item-name" title={file.name}>
            {file.name}
          </span>
          {/* AI 分析按钮 - 只对文件显示 */}
          {!file.isDirectory && onAskAI && (
            <button 
              className="file-ai-btn"
              onClick={(e) => handleAskAI(e, file)}
              title="询问 AI"
            >
              🤖
            </button>
          )}
        </div>
        
        {/* 渲染子目录 */}
        {file.isDirectory && isExpanded && (
          <SubDirectory 
            path={file.path}
            depth={depth + 1}
            expandedDirs={expandedDirs}
            onToggleDir={toggleDir}
            onFileSelect={onFileSelect}
            activeFile={activeFile}
            onAskAI={onAskAI}
          />
        )}
      </div>
    );
  };

  return (
    <div className="file-tree">
      <div className="sidebar-section">
        <div className="sidebar-section-title">工作目录</div>
        {isLoading ? (
          <div style={{ padding: '8px', color: '#888', fontSize: '12px' }}>
            加载中...
          </div>
        ) : (
          files.map(file => renderFileItem(file, 0))
        )}
      </div>
    </div>
  );
}

// 子目录组件
function SubDirectory({ path, depth, expandedDirs, onToggleDir, onFileSelect, activeFile, onAskAI }) {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.listDirectory(path).then(result => {
        if (result.success) {
          const sorted = result.files.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
              return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
          });
          setFiles(sorted);
        }
      });
    }
  }, [path]);

  const getFileIcon = (file) => {
    if (file.isDirectory) {
      return expandedDirs.has(file.path) ? '📂' : '📁';
    }
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const iconMap = {
      'js': '📜',
      'ts': '📘',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'py': '🐍',
      'html': '🌐',
      'css': '🎨',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
    };
    return iconMap[ext] || '📄';
  };

  // 处理 AI 分析文件
  const handleAskAI = (e, file) => {
    e.stopPropagation();
    if (onAskAI) {
      onAskAI(file);
    }
  };

  return (
    <>
      {files.map(file => {
        const isExpanded = expandedDirs.has(file.path);
        const isSelected = activeFile && activeFile.path === file.path;
        const indentClass = `indent-${Math.min(depth, 3)}`;

        return (
          <div key={file.path}>
            <div 
              className={`file-item ${indentClass} ${isSelected ? 'selected' : ''}`}
              onClick={() => file.isDirectory ? onToggleDir(file.path) : onFileSelect(file)}
            >
              <span className="file-item-icon">
                {getFileIcon(file)}
              </span>
              <span className="file-item-name" title={file.name}>
                {file.name}
              </span>
              {/* AI 分析按钮 - 只对文件显示 */}
              {!file.isDirectory && onAskAI && (
                <button 
                  className="file-ai-btn"
                  onClick={(e) => handleAskAI(e, file)}
                  title="询问 AI"
                >
                  🤖
                </button>
              )}
            </div>
            
            {file.isDirectory && isExpanded && (
              <SubDirectory 
                path={file.path}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onFileSelect={onFileSelect}
                activeFile={activeFile}
                onAskAI={onAskAI}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default FileExplorer;
