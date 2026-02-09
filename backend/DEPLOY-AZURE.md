# Deploy Backend to Azure App Service (Step-by-Step)

This guide walks you through deploying the **LegalGraph AI Research Agent** FastAPI backend to **Azure App Service** on Linux. Follow the steps in order.

---

## Prerequisites

Before you start, ensure you have:

1. **Azure account** – [Create one for free](https://azure.microsoft.com/free/) if needed.
2. **Azure CLI** – Install: [Windows](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows) | [macOS](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-macos) | [Linux](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-linux).
3. **Git** – [Download Git](https://git-scm.com/downloads).
4. **Python 3.10 or 3.11** – For local testing; [python.org](https://www.python.org/downloads/).
5. **Your OpenAI API key** – From [OpenAI API keys](https://platform.openai.com/api-keys).

---

## Step 1: Log in to Azure

Open a terminal (PowerShell, CMD, or bash) and run:

```bash
az login
```

A browser window will open. Sign in with your Azure account. After login, you can close the browser and return to the terminal.

---

## Step 2: Choose a subscription (optional)

If you have multiple Azure subscriptions, set the one to use:

```bash
# List subscriptions
az account list --output table

# Set active subscription (replace <subscription-id> with your SubscriptionId)
az account set --subscription "<subscription-id>"
```

---

## Step 3: Create a resource group

A resource group holds all resources for this app (e.g. App Service plan, web app).

```bash
# Replace <your-resource-group-name> and <region> with your choices.
# Examples for region: eastus, westus2, westeurope

az group create --name <your-resource-group-name> --location <region>
```

**Example:**

```bash
az group create --name legalgraph-rg --location eastus
```

---

## Step 4: Create an App Service plan

The App Service plan defines the region, size, and OS for your app.

```bash
# Replace <your-plan-name> and <your-resource-group-name> with your values.
# --is-linux is required for Python.

az appservice plan create \
  --name <your-plan-name> \
  --resource-group <your-resource-group-name> \
  --is-linux \
  --sku B1
```

- **B1** = Basic tier (low cost, suitable for dev/test). Use **S1** or higher for production.
- Use the same resource group name as in Step 3.

**Example:**

```bash
az appservice plan create \
  --name legalgraph-plan \
  --resource-group legalgraph-rg \
  --is-linux \
  --sku B1
```

---

## Step 5: Create the web app

Create the web app that will host your FastAPI backend.

```bash
# Replace:
#   <your-app-name>     – globally unique name (e.g. legalgraph-api-yourname)
#   <your-resource-group-name>
#   <your-plan-name>
# Python 3.11 is used here; you can use 3.10 if you prefer.

az webapp create \
  --name <your-app-name> \
  --resource-group <your-resource-group-name> \
  --plan <your-plan-name> \
  --runtime "PYTHON:3.11"
```

**Example:**

```bash
az webapp create \
  --name legalgraph-api-mycompany \
  --resource-group legalgraph-rg \
  --plan legalgraph-plan \
  --runtime "PYTHON:3.11"
```

**Important:** `<your-app-name>` must be globally unique. The app URL will be:  
`https://<your-app-name>.azurewebsites.net`

---

## Step 6: Configure startup command

Azure must know how to run your app. Set the startup command to use **uvicorn**:

```bash
# Replace <your-app-name> and <your-resource-group-name>

az webapp config set \
  --name <your-app-name> \
  --resource-group <your-resource-group-name> \
  --startup-file "uvicorn app.main:app --host 0.0.0.0 --port 8000"
```

**Example:**

```bash
az webapp config set \
  --name legalgraph-api-mycompany \
  --resource-group legalgraph-rg \
  --startup-file "uvicorn app.main:app --host 0.0.0.0 --port 8000"
```

Azure App Service will route traffic to port 8000 by default for custom Python apps.

---

## Step 7: Set the port Azure uses (optional but recommended)

Ensure the app and Azure agree on the port:

```bash
az webapp config appsettings set \
  --name <your-app-name> \
  --resource-group <your-resource-group-name> \
  --settings PORT=8000
```

Use the same port as in the startup command (8000).

---

## Step 8: Add application settings (environment variables)

Set **OPENAI_API_KEY** and, if you have a frontend, **CORS**:

```bash
# Replace:
#   <your-app-name>
#   <your-resource-group-name>
#   <your-openai-api-key>   – your real OpenAI key (starts with sk-...)
#   <frontend-url>          – e.g. https://your-frontend.azurewebsites.net or https://yourdomain.com

az webapp config appsettings set \
  --name <your-app-name> \
  --resource-group <your-resource-group-name> \
  --settings \
    OPENAI_API_KEY="<your-openai-api-key>" \
    CORS_ALLOW_ORIGINS="<frontend-url>"
```

**Example (no frontend yet, only backend):**

```bash
az webapp config appsettings set \
  --name legalgraph-api-mycompany \
  --resource-group legalgraph-rg \
  --settings OPENAI_API_KEY="sk-proj-your-actual-key-here"
```

**Example (with frontend URL for CORS):**

```bash
az webapp config appsettings set \
  --name legalgraph-api-mycompany \
  --resource-group legalgraph-rg \
  --settings \
    OPENAI_API_KEY="sk-proj-your-actual-key-here" \
    CORS_ALLOW_ORIGINS="https://your-frontend.azurewebsites.net"
```

**Security:** Do not commit your real `OPENAI_API_KEY` to Git. Set it only in Azure (or in a secure secret store).

---

## Step 9: Enable and configure deployment (Git-based)

You will deploy code from your machine or from a Git repo. First, create a **local Git** deployment user (one-time per app/service):

```bash
# Set a username and password for deployment (remember the password).

az webapp deployment user set \
  --user-name <deployment-username> \
  --password <deployment-password>
```

**Example:**

```bash
az webapp deployment user set --user-name legalgraph-deploy --password "YourSecurePassword123!"
```

Then get the **Git clone URI** for your app (you will push code here):

```bash
az webapp deployment source config-local-git \
  --name <your-app-name> \
  --resource-group <your-resource-group-name> \
  --output table
```

Note the **Git Clone Uri** (e.g. `https://<user>@legalgraph-api-mycompany.scm.azurewebsites.net/legalgraph-api-mycompany.git`).

---

## Step 10: Prepare the backend folder for deployment

From your project root (where the `backend` folder is):

1. **Go into the backend directory:**

   ```bash
   cd backend
   ```

2. **Create a file named `startup.txt`** (or keep this in mind for the startup command):  
   Azure will run the startup command you set in Step 6; no extra file is required if that command is already set.

3. **Ensure `requirements.txt` is present** in `backend/` with at least:

   ```
   fastapi>=0.115.0
   uvicorn[standard]>=0.32.0
   pydantic>=2.0.0
   python-multipart>=0.0.9
   python-dotenv>=1.0.0
   openai>=1.0.0
   pypdf>=5.0.0
   python-docx>=1.0.0
   ```

4. **Do not deploy your `.env` file.**  
   You already set `OPENAI_API_KEY` (and optionally `CORS_ALLOW_ORIGINS`) in Azure App Service settings. Ensure `.env` is in `.gitignore`.

---

## Step 11: Deploy code using Git push (option A)

From the **backend** folder (so that `app/` and `requirements.txt` are at the repo root of what you push):

1. **Initialize Git** (if not already):

   ```bash
   cd backend
   git init
   git add .
   git commit -m "Prepare backend for Azure"
   ```

2. **Add Azure as remote and push** (use the Git Clone Uri from Step 9; replace `<deployment-username>` and `<your-app-name>` if different):

   ```bash
   git remote add azure https://<deployment-username>@<your-app-name>.scm.azurewebsites.net/<your-app-name>.git
   git push azure main
   ```

   If your default branch is `master`:

   ```bash
   git push azure master
   ```

   When prompted for password, use the **deployment password** you set in Step 9.

3. **Wait for the build to finish.**  
   Azure will install dependencies from `requirements.txt` and run your startup command. This can take a few minutes the first time.

---

## Step 11 (alternative): Deploy using ZIP deploy (option B)

If you prefer not to use Git:

1. **From the `backend` folder**, create a ZIP of the application (include `app/`, `requirements.txt`, and any other files the app needs; **exclude** `__pycache__`, `.env`, `.git`):

   **On Windows (PowerShell):**
   ```powershell
   cd backend
   Compress-Archive -Path app, requirements.txt -DestinationPath deploy.zip -Force
   ```

   **On macOS/Linux:**
   ```bash
   cd backend
   zip -r deploy.zip app requirements.txt
   ```

2. **Deploy the ZIP:**

   ```bash
   az webapp deployment source config-zip \
     --resource-group <your-resource-group-name> \
     --name <your-app-name> \
     --src deploy.zip
   ```

3. Wait for the deployment to complete (a few minutes).

---

## Step 12: Verify deployment

1. **Health check:** Open in a browser or with curl:

   ```
   https://<your-app-name>.azurewebsites.net/health
   ```

   You should see: `{"status":"ok"}`.

2. **API docs:**  
   ```
   https://<your-app-name>.azurewebsites.net/docs
   ```
   You should see the Swagger UI for your FastAPI app.

3. **Logs (if something fails):**  
   In Azure Portal: open your **Web App** → **Monitoring** → **Log stream**, or use CLI:

   ```bash
   az webapp log tail --name <your-app-name> --resource-group <your-resource-group-name>
   ```

---

## Step 13: Update CORS when you have a frontend

When you deploy a frontend (e.g. React app), your backend must allow that origin. Add or update the `CORS_ALLOW_ORIGINS` setting:

```bash
az webapp config appsettings set \
  --name <your-app-name> \
  --resource-group <your-resource-group-name> \
  --settings CORS_ALLOW_ORIGINS="https://your-frontend-url.com"
```

To allow multiple origins, use a comma-separated list (no spaces). The app code must support reading this env var and passing it to FastAPI’s CORS middleware (see your `app/main.py` or backend docs).

After changing settings, the app may restart automatically.

---

## Summary checklist

- [ ] Azure CLI installed and `az login` done  
- [ ] Resource group created  
- [ ] App Service plan created (Linux, e.g. B1)  
- [ ] Web app created with runtime `PYTHON:3.11`  
- [ ] Startup command set: `uvicorn app.main:app --host 0.0.0.0 --port 8000`  
- [ ] PORT=8000 set in App settings (recommended)  
- [ ] OPENAI_API_KEY set in App settings  
- [ ] CORS_ALLOW_ORIGINS set if you have a frontend  
- [ ] Code deployed (Git push or ZIP deploy from `backend/`)  
- [ ] `/health` returns `{"status":"ok"}`  
- [ ] `/docs` loads Swagger UI  

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| App not starting | Check **Log stream** in Azure Portal or `az webapp log tail`. Ensure startup command is exactly `uvicorn app.main:app --host 0.0.0.0 --port 8000` and PORT=8000 is set. |
| 502 Bad Gateway | App may be crashing. Check **Log stream** and **Deployment** logs. Ensure `requirements.txt` is in the root of what you deploy and all dependencies install. |
| 503 / timeout | Increase startup timeout in App Service **Configuration** → **General settings** if needed; ensure no long blocking work at import/startup. |
| CORS errors from frontend | Set `CORS_ALLOW_ORIGINS` to your frontend URL (and ensure the backend reads this env var in CORS middleware). |
| OpenAI errors | Verify `OPENAI_API_KEY` in **Configuration** → **Application settings**; no typos, no extra spaces, key is valid. |

---

## Cost note

- **B1** Basic tier is low cost but not free. Check [Azure App Service pricing](https://azure.microsoft.com/pricing/details/app-service/).
- To avoid charges when not using the app, **stop** the web app from the Azure Portal or run:  
  `az webapp stop --name <your-app-name> --resource-group <your-resource-group-name>`  
  Start it again with:  
  `az webapp start --name <your-app-name> --resource-group <your-resource-group-name>` when you need it.

---

You can now call your API at `https://<your-app-name>.azurewebsites.net` (e.g. `POST /api/analyze`, `GET /health`, etc.). Use this base URL in your frontend or API client.
