"""
Use OpenAI to summarize or extract key information from document text.
"""
import logging
from openai import OpenAI

from app.core.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Truncate very long docs to avoid token limits (roughly 4 chars per token)
MAX_CHARS = 120_000  # ~30k tokens


def summarize_with_openai(extracted_text: str) -> dict:
    """
    Send extracted text to OpenAI and return a short summary + key points.
    Returns {"summary": str, "key_points": list[str], "error": str | None}.
    """
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set; skipping OpenAI summary")
        return {"summary": "", "key_points": [], "error": "OPENAI_API_KEY not set"}

    if not extracted_text or extracted_text.startswith("("):
        return {"summary": "", "key_points": [], "error": None}

    text = extracted_text[:MAX_CHARS]
    if len(extracted_text) > MAX_CHARS:
        text += "\n\n[Document truncated for length.]"

    client = OpenAI(api_key=OPENAI_API_KEY)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a lease document analyst. Summarize the following document concisely and list 3–5 key points (rent, term, parties, obligations, or notable clauses). Reply with a brief summary and a bullet list of key points.",
                },
                {"role": "user", "content": text},
            ],
            max_tokens=1024,
        )
        content = (response.choices[0].message.content or "").strip()
        logger.info("OpenAI summary received, %d chars", len(content))

        # Simple split: first paragraph as summary, rest as key points
        lines = [l.strip() for l in content.split("\n") if l.strip()]
        summary = lines[0] if lines else ""
        key_points = [l.lstrip("-•* ").strip() for l in lines[1:] if l.lstrip("-•* ")]

        return {"summary": summary, "key_points": key_points, "error": None}
    except Exception as e:
        logger.exception("OpenAI request failed: %s", e)
        return {"summary": "", "key_points": [], "error": str(e)}
