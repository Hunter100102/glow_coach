require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is missing.");
}

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is missing.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      onboarding_complete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memories (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT DEFAULT 'general',
      memory TEXT NOT NULL,
      importance INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, memory)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, goal)
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mood TEXT,
      energy TEXT,
      focus TEXT,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_user_created ON memories(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_goals_user_created ON goals(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_checkins_user_created ON checkins(user_id, created_at);
  `);
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Missing login token." });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired login token." });
  }
}

async function getUserProfile(userId) {
  const [memoriesResult, goalsResult, checkinsResult] = await Promise.all([
    pool.query(
      `SELECT category, memory, importance, created_at
       FROM memories
       WHERE user_id = $1
       ORDER BY importance DESC, created_at DESC
       LIMIT 50`,
      [userId]
    ),
    pool.query(
      `SELECT goal, status, created_at
       FROM goals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    ),
    pool.query(
      `SELECT mood, energy, focus, note, created_at
       FROM checkins
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    )
  ]);

  return {
    memories: memoriesResult.rows,
    goals: goalsResult.rows,
    checkins: checkinsResult.rows
  };
}

async function saveMemory(userId, category, memory, importance = 1) {
  const clean = (memory || "").trim();
  if (!clean) return;

  await pool.query(
    `INSERT INTO memories (user_id, category, memory, importance)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, memory)
     DO UPDATE SET importance = GREATEST(memories.importance, EXCLUDED.importance)`,
    [userId, category, clean.length > 500 ? clean.slice(0, 500) + "..." : clean, importance]
  );
}

async function extractMemories(userId, message) {
  const text = message.trim();
  const lower = text.toLowerCase();

  const patterns = [
    { category: "identity", importance: 3, signals: ["my name is", "i am", "i'm"] },
    { category: "likes", importance: 2, signals: ["i like", "i love", "i enjoy", "favorite"] },
    { category: "dislikes", importance: 2, signals: ["i hate", "i don't like", "i dislike"] },
    { category: "goals", importance: 3, signals: ["my goal", "i want to", "i'm trying to", "i am trying to", "i need to", "i plan to", "i want"] },
    { category: "struggles", importance: 3, signals: ["i struggle", "i have trouble", "it's hard for me", "i can't seem to", "i keep failing"] },
    { category: "values", importance: 3, signals: ["i care about", "important to me", "i value"] },
    { category: "money", importance: 2, signals: ["money", "debt", "income", "business", "job", "career", "client", "sales", "profit"] },
    { category: "health", importance: 2, signals: ["health", "weight", "workout", "sleep", "food", "diet", "energy"] },
    { category: "relationships", importance: 2, signals: ["wife", "husband", "girlfriend", "boyfriend", "family", "friend", "kids"] }
  ];

  const matched = patterns.find(p => p.signals.some(s => lower.includes(s)));
  if (!matched || text.length < 8) return;

  await saveMemory(userId, matched.category, text, matched.importance);

  if (matched.category === "goals") {
    await pool.query(
      `INSERT INTO goals (user_id, goal)
       VALUES ($1, $2)
       ON CONFLICT (user_id, goal) DO NOTHING`,
      [userId, text.length > 500 ? text.slice(0, 500) + "..." : text]
    );
  }
}

function buildSystemPrompt(user, profile) {
  const memories = profile.memories.length
    ? profile.memories.map(m => `- [${m.category}] ${m.memory}`).join("\n")
    : "- No saved memories yet.";

  const goals = profile.goals.length
    ? profile.goals.map(g => `- ${g.goal} (${g.status})`).join("\n")
    : "- No saved goals yet.";

  const checkins = profile.checkins.length
    ? profile.checkins.map(c => `- Mood: ${c.mood || "unknown"}, Energy: ${c.energy || "unknown"}, Focus: ${c.focus || "unknown"}, Note: ${c.note || ""}`).join("\n")
    : "- No check-ins yet.";

  return `
You are GlowCoach, a motivational AI life partner and supportive friend.

You are talking to: ${user.name}

Known user memories:
${memories}

Known user goals:
${goals}

Recent check-ins:
${checkins}

Your mission:
- Learn the user's goals, values, personality, likes, dislikes, struggles, habits, and dreams.
- Use those details to personalize replies.
- Steer the user toward beneficial directions: confidence, discipline, money habits, career growth, healthier routines, stronger relationships, and consistent action.
- Be warm, playful when appropriate, direct, honest, and practical.
- Talk like a supportive friend, not a corporate bot.
- Give small next steps.
- Ask one thoughtful question when more context would help.
- Do not shame, manipulate, or pressure the user.
- Do not claim to be a therapist, doctor, lawyer, or financial advisor.
- If the user mentions self-harm, immediate danger, abuse, or crisis, tell them to contact emergency services or a trusted person immediately.

Memory behavior:
- Use saved memories naturally and quietly.
- Do not dump the user's profile unless asked.
- Connect advice to the user's stated goals and values.
- Encourage progress without pretending certainty.

Reply style:
- Usually under 180 words.
- Conversational.
- Motivational.
- 1 to 3 action steps when useful.
`;
}

async function callLLM(messages) {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!apiUrl || !apiKey) {
    return "GlowCoach is live, but the LLM API settings are missing on the backend.";
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, messages, temperature: 0.8 })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LLM error:", response.status, errorText);
    return "I had trouble connecting to my AI brain. Check the backend API key/model settings.";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I'm here with you. What do you want to work on today?";
}

app.get("/", (req, res) => {
  res.json({ ok: true, app: "GlowCoach backend running", database: "Supabase/Postgres" });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, database: "failed", error: error.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [cleanEmail]);

    if (existing.rows.length) return res.status(409).json({ error: "That email already has an account." });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      "INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)",
      [id, name.trim(), cleanEmail, passwordHash]
    );

    await saveMemory(id, "identity", `The user's name is ${name.trim()}.`, 3);

    const user = { id, name: name.trim(), email: cleanEmail };
    res.json({ token: createToken(user), user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Invalid login." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid login." });

    const safeUser = { id: user.id, name: user.name, email: user.email };
    res.json({ token: createToken(safeUser), user: safeUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  res.json({ user: req.user, profile: await getUserProfile(req.user.id) });
});

app.post("/api/onboarding", authRequired, async (req, res) => {
  try {
    const { mainGoal, struggle, style, focusArea } = req.body || {};

    if (mainGoal) {
      await saveMemory(req.user.id, "goals", `Main goal: ${mainGoal}`, 3);
      await pool.query(
        `INSERT INTO goals (user_id, goal)
         VALUES ($1, $2)
         ON CONFLICT (user_id, goal) DO NOTHING`,
        [req.user.id, mainGoal]
      );
    }

    if (struggle) await saveMemory(req.user.id, "struggles", `Current struggle: ${struggle}`, 3);
    if (style) await saveMemory(req.user.id, "preferences", `Preferred coaching style: ${style}`, 2);
    if (focusArea) await saveMemory(req.user.id, "focus", `Primary focus area: ${focusArea}`, 2);

    await pool.query("UPDATE users SET onboarding_complete = TRUE WHERE id = $1", [req.user.id]);

    res.json({ ok: true, profile: await getUserProfile(req.user.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Onboarding failed." });
  }
});

app.post("/api/checkin", authRequired, async (req, res) => {
  try {
    const { mood, energy, focus, note } = req.body || {};

    await pool.query(
      `INSERT INTO checkins (user_id, mood, energy, focus, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, mood || null, energy || null, focus || null, note || null]
    );

    if (note) await saveMemory(req.user.id, "checkin", `Recent check-in note: ${note}`, 1);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Check-in failed." });
  }
});

app.get("/api/chat/history", authRequired, async (req, res) => {
  const result = await pool.query(
    `SELECT role, content, created_at
     FROM messages
     WHERE user_id = $1
     ORDER BY created_at ASC
     LIMIT 120`,
    [req.user.id]
  );

  res.json({ messages: result.rows });
});

app.post(["/chat", "/api/chat"], authRequired, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ error: "Message is required." });

    const cleanMessage = message.trim();

    await pool.query(
      "INSERT INTO messages (user_id, role, content) VALUES ($1, $2, $3)",
      [req.user.id, "user", cleanMessage]
    );

    await extractMemories(req.user.id, cleanMessage);
    const profile = await getUserProfile(req.user.id);

    const recent = await pool.query(
      `SELECT role, content
       FROM messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 16`,
      [req.user.id]
    );

    const reply = await callLLM([
      { role: "system", content: buildSystemPrompt(req.user, profile) },
      ...recent.rows.reverse()
    ]);

    await pool.query(
      "INSERT INTO messages (user_id, role, content) VALUES ($1, $2, $3)",
      [req.user.id, "assistant", reply]
    );

    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "GlowCoach had trouble responding." });
  }
});

app.get("/api/memories", authRequired, async (req, res) => {
  res.json(await getUserProfile(req.user.id));
});

app.delete("/api/account", authRequired, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Account deletion failed." });
  }
});

initDb()
  .then(() => app.listen(PORT, () => console.log(`GlowCoach backend running on port ${PORT}`)))
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
