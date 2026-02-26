import json
import logging
import ssl
from urllib import error, parse, request

import certifi

from app.core.config import SUPABASE_ALLOWED_USERS_TABLE, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

logger = logging.getLogger(__name__)


class SupabaseNotConfiguredError(RuntimeError):
    """Raised when Supabase configuration is missing."""


_SSL_CONTEXT: ssl.SSLContext | None = None


def _get_ssl_context() -> ssl.SSLContext:
    """
    Build a TLS context using certifi's CA bundle so that Supabase's certificate
    validates correctly, even on systems without a configured root store.
    """
    global _SSL_CONTEXT
    if _SSL_CONTEXT is None:
        try:
            _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
        except Exception:  # pragma: no cover - fallback path
            _SSL_CONTEXT = ssl.create_default_context()
    return _SSL_CONTEXT


def _build_supabase_rest_url(table: str, username: str, with_credits: bool = False) -> str:
    base = (SUPABASE_URL or "").rstrip("/")
    select_cols = "id,username,credits" if with_credits else "id,username"
    query = parse.urlencode({"select": select_cols, "username": f"eq.{username}", "limit": 1})
    return f"{base}/rest/v1/{table}?{query}"


def is_user_allowed(username: str) -> bool:
    """
    Return True if the user exists in the configured Supabase table, False otherwise.

    Assumes a table like:
      allowed_users (id uuid, username text, ...)

    and uses the service role key so this check can be made from the backend only.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.warning(
            "Supabase configuration missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY); cannot validate user.",
        )
        raise SupabaseNotConfiguredError("Supabase is not configured")

    username_normalized = (username or "").strip()
    if not username_normalized:
        return False

    table = SUPABASE_ALLOWED_USERS_TABLE or "allowed_users"
    url = _build_supabase_rest_url(table, username_normalized, with_credits=False)
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
    }

    req = request.Request(url, headers=headers, method="GET")
    try:
        context = _get_ssl_context()
        with request.urlopen(req, timeout=5, context=context) as resp:
            if resp.status != 200:
                logger.error(
                    "Supabase returned non-200 status %s for username=%s",
                    resp.status,
                    username_normalized,
                )
                return False
            body = resp.read().decode("utf-8")
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                logger.error(
                    "Failed to decode Supabase response as JSON for username=%s: %s",
                    username_normalized,
                    body[:200],
                )
                return False
            if isinstance(data, list) and data:
                return True
            return False
    except error.URLError as exc:
        logger.error("Error calling Supabase for username=%s: %s", username_normalized, exc)
        return False


def _fetch_user_row(username: str) -> dict | None:
    """
    Internal helper: fetch a single user row (id, username, credits) from Supabase.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise SupabaseNotConfiguredError("Supabase is not configured")

    username_normalized = (username or "").strip()
    if not username_normalized:
        return None

    table = SUPABASE_ALLOWED_USERS_TABLE or "allowed_users"
    url = _build_supabase_rest_url(table, username_normalized, with_credits=True)
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
    }
    req = request.Request(url, headers=headers, method="GET")
    try:
        context = _get_ssl_context()
        with request.urlopen(req, timeout=5, context=context) as resp:
            if resp.status != 200:
                logger.error(
                    "Supabase returned non-200 status %s while fetching user row for %s",
                    resp.status,
                    username_normalized,
                )
                return None
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            if isinstance(data, list) and data:
                return data[0]
            return None
    except Exception as exc:  # broad: log and treat as missing
        logger.error("Error fetching Supabase user row for %s: %s", username_normalized, exc)
        return None


def get_user_credits(username: str) -> int | None:
    """
    Return the current credits for the given username, or None if not available.
    """
    row = _fetch_user_row(username)
    if not row:
        return None
    credits = row.get("credits")
    if credits is None:
        return None
    try:
        return int(credits)
    except (TypeError, ValueError):
        return None


def decrement_user_credits(username: str, amount: int) -> int | None:
    """
    Decrease the user's credits by `amount` and return the new balance.

    Returns:
      - new credits value on success
      - None if the user or credits could not be found/updated
    """
    row = _fetch_user_row(username)
    if not row:
        return None

    current = row.get("credits")
    if current is None:
        return None

    try:
        current_int = int(current)
    except (TypeError, ValueError):
        return None

    if amount <= 0:
        return current_int

    new_credits = current_int - amount
    if new_credits < 0:
        # Do not update if not enough credits
        return current_int

    table = SUPABASE_ALLOWED_USERS_TABLE or "allowed_users"
    base = (SUPABASE_URL or "").rstrip("/")
    user_id = row.get("id")
    if not user_id:
        return None
    patch_url = f"{base}/rest/v1/{table}?id=eq.{user_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    payload = json.dumps({"credits": new_credits}).encode("utf-8")
    req = request.Request(patch_url, headers=headers, data=payload, method="PATCH")
    try:
        context = _get_ssl_context()
        with request.urlopen(req, timeout=5, context=context) as resp:
            if resp.status not in (200, 204):
                logger.error(
                    "Supabase returned non-2xx status %s while updating credits for %s",
                    resp.status,
                    username,
                )
                return None
            body = resp.read().decode("utf-8") or "[]"
            try:
                data = json.loads(body)
                if isinstance(data, list) and data:
                    updated = data[0]
                    updated_credits = updated.get("credits", new_credits)
                    return int(updated_credits)
            except json.JSONDecodeError:
                # If no representation returned, fall back to new_credits
                pass
            return new_credits
    except Exception as exc:
        logger.error("Error updating Supabase credits for %s: %s", username, exc)
        return None

