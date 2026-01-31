"""
应用配置管理
"""
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Settings:
    """应用配置"""
    # API 配置
    kimi_api_key: str
    kimi_base_url: str
    default_model: str
    
    # 服务器配置
    host: str
    port: int
    
    # 会话配置
    sessions_dir: Path
    
    # 文件读取限制
    max_file_size: int = 100 * 1024  # 100KB
    
    @property
    def is_configured(self) -> bool:
        """检查是否已配置 API Key"""
        return bool(self.kimi_api_key)


def _load_env_file() -> None:
    """从环境文件加载环境变量"""
    env_paths = [
        Path(__file__).parent.parent / ".env",
        Path.cwd() / ".env",
        Path.home() / ".kimi" / ".env",
    ]
    
    for env_path in env_paths:
        if env_path.exists():
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        if key not in os.environ:
                            os.environ[key] = value
            break


def _ensure_kimi_base_url() -> str:
    """确保 KIMI_BASE_URL 已设置"""
    base_url = os.getenv("KIMI_BASE_URL")
    if not base_url:
        base_url = "https://api.moonshot.cn/v1"
        os.environ["KIMI_BASE_URL"] = base_url
    return base_url


def get_settings() -> Settings:
    """获取应用配置（单例模式）"""
    _load_env_file()
    
    kimi_api_key = os.getenv("KIMI_API_KEY", "")
    if kimi_api_key:
        os.environ["KIMI_API_KEY"] = kimi_api_key
    
    base_url = _ensure_kimi_base_url()
    
    sessions_dir = Path.home() / ".kimi" / "cowork-desktop" / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    
    return Settings(
        kimi_api_key=kimi_api_key,
        kimi_base_url=base_url,
        default_model=os.getenv("KIMI_MODEL", "kimi-k2-thinking-turbo"),
        host=os.getenv("AGENT_HOST", "127.0.0.1"),
        port=int(os.getenv("AGENT_PORT", "3456")),
        sessions_dir=sessions_dir,
    )
