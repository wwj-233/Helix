import React, { useState, useEffect } from 'react';

function SettingsPanel({ isOpen, onClose, settings, onSave }) {
  const [localSettings, setLocalSettings] = useState({
    model: '',
    apiKey: '',
    ...settings
  });
  const [showApiKey, setShowApiKey] = useState(false);

  // 当外部设置变化时更新本地状态
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        model: settings.model || 'kimi-k2-thinking-turbo',
        apiKey: settings.apiKey || '',
        ...settings
      });
    }
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleCancel = () => {
    // 恢复原始设置
    setLocalSettings({
      model: settings?.model || 'kimi-k2-thinking-turbo',
      apiKey: settings?.apiKey || '',
      ...settings
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
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
        {/* 标题栏 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #3e3e42',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 500,
            color: '#e0e0e0',
          }}>
            ⚙️ 设置
          </h2>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => e.target.style.color = '#fff'}
            onMouseLeave={(e) => e.target.style.color = '#888'}
          >
            ×
          </button>
        </div>

        {/* 设置内容 */}
        <div style={{ padding: '20px' }}>
          {/* 模型选择 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#ccc',
              fontWeight: 500,
            }}>
              选择模型
            </label>
            <select
              value={localSettings.model}
              onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#3c3c3c',
                border: '1px solid #5a5a5a',
                borderRadius: '4px',
                color: '#e0e0e0',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">使用服务器默认（推荐）</option>
              <option value="kimi-k2-thinking-turbo">kimi-k2-thinking-turbo（推理增强版）</option>
              <option value="kimi-k2.5">kimi-k2.5（标准版）</option>
            </select>
            <div style={{
              marginTop: '6px',
              fontSize: '12px',
              color: '#888',
            }}>
              {!localSettings.model 
                ? '💡 使用服务器默认配置（从环境变量读取）' 
                : localSettings.model === 'kimi-k2-thinking-turbo' 
                  ? '💡 推理增强版：适合复杂任务、代码分析、逻辑推理' 
                  : '💡 标准版：适合一般对话、快速响应'}
            </div>
          </div>

          {/* API Key 输入 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#ccc',
              fontWeight: 500,
            }}>
              Moonshot API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                placeholder="sk-..."
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  backgroundColor: '#3c3c3c',
                  border: '1px solid #5a5a5a',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '4px 8px',
                }}
                title={showApiKey ? '隐藏' : '显示'}
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{
              marginTop: '6px',
              fontSize: '12px',
              color: '#888',
            }}>
              🔑 在 <a 
                href="https://platform.moonshot.cn/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#c96442', textDecoration: 'none' }}
              >
                Moonshot 开放平台
              </a> 获取 API Key
            </div>
          </div>

          {/* 说明 */}
          <div style={{
            padding: '12px',
            backgroundColor: '#2d2d30',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#888',
            lineHeight: '1.5',
          }}>
            <strong style={{ color: '#ccc' }}>说明：</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
              <li>留空表示使用服务器默认配置（从环境变量读取）</li>
              <li>设置会自动保存到本地</li>
              <li>API Key 仅存储在本地，不会上传到任何服务器</li>
            </ul>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #3e3e42',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: '1px solid #5a5a5a',
              borderRadius: '4px',
              color: '#ccc',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#c96442',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
