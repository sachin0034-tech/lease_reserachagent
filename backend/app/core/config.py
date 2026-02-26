import os
from pathlib import Path

from dotenv import load_dotenv

# Backend root (backend/) – load .env here first so it works regardless of cwd
BACKEND_ROOT = Path(__file__).resolve().parents[2]
_env_path = BACKEND_ROOT / ".env"

# Load with override=True so we always get .env values (e.g. under uvicorn --reload)
load_dotenv(_env_path, override=True)
if Path.cwd() / ".env" != _env_path:
    load_dotenv(Path.cwd() / ".env", override=False)


def _read_key_from_env_file(key_name: str) -> str | None:
    """
    Fallback: parse .env file directly if env var not set (e.g. subprocess/reload).

    Supports arbitrary key names so we can reuse for multiple providers (OpenAI, Anthropic, etc.).
    """
    if not _env_path.exists():
        return None
    try:
        raw = _env_path.read_text(encoding="utf-8-sig").strip()  # utf-8-sig strips BOM
        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            if key.strip() == key_name:
                v = value.strip().strip("'\"")
                # Treat placeholder examples as missing
                return v if v and v not in {"sk-...", "sk-ant-..."} else None
    except Exception:
        # Silent fallback – callers will handle missing keys
        pass
    return None


_raw_openai = os.environ.get("OPENAI_API_KEY")
OPENAI_API_KEY = (_raw_openai or "").strip().strip("'\"") or None
if not OPENAI_API_KEY:
    OPENAI_API_KEY = _read_key_from_env_file("OPENAI_API_KEY")
if OPENAI_API_KEY in {"sk-...", "sk-ant-..."}:
    OPENAI_API_KEY = None

_raw_anthropic = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_API_KEY = (_raw_anthropic or "").strip().strip("'\"") or None
if not ANTHROPIC_API_KEY:
    ANTHROPIC_API_KEY = _read_key_from_env_file("ANTHROPIC_API_KEY")
if ANTHROPIC_API_KEY in {"sk-...", "sk-ant-..."}:
    ANTHROPIC_API_KEY = None

_raw_tavily = os.environ.get("TAVILY_API_KEY")
TAVILY_API_KEY = (_raw_tavily or "").strip().strip("'\"").strip() or None
if not TAVILY_API_KEY:
    TAVILY_API_KEY = _read_key_from_env_file("TAVILY_API_KEY")


# --- Supabase configuration (for login/allowlist checks) ---
_raw_supabase_url = os.environ.get("SUPABASE_URL")
SUPABASE_URL = (_raw_supabase_url or "").strip().strip("'\"") or None
if not SUPABASE_URL:
    SUPABASE_URL = _read_key_from_env_file("SUPABASE_URL")

_raw_supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_SERVICE_ROLE_KEY = (_raw_supabase_service_key or "").strip().strip("'\"") or None
if not SUPABASE_SERVICE_ROLE_KEY:
    SUPABASE_SERVICE_ROLE_KEY = _read_key_from_env_file("SUPABASE_SERVICE_ROLE_KEY")

SUPABASE_ALLOWED_USERS_TABLE = (
    os.environ.get("SUPABASE_ALLOWED_USERS_TABLE") or _read_key_from_env_file("SUPABASE_ALLOWED_USERS_TABLE") or "allowed_users"
).strip()
