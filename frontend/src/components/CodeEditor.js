import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';

// 定义二进制文件扩展名
const BINARY_EXTENSIONS = [
  // 文档
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  // 图片
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'bmp',
  // 音频视频
  'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac', 'aac', 'ogg', 'webm',
  // 压缩包
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  // 可执行文件
  'exe', 'dll', 'so', 'dylib', 'app',
  // 字体
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  // 其他
  'db', 'dat', 'bin', 'class', 'o', 'a'
];

// 获取文件扩展名
const getFileExtension = (filename) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : null;
};

// 检查是否是二进制文件
const isBinaryFile = (filename) => {
  const ext = getFileExtension(filename);
  return ext && BINARY_EXTENSIONS.includes(ext);
};

// 获取文件类型描述
const getFileTypeDescription = (filename) => {
  const ext = getFileExtension(filename);
  const descriptions = {
    'pdf': 'PDF 文档',
    'doc': 'Word 文档',
    'docx': 'Word 文档',
    'xls': 'Excel 表格',
    'xlsx': 'Excel 表格',
    'ppt': 'PPT 演示文稿',
    'pptx': 'PPT 演示文稿',
    'jpg': 'JPEG 图片',
    'jpeg': 'JPEG 图片',
    'png': 'PNG 图片',
    'gif': 'GIF 图片',
    'mp3': '音频文件',
    'mp4': '视频文件',
    'zip': '压缩包',
    'rar': '压缩包',
    '7z': '压缩包',
    'exe': '可执行文件',
  };
  return descriptions[ext] || `${ext?.toUpperCase() || '未知'} 文件`;
};

// 获取 Monaco 语言
const getMonacoLanguage = (filename) => {
  const ext = getFileExtension(filename);
  const langMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'md': 'markdown',
    'txt': 'plaintext',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'sql': 'sql',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
  };
  return langMap[ext] || 'plaintext';
};

function CodeEditor({ openFiles, activeFile, onFileSelect, onFileClose, onContentChange }) {
  const [fileContents, setFileContents] = useState({});
  const [editorMounted, setEditorMounted] = useState(false);

  // 加载文件内容
  useEffect(() => {
    openFiles.forEach(async (file) => {
      // 跳过二进制文件
      if (isBinaryFile(file.name)) {
        setFileContents(prev => ({
          ...prev,
          [file.path]: null // 标记为二进制文件
        }));
        return;
      }
      
      // 如果已经有内容，不重复加载
      if (fileContents[file.path] !== undefined) return;
      
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.readFile(file.path);
          if (result.success) {
            setFileContents(prev => ({
              ...prev,
              [file.path]: result.content
            }));
          } else {
            setFileContents(prev => ({
              ...prev,
              [file.path]: null // 读取失败
            }));
          }
        } catch (error) {
          console.error('加载文件失败:', error);
          setFileContents(prev => ({
            ...prev,
            [file.path]: null
          }));
        }
      }
    });
  }, [openFiles]);

  // 处理编辑器内容变化
  const handleEditorChange = useCallback((value) => {
    if (activeFile) {
      setFileContents(prev => ({
        ...prev,
        [file.path]: value
      }));
      onContentChange(activeFile, value);
    }
  }, [activeFile, onContentChange]);

  // 保存文件
  const handleSave = async () => {
    if (!activeFile || !window.electronAPI) return;
    
    const content = fileContents[activeFile.path] || '';
    try {
      const result = await window.electronAPI.writeFile(activeFile.path, content);
      // 清除修改标记
      if (result.success) {
        onContentChange(activeFile, content);
      }
    } catch (error) {
      console.error('保存文件失败:', error);
    }
  };

  // 在文件夹中显示
  const showInFolder = async () => {
    if (activeFile && window.electronAPI) {
      await window.electronAPI.showInFolder(activeFile.path);
    }
  };

  // 编辑器挂载
  const handleEditorDidMount = (editor, monaco) => {
    setEditorMounted(true);
    
    // 添加保存快捷键
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  if (!activeFile) {
    return (
      <div className="editor-container">
        <div className="editor-empty">
          <div className="editor-empty-icon">📄</div>
          <div>选择一个文件开始编辑</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
            支持语法高亮、自动补全、代码折叠
          </div>
        </div>
      </div>
    );
  }

  const currentContent = fileContents[activeFile.path];
  const isModified = activeFile.isModified;
  const isBinary = isBinaryFile(activeFile.name);
  const language = getMonacoLanguage(activeFile.name);

  return (
    <div className="editor-container" style={{ height: '50%' }}>
      {/* 标签栏 */}
      <div className="editor-tabs">
        {openFiles.map(file => (
          <div 
            key={file.path}
            className={`editor-tab ${activeFile.path === file.path ? 'active' : ''}`}
            onClick={() => onFileSelect(file)}
          >
            <span style={{ 
              color: file.isModified ? '#ff9800' : 'inherit',
              fontWeight: file.isModified ? 500 : 'normal'
            }}>
              {file.isModified && '● '}{file.name}
            </span>
            <span 
              className="editor-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(file);
              }}
            >
              ×
            </span>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '8px 16px',
        background: '#1e1e1e',
        borderBottom: '1px solid #3e3e42',
        fontSize: '12px',
        color: '#888'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{activeFile.path}</span>
          <span style={{ 
            padding: '2px 6px', 
            background: '#2d2d30', 
            borderRadius: '3px',
            fontSize: '11px',
            color: '#9e9e9e'
          }}>
            {language}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isModified && (
            <span style={{ color: '#ff9800', marginRight: '8px' }}>已修改</span>
          )}
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            style={{ padding: '4px 12px', fontSize: '12px' }}
            disabled={isBinary}
          >
            保存 (Ctrl+S)
          </button>
        </div>
      </div>

      {/* 编辑器内容 */}
      {isBinary || currentContent === null ? (
        // 二进制文件 - 显示提示
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          height: 'calc(100% - 80px)',
          background: '#1e1e1e'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {isBinary ? '📄' : '⚠️'}
          </div>
          <div style={{ 
            fontSize: '16px', 
            color: '#e0e0e0',
            marginBottom: '8px'
          }}>
            {isBinary ? `${getFileTypeDescription(activeFile.name)}` : '无法读取此文件'}
          </div>
          <div style={{ 
            fontSize: '13px', 
            color: '#888',
            marginBottom: '24px',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            {isBinary 
              ? '此文件类型不支持直接编辑，您可以在 Finder 中打开它'
              : '文件可能已损坏或格式不支持'
            }
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-primary"
              onClick={showInFolder}
            >
              在 Finder 中显示
            </button>
            {isBinary && (
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  if (activeFile && window.electronAPI) {
                    window.electronAPI.openExternal(`file://${activeFile.path}`);
                  }
                }}
              >
                用系统默认应用打开
              </button>
            )}
          </div>
        </div>
      ) : (
        // Monaco Editor
        <Editor
          key={activeFile.path} // 切换文件时重新挂载
          height="calc(100% - 80px)"
          defaultLanguage={language}
          value={currentContent || ''}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: true, scale: 1 },
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            folding: true,
            foldImport: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            snippetSuggestions: 'inline',
            wordBasedSuggestions: true,
            parameterHints: { enabled: true },
            hover: { enabled: true },
            bracketPairColorization: { enabled: true },
            matchBrackets: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
            smoothScrolling: true,
            cursorBlinking: 'blink',
            cursorSmoothCaretAnimation: true,
          }}
          loading={
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: '#888'
            }}>
              加载编辑器...
            </div>
          }
        />
      )}
    </div>
  );
}

export default CodeEditor;
