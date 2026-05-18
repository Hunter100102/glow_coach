# GlowCoach Login + Memory Backend

Adds register/login, JWT auth, chat history, user memories, and goal-aware coaching.

Render settings:
- Root Directory: backend
- Build Command: npm install
- Start Command: npm start

Render Environment Variables:
PORT=3000
JWT_SECRET=make_this_long_random_and_private
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_API_KEY=your_key
LLM_MODEL=gpt-4o-mini
FRONTEND_ORIGIN=https://your-vercel-site.vercel.app

SQLite is fine for MVP testing. For production, move to Supabase/Postgres.
