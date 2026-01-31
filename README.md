# Helix

> **Demo Project** - An AI pair programming desktop application built with [kimi-agent-sdk](https://github.com/MoonshotAI/kimi-agent-sdk)

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="Helix Logo">
</p>

Helix is a demonstration project showcasing the capabilities of **kimi-agent-sdk**. It provides a desktop interface for AI-assisted coding, file management, and project collaboration using the **Kimi K2.5** model.

## 🎯 Purpose

This project is created to:
- **Demonstrate** the power and flexibility of kimi-agent-sdk
- **Showcase** how to build desktop applications with AI integration
- **Promote** the Kimi K2.5 model's capabilities in code assistance

## ✨ Features

- 💬 **AI Chat Interface** - Natural language interaction with Kimi K2.5
- 📁 **File Explorer** - Browse and manage your project files
- 🖼️ **Vision Support** - Upload and analyze images with the AI
- 📝 **Code Editor** - Built-in editor with syntax highlighting
- 🔧 **Git Integration** - Basic Git operations support
- 🎨 **Artifacts** - Generate and preview React, HTML, SVG content

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Kimi API Key** - Get yours at [platform.moonshot.ai](https://platform.moonshot.ai/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/helix.git
   cd helix
   ```

2. **Setup the Agent Server (Backend)**
   ```bash
   cd agent-server
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Create environment file
   cp .env.example .env
   # Edit .env and add your Kimi API Key
   ```

3. **Setup the Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Run in Development Mode**
   
   Terminal 1 - Start Agent Server:
   ```bash
   cd agent-server
   source venv/bin/activate
   python main.py
   ```
   
   Terminal 2 - Start Electron App:
   ```bash
   cd frontend
   npm run electron-dev
   ```

### Building for Production

```bash
cd frontend
npm run dist:mac    # For macOS
npm run dist:win    # For Windows
npm run dist:linux  # For Linux
```

## 🔧 Configuration

### API Key Setup

1. Visit [Kimi Platform](https://platform.moonshot.ai/) to get your API key
2. Open Helix Settings (⚙️ icon or Cmd+,)
3. Enter your API Key and select model (default: kimi-k2.5)

### Available Models

- `kimi-k2.5` - General purpose with vision support
- `kimi-k2-thinking-turbo` - Enhanced reasoning capabilities

## 🏗️ Architecture

```
Helix/
├── agent-server/          # Python backend (FastAPI + WebSocket)
│   ├── main.py           # Main server entry
│   ├── agents/           # Custom agent configurations
│   └── requirements.txt  # Python dependencies
│
├── frontend/             # Electron + React frontend
│   ├── public/           # Electron main process
│   ├── src/              # React components
│   └── package.json      # Node dependencies
│
└── resources/            # App icons and assets
```

## 🛠️ Tech Stack

- **Frontend**: Electron, React 18, Monaco Editor
- **Backend**: FastAPI, WebSocket, kimi-agent-sdk
- **AI Model**: Kimi K2.5 via Moonshot AI API

## 🤝 Contributing

This is a demo project for educational purposes. Feel free to:
- Fork and modify for your own use
- Submit issues for bugs or suggestions
- Create pull requests for improvements

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- Built with [kimi-agent-sdk](https://github.com/MoonshotAI/kimi-agent-sdk) by Moonshot AI
- Powered by [Kimi K2.5](https://platform.moonshot.cn/) model
- Inspired by the concept of AI pair programming

---

> **Note**: This is a demonstration project showcasing kimi-agent-sdk capabilities. For production use, please ensure proper security measures and API key management.
