# Deploy Full Backend (OpenAI + Claude + Tavily) in One Place

Vercel has a **250 MB** serverless limit, so for the **complete** backend (Claude SDK + Tavily + OpenAI) use one of these. All use the same repo and `requirements.txt` (no size limit).

---

## Option 1: Railway (recommended)

**Free tier:** $5 credit/month. No 250 MB limit.

1. **Sign up:** [railway.app](https://railway.app) → Login with GitHub.

2. **New project:** **New Project** → **Deploy from GitHub repo** → select your repo.

3. **Root directory:** Set **Root Directory** to `backend` (in project Settings or when adding the service).

4. **Start command:** The repo includes `backend/railway.json` with:
   ```json
   "deploy": {
     "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
     "healthcheckPath": "/health"
   }
   ```
   Railway will use this automatically. If you still see **"No start command was found"**, set it manually: Service → **Settings** → **Deploy** → **Start Command** = `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

5. **Env vars:** Project → **Variables** → add:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `TAVILY_API_KEY`
   - `CORS_ALLOW_ORIGINS` = your frontend URL (e.g. `https://your-app.netlify.app`)

6. **Domain:** **Settings** → **Generate Domain** → use this as your API base URL in the frontend.

---

## Option 2: Render

**Free tier:** 750 hours/month. No 250 MB limit.

1. **Sign up:** [render.com](https://render.com) → Login with GitHub.

2. **New Web Service:** **New** → **Web Service** → connect your repo.

3. **Settings:**
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Env vars:** **Environment** → add:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `TAVILY_API_KEY`
   - `CORS_ALLOW_ORIGINS` = your frontend URL

5. **Deploy:** Save → Render builds and gives you a URL like `https://your-service.onrender.com`. Use it as the API base in the frontend.

**Note:** Free tier spins down after inactivity; first request may be slow (cold start).

---

## Option 3: Fly.io

**Free tier:** Limited resources. No 250 MB limit.

1. **Install CLI:** `curl -L https://fly.io/install.sh | sh` (or see [fly.io/docs](https://fly.io/docs/hands-on/install-flyctl/)).

2. **Login:** `fly auth login`

3. **In your repo (backend folder):**  
   Create `backend/Dockerfile`:
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY . .
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
   ```
   Then:
   ```bash
   cd backend
   fly launch
   ```
   Follow prompts (choose app name, region). Then:
   ```bash
   fly secrets set OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... TAVILY_API_KEY=tvly-... CORS_ALLOW_ORIGINS=https://your-frontend.netlify.app
   fly deploy
   ```

4. **URL:** `https://your-app-name.fly.dev` → use as API base URL.

---

## Summary

| Platform  | Free tier        | Limit   | Best for              |
|----------|-------------------|---------|------------------------|
| Railway  | $5 credit/month   | None    | Easiest, full backend |
| Render   | 750 hrs/month     | None    | Simple, may cold start |
| Fly.io   | Limited           | None    | More control, Docker   |

Use **one** of these for the **complete** backend (OpenAI + Claude + Tavily). Point your frontend’s API base URL to the deployed backend URL and set `CORS_ALLOW_ORIGINS` to that frontend URL.
