import React from 'react';

function WelcomeScreen({ onSelectWorkDir, onClose }) {
  const examples = [
    {
      icon: '📁',
      title: '整理文件',
      desc: '整理下载文件夹，按类型分类文件'
    },
    {
      icon: '📝',
      title: '生成报告',
      desc: '从笔记和文档生成项目报告'
    },
    {
      icon: '💻',
      title: '代码审查',
      desc: '分析代码并提供改进建议'
    },
    {
      icon: '🔀',
      title: 'Git 助手',
      desc: '提交代码、创建分支、解决冲突'
    }
  ];

  return (
    <div className="app">
      {/* 顶部栏 */}
      <div className="topbar">
        <div className="logo">
          <span>🤖</span>
          <span>Helix</span>
        </div>
      </div>

      {/* 欢迎内容 */}
      <div className="welcome-container">
        <h1 className="welcome-title">欢迎来到 Helix</h1>
        <p className="welcome-subtitle">
          选择一个工作目录，让 Helix 帮你处理文件、编写代码、管理项目。
          就像有一个智能同事一样。
        </p>
        
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={onSelectWorkDir}>
            <span>📁</span>
            <span>选择工作目录</span>
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            以后再说
          </button>
        </div>

        <div className="welcome-examples">
          {examples.map((example, index) => (
            <div key={index} className="welcome-example">
              <div className="welcome-example-icon">{example.icon}</div>
              <div className="welcome-example-title">{example.title}</div>
              <div className="welcome-example-desc">{example.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ 
          marginTop: '48px',
          padding: '24px',
          background: '#2d2d30',
          borderRadius: '12px',
          maxWidth: '600px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            marginBottom: '12px' 
          }}>
            🤔 什么是 Helix？
          </div>
          <div style={{ 
            fontSize: '13px', 
            color: '#9e9e9e',
            lineHeight: '1.6'
          }}>
            Helix 是一个 AI 结对编程桌面应用，让你能够通过自然语言
            与 AI 协作处理电脑上的文件和任务。它可以帮你整理文件、编写代码、生成报告，
            就像有一个聪明的同事一样工作。
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
