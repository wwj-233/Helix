#!/bin/bash

# 🤖 Kimi Cowork 启动脚本

echo "🚀 启动 Kimi Cowork..."

# 检查 Python 虚拟环境
if [ ! -d "agent-server/venv" ]; then
    echo "📦 创建 Python 虚拟环境..."
    cd agent-server
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
else
    source agent-server/venv/bin/activate
fi

# 检查 .env 文件
if [ ! -f "agent-server/.env" ]; then
    echo "⚠️  请创建 agent-server/.env 文件并配置 KIMI_API_KEY"
    echo "示例："
    echo "KIMI_API_KEY=your-api-key-here"
    exit 1
fi

# 启动后端
echo "🔧 启动 Agent Server..."
cd agent-server
python main.py &
AGENT_PID=$!
cd ..

# 等待后端启动
echo "⏳ 等待后端启动..."
sleep 3

# 检查前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend
    npm install
    cd ..
fi

# 启动前端
echo "🖥️  启动 Electron 应用..."
cd frontend
npm run electron-dev

# 清理
echo "🧹 清理..."
kill $AGENT_PID 2>/dev/null
