import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import { ArtifactsContainer } from './Artifacts';

// 全局标志，防止多个 ChatPanel 实例创建多个 WebSocket 连接
let globalWsConnection = null;
let isWsConnecting = false;

const ChatPanel = forwardRef(({ workDir, selectedFile, onFileModified, settings }, ref) => {
  // ============ 状态 ============
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [autoAccept, setAutoAccept] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [artifacts, setArtifacts] = useState([]); // Artifacts 列表
  
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const processedMessages = useRef(new Set()); // 用于去重消息
  const isConnectingRef = useRef(false); // 防止重复连接

  // ============ WebSocket 连接 ============
  useEffect(() => {
    // 防止重复连接 - 使用 ref 进行更可靠的检查
    if (isConnectingRef.current) return;
    
    const connectWebSocket = async () => {
      if (!window.electronAPI) return;
      
      // 如果全局已经有连接，复用它
      if (globalWsConnection && globalWsConnection.readyState === WebSocket.OPEN) {
        console.log('Reusing global WebSocket connection');
        wsRef.current = globalWsConnection;
        setIsConnected(true);
        return;
      }
      
      // 如果正在连接中，跳过
      if (isConnectingRef.current || isWsConnecting) return;
      isConnectingRef.current = true;
      isWsConnecting = true;
      
      try {
        const agentUrl = await window.electronAPI.getAgentUrl();
        // 使用固定的客户端 ID，避免重复连接创建多个会话
        const clientId = 'kimi-cowork-desktop';
        const wsUrl = agentUrl.replace('http://', 'ws://') + '/ws/' + clientId;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket 已连接');
          globalWsConnection = ws;
          wsRef.current = ws;
          setIsConnected(true);
          isConnectingRef.current = false;
          isWsConnecting = false;
          
          // 发送用户设置（仅当用户明确设置了才发送，否则使用服务器默认）
          if (settings && (settings.model?.trim() || settings.apiKey?.trim())) {
            const settingsPayload = {};
            if (settings.model?.trim()) {
              settingsPayload.model = settings.model.trim();
            }
            if (settings.apiKey?.trim()) {
              settingsPayload.api_key = settings.apiKey.trim();
            }
            if (Object.keys(settingsPayload).length > 0) {
              ws.send(JSON.stringify({
                type: 'settings',
                settings: settingsPayload
              }));
            }
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket received:', data.type, data.content ? data.content.slice(0, 20) : '');
            handleWebSocketMessage(data);
          } catch (e) {
            console.error('WebSocket message parse error:', e);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          setIsConnected(false);
          isConnectingRef.current = false;
          isWsConnecting = false;
        };
        
        ws.onclose = () => {
          console.log('WebSocket 已关闭');
          if (globalWsConnection === ws) {
            globalWsConnection = null;
          }
          wsRef.current = null;
          setIsConnected(false);
          isConnectingRef.current = false;
          isWsConnecting = false;
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
        setIsConnected(false);
        isConnectingRef.current = false;
        isWsConnecting = false;
      }
    };

    connectWebSocket();
    
    // 组件卸载时不断开连接，让其他实例复用
  }, []); // 空依赖数组，只执行一次

  // ============ 自动滚动 ============
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============ Artifacts 提取 ============
  // 从 AI 消息中提取 Artifacts
  const extractArtifacts = (content) => {
    const artifactPattern = /<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?>([\s\S]*?)<\/artifact>/g;
    const extracted = [];
    let match;
    
    while ((match = artifactPattern.exec(content)) !== null) {
      extracted.push({
        id: uuidv4(),
        type: match[1],
        title: match[2] || null,
        content: match[3].trim()
      });
    }
    
    // 清理消息内容中的 artifact 标签
    const cleanedContent = content.replace(artifactPattern, '');
    
    return { cleanedContent, extracted };
  };

  // ============ 处理 WebSocket 消息 ============
  const handleWebSocketMessage = (data) => {
    console.log('Processing message:', data.type, 'content:', data.content ? data.content.slice(0, 30) : 'none');
    
    switch (data.type) {
      case 'session_created':
        setSessionId(data.session_id);
        break;
        
      case 'thinking':
        setIsThinking(true);
        break;
        
      case 'stream':
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isComplete) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + data.content
            };
            return updated;
          }
          return [...prev, {
            role: 'assistant',
            content: data.content,
            isComplete: false,
            timestamp: new Date().toISOString()
          }];
        });
        break;
        
      case 'tool_call':
        setMessages(prev => [...prev, {
          role: 'tool',
          tool: data.tool,
          args: data.args,
          timestamp: new Date().toISOString()
        }]);
        break;
        
      case 'file_modified':
        // AI 修改了文件，通知父组件刷新
        console.log('File modified by AI:', data.file_path);
        if (onFileModified) {
          onFileModified(data.file_path);
        }
        break;
        
      case 'tool_approved':
        // 工具已自动批准
        break;
        
      case 'approval_request':
        // 显示批准请求（简化处理）
        break;
        
      case 'complete':
        setIsThinking(false);
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0) {
            const lastMsg = updated[updated.length - 1];
            
            // 提取 Artifacts - 注意：data.content 可能已经包含在 stream 消息中了，不要重复添加
            if (lastMsg.role === 'assistant') {
              const { cleanedContent, extracted } = extractArtifacts(lastMsg.content);
              
              // 如果有 artifacts，添加到列表
              if (extracted.length > 0) {
                setArtifacts(prevArtifacts => [...prevArtifacts, ...extracted]);
              }
              
              updated[updated.length - 1] = {
                ...lastMsg,
                content: cleanedContent,
                isComplete: true,
                tools_used: data.tools_used,
                hasArtifacts: extracted.length > 0
              };
            }
          }
          return updated;
        });
        break;
        
      case 'error':
        setIsThinking(false);
        setMessages(prev => [...prev, {
          role: 'error',
          content: data.error,
          timestamp: new Date().toISOString()
        }]);
        break;
        
      default:
        break;
    }
  };

  // ============ 发送消息 ============
  const sendMessage = useCallback((customMessage = null) => {
    if (!wsRef.current || !isConnected) return;
    
    const message = customMessage || inputValue.trim();
    if (!message) return;
    
    if (!customMessage) {
      setInputValue('');
    }
    
    // 添加用户消息
    setMessages(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }]);
    
    // 发送给服务器
    try {
      const payload = {
        type: 'chat',
        message: String(message),
        work_dir: String(workDir || '/Users/moonshot/Desktop'),
        session_id: sessionId ? String(sessionId) : null,
        auto_accept: Boolean(autoAccept),
        selected_file: selectedFile ? {
          path: selectedFile.path,
          name: selectedFile.name,
          isDirectory: selectedFile.isDirectory
        } : null
      };
      console.log('Sending message with selected_file:', payload.selected_file);
      wsRef.current.send(JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to send message:', e);
    }
    
    setIsThinking(true);
  }, [inputValue, workDir, sessionId, autoAccept, isConnected, selectedFile]);

  // ============ 让 AI 分析文件 ============
  const askAIAboutFile = useCallback((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
    const isCode = ['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json', 'md', 'txt', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext);
    const isDoc = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
    
    let prompt = '';
    if (isImage) {
      prompt = `请分析这张图片：${file.path}\n\n请描述图片的内容、风格和任何值得注意的细节。`;
    } else if (isCode) {
      prompt = `请分析这个代码文件：${file.path}\n\n请解释代码的功能、结构和关键逻辑。如果有改进建议，也请一并提出。`;
    } else if (isDoc) {
      prompt = `请分析这个文档：${file.path}\n\n请总结文档的主要内容、关键信息和结论。`;
    } else {
      prompt = `请分析这个文件：${file.path}\n\n请描述文件的内容和用途。`;
    }
    
    sendMessage(prompt);
  }, [sendMessage]);

  // 监听 settings 变化，当 settings 更新时发送给服务器
  useEffect(() => {
    if (wsRef.current && isConnected && settings) {
      const settingsPayload = {};
      if (settings.model?.trim()) {
        settingsPayload.model = settings.model.trim();
      }
      if (settings.apiKey?.trim()) {
        settingsPayload.api_key = settings.apiKey.trim();
      }
      if (Object.keys(settingsPayload).length > 0) {
        console.log('Sending updated settings to server:', Object.keys(settingsPayload));
        wsRef.current.send(JSON.stringify({
          type: 'settings',
          settings: settingsPayload
        }));
      }
    }
  }, [settings, isConnected]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    askAIAboutFile
  }));

  // ============ 快捷键处理 ============
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ============ 清空对话 ============
  const clearChat = () => {
    setMessages([]);
    setArtifacts([]);
    setSessionId(null);
  };

  // ============ 渲染消息 ============
  const renderMessage = (msg, index) => {
    if (msg.role === 'tool') {
      return (
        <div key={index} className="tool-call">
          <div className="tool-call-header">
            <span>🔧</span>
            <span>使用工具:</span>
            <span className="tool-call-name">{msg.tool || 'unknown'}</span>
          </div>
          <div className="tool-call-args">
            {JSON.stringify(msg.args, null, 2)}
          </div>
        </div>
      );
    }

    if (msg.role === 'error') {
      return (
        <div key={index} className="chat-message" style={{ color: '#f44336' }}>
          <div className="message-header">
            <div className="message-avatar">❌</div>
            <span className="message-author">错误</span>
          </div>
          <div className="message-content">{msg.content}</div>
        </div>
      );
    }

    return (
      <div key={index} className="chat-message">
        <div className="message-header">
          <div className={`message-avatar ${msg.role}`}>
            {msg.role === 'user' ? '👤' : '🤖'}
          </div>
          <span className="message-author">
            {msg.role === 'user' ? '你' : 'Helix'}
          </span>
          {msg.hasArtifacts && (
            <span style={{
              marginLeft: '8px',
              padding: '2px 8px',
              background: '#c96442',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'white'
            }}>
              ✨ 有预览
            </span>
          )}
        </div>
        <div className="message-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.content}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  // ============ 渲染 ============
  return (
    <>
      <ArtifactsContainer 
        artifacts={artifacts}
        onRemove={(id) => setArtifacts(prev => prev.filter(a => a.id !== id))}
      />
      
      <div className="chat-container">
        {/* 消息列表 */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: '#888', 
              padding: '40px',
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
              <div>开始与 Helix 对话</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                {selectedFile ? (
                  <span>💡 已选中: <strong>{selectedFile.name}</strong>，可以直接输入命令操作此文件</span>
                ) : (
                  <span>选中左侧文件后，可以直接输入命令操作该文件</span>
                )}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
                AI 可以生成 React、HTML、SVG 等预览内容
              </div>
            </div>
          )}
          
          {messages.map((msg, index) => renderMessage(msg, index))}
          
          {isThinking && (
            <div className="thinking-indicator">
              <div className="thinking-dots">
                <div className="thinking-dot"></div>
                <div className="thinking-dot"></div>
                <div className="thinking-dot"></div>
              </div>
              <span>思考中...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? "输入消息... (Enter 发送, Shift+Enter 换行)" : "正在连接服务器..."}
              disabled={!isConnected || isThinking}
              rows={1}
            />
            <button 
              className="send-button"
              onClick={sendMessage}
              disabled={!isConnected || isThinking || !inputValue.trim()}
            >
              发送
            </button>
          </div>
          
          <div className="input-actions">
            <button 
              className="input-action-btn"
              onClick={() => setAutoAccept(!autoAccept)}
              style={{ color: autoAccept ? '#4caf50' : '#888' }}
            >
              {autoAccept ? '✓ 自动执行' : '○ 自动执行'}
            </button>
            <button className="input-action-btn" onClick={clearChat}>
              清空对话
            </button>
            {artifacts.length > 0 && (
              <span style={{ 
                marginLeft: 'auto',
                padding: '2px 8px',
                background: '#c96442',
                borderRadius: '4px',
                fontSize: '11px',
                color: 'white'
              }}>
                ✨ {artifacts.length} 个预览
              </span>
            )}
            <span style={{ 
              marginLeft: artifacts.length === 0 ? 'auto' : '8px', 
              fontSize: '11px', 
              color: isConnected ? '#4caf50' : '#f44336' 
            }}>
              {isConnected ? '● 已连接' : '● 未连接'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
});

export default ChatPanel;
