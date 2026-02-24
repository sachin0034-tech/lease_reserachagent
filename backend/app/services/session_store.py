import json
import os
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def _now_s() -> int:
    return int(time.time())


def _default_db_path() -> Path:
    """
    Place the DB under $HOME so Azure App Service persists it across restarts.
    Fallback to /tmp for local/dev environments where HOME might be unset.
    """
    home = os.environ.get("HOME") or "/tmp"
    return Path(home) / "legalgraph" / "sessions.db"


@dataclass(frozen=True)
class SessionStore:
    db_path: Path
    ttl_seconds: int = 6 * 60 * 60  # 6 hours

    @classmethod
    def from_env(cls) -> "SessionStore":
        raw_ttl = (os.environ.get("SESSION_TTL_SECONDS") or "").strip()
        ttl = 6 * 60 * 60
        if raw_ttl:
            try:
                ttl = max(60, int(raw_ttl))
            except ValueError:
                ttl = 6 * 60 * 60
        return cls(db_path=_default_db_path(), ttl_seconds=ttl)

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path), timeout=5, isolation_level=None)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA temp_store=MEMORY;")
        conn.execute("PRAGMA foreign_keys=ON;")
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              session_id TEXT PRIMARY KEY,
              data_json   TEXT NOT NULL,
              updated_at  INTEGER NOT NULL,
              expires_at  INTEGER NOT NULL
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);")
        return conn

    def _cleanup_expired(self, conn: sqlite3.Connection, now_s: int) -> None:
        conn.execute("DELETE FROM sessions WHERE expires_at <= ?;", (now_s,))

    def put(self, session_id: str, data: dict[str, Any]) -> None:
        now = _now_s()
        expires = now + int(self.ttl_seconds)
        payload = json.dumps(data, ensure_ascii=False)
        with self._connect() as conn:
            self._cleanup_expired(conn, now)
            conn.execute(
                """
                INSERT INTO sessions(session_id, data_json, updated_at, expires_at)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                  data_json=excluded.data_json,
                  updated_at=excluded.updated_at,
                  expires_at=excluded.expires_at;
                """,
                (session_id, payload, now, expires),
            )

    def get(self, session_id: str) -> dict[str, Any] | None:
        now = _now_s()
        with self._connect() as conn:
            self._cleanup_expired(conn, now)
            row = conn.execute(
                "SELECT data_json FROM sessions WHERE session_id = ? AND expires_at > ?;",
                (session_id, now),
            ).fetchone()
            if not row:
                return None
            try:
                data = json.loads(row[0])
                return data if isinstance(data, dict) else None
            except Exception:
                return None

    def patch(self, session_id: str, partial: dict[str, Any]) -> dict[str, Any] | None:
        """
        Shallow-merge `partial` into existing session object and refresh TTL.
        Returns updated session or None if session doesn't exist/expired.
        """
        current = self.get(session_id)
        if current is None:
            return None
        if not isinstance(partial, dict) or not partial:
            self.put(session_id, current)
            return current
        current.update(partial)
        self.put(session_id, current)
        return current

