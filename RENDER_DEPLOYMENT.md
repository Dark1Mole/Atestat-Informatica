# Deploy Backend to Render

## Step 1: Prepare GitHub

Push your repo to GitHub if not already there:

```bash
git add .
git commit -m "Add Render deployment config"
git push origin main
```

## Step 2: Create Render Account

1. Go to https://render.com
2. Sign up (use GitHub account for ease)
3. Connect your GitHub repository

## Step 3: Create a Web Service on Render

1. Click **New +** → **Web Service**
2. Select your `Atestat-Informatica` repository
3. Fill in the form:
   - **Name:** `atestat-backend` (or any name)
   - **Region:** Select closest to you
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node backend/server.js`
   - **Plan:** Free (or Starter)

## Step 4: Set Environment Variables (if needed)

1. In Render dashboard, go to your service
2. Click **Environment**
3. Add any env vars (none needed for basic setup)

## Step 5: Deploy

Click **Create Web Service**

- Render will automatically:
  - Clone your repo
  - Run `npm install`
  - Start `node backend/server.js`
  - Give you a public URL like `https://atestat-backend-xxxx.onrender.com`

## Step 6: Add Backend URL to Vercel Frontend

1. Copy the Render URL (e.g., `https://atestat-backend-xxxx.onrender.com`)
2. Go to Vercel dashboard → your `atestat-informatica` project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://atestat-backend-xxxx.onrender.com`
5. Click **Add**
6. Redeploy frontend: click **Deployments** → **Redeploy** on latest commit

## Step 7: Test

1. Visit your Vercel frontend URL
2. Load a problem — if it works, the API is connected
3. Try submitting a solution

## Notes

- **Cold start:** Render free tier sleeps after 15 min inactivity. First request after sleep takes ~30 sec. Upgrade to Starter if you want always-on.
- **CORS:** [backend/server.js](../backend/server.js) already has `cors()` enabled, so cross-origin requests work.
- **Logs:** View live logs in Render dashboard under your service.

## Troubleshooting

If frontend still gets 404:

- Check Vercel env var is set correctly
- Verify Render service is running (green status in dashboard)
- Check Render logs for backend errors
- Test the backend URL directly: `curl https://atestat-backend-xxxx.onrender.com/api/problems`
