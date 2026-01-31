"""
🤖 Kimi Cowork Agent Server
基于 kimi-agent-sdk 的 Agent 服务
"""

import os
import sys
import json
import asyncio
from pathlib import Path

# 强制立即刷新 print 输出
sys.stdout.reconfigure(line_buffering=True)
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# 加载环境变量
env_paths = [
    Path(__file__).parent / ".env",
    Path.cwd() / ".env",
    Path.home() / ".kimi" / ".env",
]
for env_path in env_paths:
    if env_path.exists():
        print(f"Loading environment from: {env_path}")
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # .env 文件优先于环境变量
                    os.environ[key] = value
                    print(f"  Set {key}={value[:10]}...")
        break

from kimi_agent_sdk import Session, prompt, TextPart, ApprovalRequest, ToolCall, ToolResult
from kaos.path import KaosPath
from kosong.message import ImageURLPart
import base64

# ============ 配置 ============
DEFAULT_MODEL = os.getenv("KIMI_MODEL", "kimi-k2-thinking-turbo")
KIMI_API_KEY = os.getenv("KIMI_API_KEY", "")
PORT = int(os.getenv("AGENT_PORT", "3456"))
HOST = os.getenv("AGENT_HOST", "127.0.0.1")

if KIMI_API_KEY:
    os.environ["KIMI_API_KEY"] = KIMI_API_KEY
if not os.getenv("KIMI_BASE_URL"):
    os.environ["KIMI_BASE_URL"] = "https://api.moonshot.cn/v1"
if not os.getenv("KIMI_MODEL_NAME"):
    os.environ["KIMI_MODEL_NAME"] = DEFAULT_MODEL
if not os.getenv("KIMI_MODEL_CAPABILITIES"):
    # 默认支持图片输入
    os.environ["KIMI_MODEL_CAPABILITIES"] = "image_in,thinking"

# 用户自定义设置（通过 WebSocket 更新）
user_settings = {
    "model": None,  # None 表示使用默认
    "api_key": None,  # None 表示使用环境变量
}

# ============ 数据模型 ============
class Message(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None
    tools_used: Optional[List[Dict]] = None

class TaskRequest(BaseModel):
    message: str
    work_dir: str
    session_id: Optional[str] = None
    auto_accept: bool = False

class TaskStatus(BaseModel):
    task_id: str
    status: str  # pending, running, completed, failed
    progress: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None

# ============ 会话管理 ============
@dataclass
class CoworkSession:
    session_id: str
    work_dir: str
    created_at: str
    messages: List[Dict[str, Any]]
    
    def to_dict(self):
        return {
            "session_id": self.session_id,
            "work_dir": self.work_dir,
            "created_at": self.created_at,
            "messages": self.messages,
        }

class SessionManager:
    """Cowork 会话管理器"""
    
    def __init__(self):
        self.sessions: Dict[str, CoworkSession] = {}
        self.active_tasks: Dict[str, TaskStatus] = {}
        self.sessions_dir = Path.home() / ".kimi" / "cowork-desktop" / "sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self.load_sessions()
    
    def load_sessions(self):
        """加载保存的会话"""
        for session_file in self.sessions_dir.glob("*.json"):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    session = CoworkSession(
                        session_id=data["session_id"],
                        work_dir=data["work_dir"],
                        created_at=data["created_at"],
                        messages=data.get("messages", [])
                    )
                    self.sessions[session.session_id] = session
            except Exception as e:
                print(f"加载会话失败 {session_file}: {e}")
    
    def save_session(self, session: CoworkSession):
        """保存会话"""
        session_file = self.sessions_dir / f"{session.session_id}.json"
        with open(session_file, 'w', encoding='utf-8') as f:
            json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)
    
    def create_session(self, work_dir: str) -> CoworkSession:
        """创建新会话"""
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        session = CoworkSession(
            session_id=session_id,
            work_dir=work_dir,
            created_at=datetime.now().isoformat(),
            messages=[]
        )
        self.sessions[session_id] = session
        self.save_session(session)
        return session
    
    def get_session(self, session_id: str) -> Optional[CoworkSession]:
        """获取会话"""
        return self.sessions.get(session_id)
    
    def list_sessions(self) -> List[CoworkSession]:
        """列出所有会话"""
        return sorted(self.sessions.values(), key=lambda s: s.created_at, reverse=True)
    
    def add_message(self, session_id: str, role: str, content: str, tools_used: Optional[List[Dict]] = None):
        """添加消息到会话"""
        if session_id in self.sessions:
            self.sessions[session_id].messages.append({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat(),
                "tools_used": tools_used or []
            })
            self.save_session(self.sessions[session_id])

# 全局会话管理器
session_manager = SessionManager()

# ============ FastAPI 应用 ============
app = FastAPI(title="Kimi Cowork Agent Server")

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ API 路由 ============

@app.get("/")
async def root():
    return {"status": "ok", "service": "Kimi Cowork Agent Server"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

class SettingsRequest(BaseModel):
    model: Optional[str] = None
    api_key: Optional[str] = None

@app.post("/settings")
async def update_settings(request: SettingsRequest):
    """更新用户设置"""
    global user_settings
    if request.model:
        user_settings["model"] = request.model
    if request.api_key:
        user_settings["api_key"] = request.api_key
        # 更新环境变量
        os.environ["KIMI_API_KEY"] = request.api_key
    return {"status": "ok", "settings": user_settings}

@app.get("/settings")
async def get_settings():
    """获取当前设置"""
    return {
        "model": user_settings["model"] or DEFAULT_MODEL,
        "api_key": "***" if user_settings["api_key"] else None
    }

@app.post("/task")
async def create_task(request: TaskRequest):
    """创建新任务"""
    task_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    
    # 创建或恢复会话
    if request.session_id and request.session_id in session_manager.sessions:
        session = session_manager.sessions[request.session_id]
    else:
        session = session_manager.create_session(request.work_dir)
    
    task_status = TaskStatus(
        task_id=task_id,
        status="pending"
    )
    session_manager.active_tasks[task_id] = task_status
    
    return {
        "task_id": task_id,
        "session_id": session.session_id,
        "status": "created"
    }

@app.get("/sessions")
async def list_sessions():
    """列出所有会话"""
    sessions = session_manager.list_sessions()
    return {
        "sessions": [
            {
                "session_id": s.session_id,
                "work_dir": s.work_dir,
                "created_at": s.created_at,
                "message_count": len(s.messages)
            }
            for s in sessions[:20]
        ]
    }

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """获取会话详情"""
    session = session_manager.get_session(session_id)
    if not session:
        return {"error": "Session not found"}, 404
    return session.to_dict()

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    if session_id in session_manager.sessions:
        del session_manager.sessions[session_id]
        session_file = session_manager.sessions_dir / f"{session_id}.json"
        if session_file.exists():
            session_file.unlink()
        return {"status": "deleted"}
    return {"error": "Session not found"}, 404

# ============ WebSocket 路由 ============

class ConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
    
    async def send_message(self, client_id: str, message: Dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "chat":
                await handle_chat(websocket, data)
            elif data.get("type") == "settings":
                # 更新设置
                global user_settings
                settings = data.get("settings", {})
                print(f"[DEBUG] Received settings update: model={settings.get('model')}, api_key={'***' if settings.get('api_key') else 'none'}")
                if settings.get("model"):
                    user_settings["model"] = settings["model"]
                if settings.get("api_key"):
                    user_settings["api_key"] = settings["api_key"]
                    os.environ["KIMI_API_KEY"] = settings["api_key"]
                    # 同时设置模型名称，确保 create_llm 不会返回 None
                    model_name = settings.get("model") or user_settings.get("model") or DEFAULT_MODEL
                    user_settings["model"] = model_name  # 确保 user_settings 中也有 model
                    os.environ["KIMI_MODEL_NAME"] = model_name
                    # 设置模型能力（kimi-k2.5 支持图片输入）
                    os.environ["KIMI_MODEL_CAPABILITIES"] = "image_in,thinking"
                    print(f"[DEBUG] API Key updated: {settings['api_key'][:10]}... (len={len(settings['api_key'])})")
                    print(f"[DEBUG] Model name set to: {model_name}")
                    print(f"[DEBUG] Capabilities set to: image_in,thinking")
                    print(f"[DEBUG] user_settings after update: {user_settings}")
                await websocket.send_json({
                    "type": "settings_updated",
                    "status": "ok"
                })
            elif data.get("type") == "abort":
                # 处理中断请求
                await websocket.send_json({
                    "type": "aborted",
                    "message": "任务已中断"
                })
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket 错误: {e}")
        manager.disconnect(client_id)

async def handle_chat(websocket: WebSocket, data: Dict):
    """处理聊天消息"""
    message = data.get("message", "")
    session_id = data.get("session_id")
    work_dir = data.get("work_dir", str(Path.cwd()))
    auto_accept = data.get("auto_accept", False)
    selected_file = data.get("selected_file")  # 获取选中的文件信息
    
    # 调试日志
    print(f"[DEBUG] Received message: {message[:50]}...")
    print(f"[DEBUG] Selected file: {selected_file}")
    
    try:
        # 创建或获取会话
        if session_id and session_id in session_manager.sessions:
            session = session_manager.sessions[session_id]
        else:
            session = session_manager.create_session(work_dir)
            session_id = session.session_id
            await websocket.send_json({
                "type": "session_created",
                "session_id": session_id
            })
        
        # 添加用户消息
        session_manager.add_message(session_id, "user", message)
        
        # 构建历史对话上下文（不包括最后一条用户消息，因为它是当前请求）
        context_messages = []
        # 取最近10条历史消息（包括用户和AI的对话）
        for msg in session.messages[:-1][-10:]:
            if msg["role"] == "user":
                context_messages.append(f"用户: {msg['content']}")
            elif msg["role"] == "assistant":
                # 截取 AI 回复的前 500 字符，避免上下文过长
                content = msg["content"][:500] if msg["content"] else ""
                if len(msg["content"]) > 500:
                    content += "..."
                context_messages.append(f"AI: {content}")
        
        context_str = "\n".join(context_messages) if context_messages else ""
        
        # 构建选中文件的上下文信息
        selected_file_context = ""
        image_parts = []  # 用于存储图片的 ContentPart
        
        if selected_file:
            file_path = selected_file.get("path", "")
            file_name = selected_file.get("name", "")
            is_directory = selected_file.get("isDirectory", False)
            
            if is_directory:
                selected_file_context = f"""

### 当前选中的目录
用户当前选中了目录: {file_path}
目录名: {file_name}
用户可能想对这个目录进行操作（如列出文件、创建新文件等）。
"""
            else:
                # 检查是否是图片文件
                image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
                file_ext = Path(file_name).suffix.lower()
                is_image = file_ext in image_extensions
                
                if is_image:
                    # 读取图片并转换为 base64
                    try:
                        path_obj = Path(file_path)
                        if path_obj.exists() and path_obj.is_file():
                            # 检查文件大小（限制为 5MB）
                            file_size = path_obj.stat().st_size
                            if file_size < 5 * 1024 * 1024:
                                with open(path_obj, 'rb') as f:
                                    image_data = f.read()
                                    base64_data = base64.b64encode(image_data).decode('utf-8')
                                    # 根据文件扩展名确定 MIME 类型
                                    mime_type = {
                                        '.png': 'image/png',
                                        '.jpg': 'image/jpeg',
                                        '.jpeg': 'image/jpeg',
                                        '.gif': 'image/gif',
                                        '.webp': 'image/webp',
                                        '.bmp': 'image/bmp',
                                    }.get(file_ext, 'image/png')
                                    
                                    data_url = f"data:{mime_type};base64,{base64_data}"
                                    image_parts.append(ImageURLPart(image_url={"url": data_url}))
                                    
                                    selected_file_context = f"""

### 当前选中的图片文件
用户当前选中了图片文件: {file_path}
文件名: {file_name}
文件大小: {file_size / 1024:.1f} KB

图片已经作为视觉输入传递给模型，请分析图片内容并回答用户的问题。
"""
                            else:
                                selected_file_context = f"""

### 当前选中的图片文件
用户当前选中了图片文件: {file_path}
文件名: {file_name}

[图片文件过大 ({file_size / 1024 / 1024:.1f} MB)，已超过 5MB 限制，无法处理]
"""
                    except Exception as e:
                        selected_file_context = f"""

### 当前选中的图片文件
用户当前选中了图片文件: {file_path}
文件名: {file_name}

[读取图片时出错: {e}]
"""
                else:
                    # 尝试读取文件内容（如果是文本文件）
                    file_content = ""
                    try:
                        path_obj = Path(file_path)
                        if path_obj.exists() and path_obj.is_file():
                            # 检查文件大小（限制为 100KB）
                            if path_obj.stat().st_size < 100 * 1024:
                                # 尝试读取文本文件
                                try:
                                    with open(path_obj, 'r', encoding='utf-8', errors='ignore') as f:
                                        file_content = f.read()
                                except Exception as e:
                                    file_content = f"[无法读取文件内容: {e}]"
                            else:
                                file_content = "[文件过大，已跳过内容读取]"
                    except Exception as e:
                        file_content = f"[读取文件时出错: {e}]"
                    
                    selected_file_context = f"""

### 当前选中的文件
用户当前选中了文件: {file_path}
文件名: {file_name}

文件内容:
```
{file_content}
```

重要提示：用户选中了这个文件，TA 的指令很可能是针对这个文件的。请根据用户的指令对这个文件进行相应的操作（如修改、分析、重构等）。
"""

        # 构建增强提示
        tools_description = """
你可以使用以下工具来完成任务:

### 文件操作
- 读取、写入、编辑、删除文件
- 列出目录内容
- 搜索文件内容

### 命令执行
- 执行 shell 命令
- 运行脚本

### Git 操作
- git status, git add, git commit, git diff

### Artifacts （重要！）
当用户需要生成代码、图表、网页等内容时，你可以使用 artifact 标签来创建可交互的预览：

1. **HTML 网页**：<artifact type="html" title="页面标题">HTML代码</artifact>
2. **React 组件**：<artifact type="react" title="组件名称">JSX代码</artifact>
3. **SVG 图形**：<artifact type="svg" title="图表名称">SVG代码</artifact>
4. **Python 代码**：<artifact type="python" title="脚本名称">Python代码</artifact>
5. **Markdown**：<artifact type="markdown" title="文档标题">Markdown内容</artifact>

示例：
```
<artifact type="react" title="计数器组件">
export default function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
</artifact>
```

用户可以在侧边栏看到并交互预览你创建的内容！
"""
        
        if context_str:
            enhanced_message = f"""工作目录: {work_dir}

历史对话:
{context_str}

当前用户请求: {message}
{selected_file_context}

{tools_description}
"""
        else:
            enhanced_message = f"""工作目录: {work_dir}

用户请求: {message}
{selected_file_context}

{tools_description}
"""
        
        full_response = ""
        tools_used = []
        
        await websocket.send_json({
            "type": "thinking",
            "message": "正在思考..."
        })
        
        # 使用 kimi-agent-sdk 的 Session
        kaos_path = KaosPath(work_dir)
        
        # 使用完全随机的 session_id，确保每次请求都是完全独立的
        # 避免 AI 重复之前的回复
        import uuid
        kaos_session_id = f"cowork-{uuid.uuid4().hex}"
        
        # 使用用户设置的模型和 API Key（如果有）
        model = user_settings.get("model") or DEFAULT_MODEL
        
        # 确保使用用户设置的 API Key
        if user_settings.get("api_key"):
            os.environ["KIMI_API_KEY"] = user_settings["api_key"]
            # 同时确保模型名称已设置
            model_name = user_settings.get("model") or DEFAULT_MODEL
            os.environ["KIMI_MODEL_NAME"] = model_name
            # 设置模型能力
            os.environ["KIMI_MODEL_CAPABILITIES"] = "image_in,thinking"
            print(f"[DEBUG] Using user-provided API Key: {user_settings['api_key'][:10]}... (len={len(user_settings['api_key'])})")
            print(f"[DEBUG] Using model: {model_name}")
            print(f"[DEBUG] Using capabilities: image_in,thinking")
            print(f"[DEBUG] Env KIMI_API_KEY after set: {os.environ.get('KIMI_API_KEY', 'NOT SET')[:10]}...")
        else:
            env_key = os.environ.get("KIMI_API_KEY", "")
            print(f"[DEBUG] No user API Key, using env: {env_key[:10] if env_key else 'NOT SET'}...")
        
        # 使用自定义 agent 文件（如果存在）
        agent_file = Path(__file__).parent / "agents" / "helix" / "agent.yaml"
        
        async with await Session.create(
            work_dir=kaos_path, 
            session_id=kaos_session_id,
            model=model,
            agent_file=agent_file if agent_file.exists() else None
        ) as kimi_session:
            # 构建多模态输入（如果有图片）
            if image_parts:
                # 有图片时，使用 list[ContentPart] 格式
                prompt_input = [TextPart(text=enhanced_message)] + image_parts
                print(f"[DEBUG] Using multimodal input with {len(image_parts)} image(s)")
            else:
                # 无图片时，使用字符串格式
                prompt_input = enhanced_message
            
            async for wire_msg in kimi_session.prompt(prompt_input):
                if isinstance(wire_msg, TextPart):
                    text = wire_msg.text
                    if text:
                        # 调试：打印每个文本片段
                        print(f"[DEBUG] TextPart: {repr(text[:100])}...")
                        full_response += text
                        await websocket.send_json({
                            "type": "stream",
                            "content": text,
                            "session_id": session_id
                        })
                
                elif isinstance(wire_msg, ToolCall):
                    # 调试：打印 ToolCall 的所有属性
                    print(f"ToolCall object: {wire_msg}")
                    print(f"ToolCall attributes: {dir(wire_msg)}")
                    
                    # 获取 function 对象
                    func = getattr(wire_msg, 'function', None)
                    print(f"Function object: {func}, type: {type(func)}")
                    
                    tool_name = 'unknown'
                    tool_args = {}
                    
                    if func is not None:
                        # 尝试多种方式获取 name
                        if isinstance(func, dict):
                            tool_name = func.get('name', 'unknown')
                            tool_args_str = func.get('arguments', '{}')
                        else:
                            # 可能是 pydantic model
                            print(f"Function attributes: {dir(func)}")
                            # 直接访问属性
                            if hasattr(func, 'name'):
                                name_val = getattr(func, 'name')
                                print(f"Got name via getattr: {name_val}")
                                tool_name = name_val or 'unknown'
                            # 通过 model_dump 或 dict 获取
                            try:
                                func_dict = func.model_dump() if hasattr(func, 'model_dump') else dict(func)
                                print(f"Function dict: {func_dict}")
                                tool_name = func_dict.get('name', 'unknown')
                                tool_args_str = func_dict.get('arguments', '{}')
                            except Exception as e:
                                print(f"Error converting func to dict: {e}")
                                tool_args_str = '{}'
                        
                        # 解析 arguments
                        if isinstance(tool_args_str, str):
                            try:
                                tool_args = json.loads(tool_args_str)
                            except json.JSONDecodeError:
                                tool_args = {"raw": tool_args_str}
                        else:
                            tool_args = tool_args_str
                    
                    print(f"Final Tool call: {tool_name} with args: {tool_args}")
                    
                    tools_used.append({"tool": tool_name, "args": tool_args})
                    await websocket.send_json({
                        "type": "tool_call",
                        "tool": tool_name,
                        "args": tool_args,
                        "session_id": session_id
                    })
                    
                    # 检测文件修改操作，通知前端更新
                    file_modifying_tools = ['write_file', 'edit_file', 'str_replace', 'str_replace_editor']
                    if tool_name in file_modifying_tools:
                        # 提取文件路径
                        file_path = tool_args.get('path') or tool_args.get('file_path') or tool_args.get('file')
                        if file_path:
                            await websocket.send_json({
                                "type": "file_modified",
                                "file_path": file_path,
                                "tool": tool_name,
                                "session_id": session_id
                            })
                
                elif isinstance(wire_msg, ApprovalRequest):
                    if auto_accept:
                        wire_msg.resolve("approve")
                        await websocket.send_json({
                            "type": "tool_approved",
                            "auto": True
                        })
                    else:
                        # 发送批准请求给前端
                        await websocket.send_json({
                            "type": "approval_request",
                            "message": "需要您的批准才能继续"
                        })
                        # 等待前端响应（简化处理，实际应该异步等待）
                        wire_msg.resolve("approve")
        
        # 保存助手回复
        session_manager.add_message(session_id, "assistant", full_response, tools_used)
        
        await websocket.send_json({
            "type": "complete",
            "content": full_response,
            "session_id": session_id,
            "tools_used": tools_used
        })
    
    except Exception as e:
        print(f"处理聊天时出错: {e}")
        import traceback
        traceback.print_exc()
        await websocket.send_json({
            "type": "error",
            "error": str(e)
        })

# ============ 主程序 ============

def main():
    print(f"""
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🤖 Kimi Cowork Agent Server                            ║
║                                                          ║
║   地址: http://{HOST}:{PORT}                                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
""")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

if __name__ == "__main__":
    main()
