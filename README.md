# GlowCoach Main Live Product

This is the clean main product version.

## Stack

- Frontend: Vercel
- Backend: Render
- Database: Supabase Postgres
- Code storage: GitHub
- LLM: OpenAI-compatible API

## Features

- Register/login
- JWT sessions
- Supabase/Postgres database
- Chat history
- User memories
- User goals
- Onboarding profile
- Quick check-ins
- Personalized motivational coaching

## 1. Supabase setup

1. Create a free Supabase project.
2. Go to Project Settings > Database.
3. Copy the Postgres connection string.
4. Prefer the pooled connection string if available.
5. Put it in Render as `DATABASE_URL`.

You do not need to create tables manually. The backend creates them on startup.

## 2. Render backend setup

Create a new Render Web Service from your GitHub repo.

Settings:

- Root Directory: backend
- Build Command: npm install
- Start Command: npm start

Environment variables:

```text
PORT=3000
JWT_SECRET=make_this_long_random_and_private
DATABASE_URL=your_supabase_postgres_connection_string
FRONTEND_ORIGIN=https://your-vercel-site.vercel.app
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_API_KEY=your_llm_api_key
LLM_MODEL=gpt-4o-mini
```

After deploy, test:

```text
https://your-render-url.onrender.com/api/health
```

You should see:

```json
{ "ok": true, "database": "connected" }
```

## 3. Vercel frontend setup

Open:

```text
frontend/script.js
```

Set:

```js
const API_BASE_URL = "https://your-render-url.onrender.com";
```

Deploy on Vercel.

Settings:

- Framework Preset: Other
- Root Directory: frontend
- Build Command: blank
- Output Directory: ./

## 4. Important

Do not upload `.env` files to GitHub.

For early MVP testing, this is enough. Before a public launch, add:
- Terms of Service
- Privacy Policy
- Better password reset
- Admin moderation tools
- Usage limits by user
- Supabase Row Level Security if you access Supabase directly from frontend later
