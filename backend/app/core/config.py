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

def _read_key_from_env_file() -> str | None:
    """Fallback: parse .env file directly if env var not set (e.g. subprocess/reload)."""
    if not _env_path.exists():
        return None
    try:
        raw = _env_path.read_text(encoding="utf-8-sig").strip()  # utf-8-sig strips BOM
        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            if key.strip() == "OPENAI_API_KEY":
                v = value.strip().strip("'\"")
                return v if v and v != "sk-..." else None
    except Exception:
        pass
    return None

_raw = os.environ.get("OPENAI_API_KEY")
OPENAI_API_KEY = (_raw or "").strip().strip("'\"") or None
if not OPENAI_API_KEY:
    OPENAI_API_KEY = _read_key_from_env_file()
if OPENAI_API_KEY == "sk-...":
    OPENAI_API_KEY = None
