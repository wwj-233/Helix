import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

console.log('index.js loaded');

// 错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#f44336' }}>
          <h2>应用渲染出错</h2>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('React root created');
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  console.log('React render called');
} catch (err) {
  console.error('Failed to render:', err);
  rootElement.innerHTML = `
    <div style="padding: 20px; color: #f44336;">
      <h2>启动失败</h2>
      <pre>${err.toString()}</pre>
    </div>
  `;
}
