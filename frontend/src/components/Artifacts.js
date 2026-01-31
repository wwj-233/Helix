import React, { useState, useEffect, useRef } from 'react';
import { Sandpack, SandpackProvider, SandpackLayout, SandpackCodeEditor, SandpackPreview } from '@codesandbox/sandpack-react';

/**
 * Artifacts 组件 - 显示 AI 生成的可交互内容
 * 
 * 支持类型：
 * - html: 纯 HTML/CSS/JS
 * - react: React 组件
 * - vue: Vue 组件
 * - angular: Angular 组件
 * - svelte: Svelte 组件
 * - svg: SVG 图形
 * - markdown: Markdown 文档
 * - mermaid: 流程图/图表
 * - python: Python 代码（不可预览）
 * - json: JSON 数据
 * - sql: SQL 代码
 */

const ARTIFACT_TYPES = {
  html: { label: 'HTML', icon: '🌐', framework: 'vanilla' },
  react: { label: 'React', icon: '⚛️', framework: 'react' },
  vue: { label: 'Vue', icon: '💚', framework: 'vue' },
  angular: { label: 'Angular', icon: '🅰️', framework: 'angular' },
  svelte: { label: 'Svelte', icon: '🔥', framework: 'svelte' },
  svg: { label: 'SVG', icon: '🎨', framework: null },
  markdown: { label: 'Markdown', icon: '📝', framework: null },
  mermaid: { label: 'Mermaid', icon: '📊', framework: null },
  python: { label: 'Python', icon: '🐍', framework: null },
  json: { label: 'JSON', icon: '📋', framework: null },
  sql: { label: 'SQL', icon: '🗄️', framework: null },
};

// 生成用于 Sandpack 的完整 HTML 模板
const generateHTMLTemplate = (code, type) => {
  const baseHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: #f5f5f5;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    /* Custom styles from generated code */
    ${type === 'css' ? code : ''}
  </style>
  ${type === 'html' ? '<script src="https://cdn.jsdelivr.net/npm/clipboard@2.0.11/dist/clipboard.min.js"></script>' : ''}
</head>
<body>
  <div class="container">
    ${type === 'html' ? code : '<div id="root"></div>'}
  </div>
  ${type === 'html' 
    ? `<script>
        ${code.includes('<script>') ? code.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '' : ''}
      </script>`
    : ''}
</body>
</html>`;

  return baseHTML;
};

// 生成 React 模板
const generateReactTemplate = (code) => {
  return {
    '/App.js': code,
    '/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    '/package.json': JSON.stringify({
      name: 'preview',
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      }
    }, null, 2)
  };
};

// 渲染 Markdown（简化版）
const MarkdownPreview = ({ content }) => {
  const html = content
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n/gim, '<br>');
  
  return (
    <div 
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: `<div style="padding: 20px; line-height: 1.6;">${html}</div>` }}
    />
  );
};

// 渲染 SVG
const SVGPreview = ({ svgCode }) => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      padding: '20px'
    }}>
      <div 
        style={{ 
          background: '#ffffff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'auto'
        }}
        dangerouslySetInnerHTML={{ 
          __html: svgCode 
        }}
      />
    </div>
  );
};

function ArtifactPreview({ type, title, content, onClose, onDownload }) {
  const [activeTab, setActiveTab] = useState('preview'); // preview | code
  const artifactType = ARTIFACT_TYPES[type] || { label: 'Code', icon: '📄', framework: null };
  const canPreview = ['html', 'react', 'vue', 'angular', 'svelte', 'svg', 'markdown'].includes(type);

  // 导出代码
  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'artifact'}.${type === 'react' ? 'jsx' : type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      alert('已复制到剪贴板！');
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 准备 Sandpack 文件
  const getSandpackFiles = () => {
    switch (type) {
      case 'react':
        return generateReactTemplate(content);
      case 'html':
        return {
          '/index.html': generateHTMLTemplate(content, 'html'),
        };
      default:
        return { '/index.js': content };
    }
  };

  return (
    <div className="artifact-panel" style={{ 
      background: '#1e1e1e',
      border: '1px solid #3e3e42',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* 顶部工具栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: '#252526',
        borderBottom: '1px solid #3e3e42'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{artifactType.icon}</span>
          <span style={{ fontWeight: 500 }}>{title || `AI 生成的 ${artifactType.label}`}</span>
          <span style={{ 
            padding: '2px 8px',
            background: '#2d2d30',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#9e9e9e',
            marginLeft: '8px'
          }}>
            {artifactType.label}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 标签切换 */}
          {canPreview && (
            <div style={{
              display: 'flex',
              background: '#1e1e1e',
              borderRadius: '4px',
              padding: '2px'
            }}>
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  borderRadius: '3px',
                  background: activeTab === 'preview' ? '#3e3e42' : 'transparent',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                预览
              </button>
              <button
                onClick={() => setActiveTab('code')}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  borderRadius: '3px',
                  background: activeTab === 'code' ? '#3e3e42' : 'transparent',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                代码
              </button>
            </div>
          )}
          
          {/* 操作按钮 */}
          <button
            onClick={handleCopy}
            style={{
              padding: '4px 12px',
              background: '#2d2d30',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              color: '#e0e0e0',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            复制
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '4px 12px',
              background: '#2d2d30',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              color: '#e0e0e0',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            下载
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: '#9e9e9e',
                fontSize: '18px',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'preview' && canPreview ? (
          type === 'markdown' ? (
            <MarkdownPreview content={content} />
          ) : type === 'svg' ? (
            <SVGPreview svgCode={content} />
          ) : (
            <SandpackProvider
              template={artifactType.framework || 'vanilla'}
              files={getSandpackFiles()}
              options={{
                showLineNumbers: true,
                showInlineErrors: true,
                editorHeight: '100%',
              }}
              customSetup={{
                dependencies: type === 'react' ? {
                  react: '^18.2.0',
                  'react-dom': '^18.2.0',
                  'lucide-react': 'latest',
                } : {}
              }}
            >
              <SandpackLayout style={{ height: '100%' }}>
                <SandpackPreview 
                  style={{ height: '100%', width: '100%' }}
                  showRefreshButton={true}
                />
              </SandpackLayout>
            </SandpackProvider>
          )
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <pre style={{
              flex: 1,
              margin: 0,
              padding: '16px',
              background: '#1e1e1e',
              color: '#e0e0e0',
              fontSize: '13px',
              lineHeight: '1.5',
              overflow: 'auto',
              fontFamily: 'Menlo, Monaco, "Courier New", monospace'
            }}>
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Artifacts 列表（显示多个 artifacts）
function ArtifactsContainer({ artifacts, onClose, onRemove }) {
  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      right: '20px',
      top: '70px',
      width: '600px',
      maxHeight: 'calc(100vh - 90px)',
      overflow: 'auto',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {artifacts.map((artifact) => (
        <ArtifactPreview
          key={artifact.id}
          type={artifact.type}
          title={artifact.title}
          content={artifact.content}
          onClose={() => onRemove(artifact.id)}
        />
      ))}
    </div>
  );
}

export { ArtifactPreview, ArtifactsContainer };
export default ArtifactPreview;
