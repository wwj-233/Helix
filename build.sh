#!/bin/bash

# 🤖 Kimi Cowork 构建脚本

set -e

echo "📦 开始构建 Kimi Cowork..."

# 1. 后端准备
echo "🔧 准备 Python 后端..."
cd agent-server
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt

# 打包后端
pip install pyinstaller
pyinstaller --onefile --name agent-server main.py

cd ..

# 2. 前端构建
echo "🖥️  构建前端..."
cd frontend
npm install
npm run build

# 3. 复制后端到资源目录
mkdir -p resources
cp ../agent-server/dist/agent-server resources/

# 4. 打包 Electron 应用
echo "📱 打包 Electron 应用..."
npm run dist:mac

echo "✅ 构建完成！"
echo "输出目录: frontend/dist/"
