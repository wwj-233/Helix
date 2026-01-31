import React, { useState, useEffect, useCallback } from 'react';

function GitPanel({ repoPath }) {
  const [branch, setBranch] = useState('');
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载 Git 状态
  const loadGitStatus = useCallback(async () => {
    if (!repoPath || !window.electronAPI) return;
    
    setIsLoading(true);
    
    try {
      // 获取分支
      const branchResult = await window.electronAPI.gitBranch(repoPath);
      if (branchResult.success) {
        setBranch(branchResult.branch);
      }
      
      // 获取状态
      const statusResult = await window.electronAPI.gitStatus(repoPath);
      if (statusResult.success) {
        setFiles(statusResult.files);
      }
    } catch (error) {
      console.error('加载 Git 状态失败:', error);
    }
    
    setIsLoading(false);
  }, [repoPath]);

  // 初始加载和定时刷新
  useEffect(() => {
    loadGitStatus();
    
    // 每 5 秒刷新一次
    const interval = setInterval(loadGitStatus, 5000);
    
    return () => clearInterval(interval);
  }, [loadGitStatus]);

  // 刷新按钮
  const handleRefresh = () => {
    loadGitStatus();
  };

  // 获取状态显示
  const getStatusDisplay = (status) => {
    const statusMap = {
      'M': { text: 'M', class: 'modified', label: '已修改' },
      'A': { text: 'A', class: 'added', label: '已添加' },
      'D': { text: 'D', class: 'deleted', label: '已删除' },
      '??': { text: '?', class: 'added', label: '未跟踪' },
      'R': { text: 'R', class: 'modified', label: '重命名' },
    };
    return statusMap[status.trim()] || { text: status, class: '', label: status };
  };

  // 获取状态统计
  const getStatusStats = () => {
    const stats = { modified: 0, added: 0, deleted: 0 };
    files.forEach(file => {
      const status = file.status.trim();
      if (status === 'M') stats.modified++;
      else if (status === 'A' || status === '??') stats.added++;
      else if (status === 'D') stats.deleted++;
    });
    return stats;
  };

  const stats = getStatusStats();

  return (
    <div className="git-panel">
      {/* 分支信息 */}
      <div className="git-branch">
        <span className="git-branch-icon">🔀</span>
        <span>{branch || '未在 Git 仓库中'}</span>
      </div>

      {/* 状态统计 */}
      {files.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '16px',
          fontSize: '12px'
        }}>
          {stats.modified > 0 && (
            <span style={{ color: '#ff9800' }}>
              {stats.modified} 修改
            </span>
          )}
          {stats.added > 0 && (
            <span style={{ color: '#4caf50' }}>
              {stats.added} 新增
            </span>
          )}
          {stats.deleted > 0 && (
            <span style={{ color: '#f44336' }}>
              {stats.deleted} 删除
            </span>
          )}
        </div>
      )}

      {/* 刷新按钮 */}
      <div style={{ marginBottom: '12px' }}>
        <button 
          className="btn btn-secondary" 
          onClick={handleRefresh}
          disabled={isLoading}
          style={{ fontSize: '12px' }}
        >
          {isLoading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {/* 文件列表 */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">
          变更文件 ({files.length})
        </div>
        
        {files.length === 0 ? (
          <div style={{ 
            padding: '16px', 
            textAlign: 'center', 
            color: '#888',
            fontSize: '12px'
          }}>
            工作区干净
          </div>
        ) : (
          <div className="git-file-list">
            {files.map((file, index) => {
              const status = getStatusDisplay(file.status);
              return (
                <div key={index} className="git-file-item">
                  <span 
                    className={`git-file-status ${status.class}`}
                    title={status.label}
                  >
                    {status.text}
                  </span>
                  <span className="git-file-name" title={file.file}>
                    {file.file}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 提示信息 */}
      <div style={{ 
        marginTop: '24px',
        padding: '12px',
        background: '#2d2d30',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#888'
      }}>
        <div style={{ marginBottom: '8px', fontWeight: 500 }}>
          💡 提示
        </div>
        <div>
          在聊天中可以使用自然语言让 Helix 帮你：
        </div>
        <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
          <li>提交代码更改</li>
          <li>查看文件差异</li>
          <li>创建分支</li>
          <li>解决合并冲突</li>
        </ul>
      </div>
    </div>
  );
}

export default GitPanel;
