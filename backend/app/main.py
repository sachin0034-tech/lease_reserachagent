import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as analyze_router
from app.core.config import OPENAI_API_KEY, ANTHROPIC_API_KEY

# CORS: allow origins from env (e.g. frontend URL on Azure) or default to localhost
_cors_origins = os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:3000")
CORS_ORIGINS = [o.strip() for o in _cors_origins.split(",") if o.strip()]

# Configure logging so you can see request/payload in the terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LegalGraph AI Research Agent",
    description="Backend for AI Lease Forecaster & Research Agent",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
def startup():
    from app.core.config import BACKEND_ROOT

    env_file = BACKEND_ROOT / ".env"
    logger.info("Backend started – POST /api/analyze, GET /api/analyze/latest")
    logger.info("Looking for .env at: %s (exists=%s)", env_file, env_file.exists())
    if OPENAI_API_KEY:
        logger.info(
            "OPENAI_API_KEY is set (length=%d). Research agent can use OpenAI.",
            len(OPENAI_API_KEY),
        )
    else:
        logger.warning(
            "OPENAI_API_KEY is not set. Add OPENAI_API_KEY=sk-... to %s (no quotes, no spaces around =) "
            "to enable OpenAI-based flows.",
            env_file,
        )

    if ANTHROPIC_API_KEY:
        logger.info(
            "ANTHROPIC_API_KEY is set (length=%d). Research agent can use Anthropic Claude SDK.",
            len(ANTHROPIC_API_KEY),
        )
    else:
        logger.info(
            "ANTHROPIC_API_KEY is not set. Anthropic Claude SDK integration will be disabled unless this is configured."
        )
