require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database("glowcoach.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  memory TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 80 }));

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

function getUserProfile(userId) {
  const memories = db.prepare(
    "SELECT category, memory FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT 30"
  ).all(userId);

  const goals = db.prepare(
    "SELECT goal, status FROM goals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"
  ).all(userId);

  return { memories, goals };
}

function extractMemories(userId, message) {
  const text = message.trim();
  const lower = text.toLowerCase();

  const patterns = [
    { category: "identity", signals: ["my name is", "i am", "i'm"] },
    { category: "likes", signals: ["i like", "i love", "i enjoy", "favorite"] },
    { category: "dislikes", signals: ["i hate", "i don't like", "i dislike"] },
    { category: "goals", signals: ["my goal", "i want to", "i'm trying to", "i am trying to", "i need to", "i want", "i plan to"] },
    { category: "struggles", signals: ["i struggle", "i have trouble", "it's hard for me", "i can't seem to"] },
    { category: "values", signals: ["i care about", "important to me", "i value"] },
    { category: "money", signals: ["money", "debt", "income", "business", "job", "career", "client"] },
    { category: "health", signals: ["health", "weight", "workout", "sleep", "food", "diet"] }
  ];

  const matched = patterns.find(p => p.signals.some(s => lower.includes(s)));
  if (!matched || text.length < 8) return;

  const memory = text.length > 350 ? text.slice(0, 350) + "..." : text;

  const exists = db.prepare(
    "SELECT id FROM memories WHERE user_id = ? AND memory = ?"
  ).get(userId, memory);

  if (!exists) {
    db.prepare("INSERT INTO memories (user_id, category, memory) VALUES (?, ?, ?)")
      .run(userId, matched.category, memory);
  }

  if (matched.category === "goals") {
    const goalExists = db.prepare(
      "SELECT id FROM goals WHERE user_id = ? AND goal = ?"
    ).get(userId, memory);

    if (!goalExists) {
      db.prepare("INSERT INTO goals (user_id, goal) VALUES (?, ?)")
        .run(userId, memory);
    }
  }
}

function buildSystemPrompt(user, profile) {
  const memoryText = profile.memories.length
    ? profile.memories.map(m => `- [${m.category}] ${m.memory}`).join("\n")
    : "- No saved user memories yet.";

  const goalText = profile.goals.length
    ? profile.goals.map(g => `- ${g.goal} (${g.status})`).join("\n")
    : "- No saved goals yet.";

  return `
You are GlowCoach, a motivational AI life partner and supportive friend.

You are talking to: ${user.name}

Known user profile and memories:
${memoryText}

Known user goals:
${goalText}

Your job:
- Learn the user's goals, personality, values, likes, dislikes, struggles, habits, and dreams.
- Use those details to personalize advice.
- Steer the user toward beneficial directions: confidence, discipline, healthier habits, better money choices, career growth, stronger relationships, and consistent action.
- Be warm, funny when appropriate, direct, encouraging, and practical.
- Talk like a supportive friend, not a corporate chatbot.
- Give tiny next steps instead of overwhelming plans.
- Ask one thoughtful question when more context would help.
- Never shame the user.
- Never manipulate the user or force a path.
- Do not claim to be a licensed therapist, doctor, lawyer, or financial advisor.
- If the user mentions self-harm, immediate danger, abuse, or crisis, tell them to contact emergency services or a trusted person immediately.

Memory behavior:
- If the user shares a preference, goal, struggle, recurring habit, or meaningful life detail, acknowledge it naturally.
- Use saved memories quietly. Do not list memories unless asked.
- When giving advice, connect it back to the user's actual goals and values.

Reply style:
- Under 180 words unless the user asks for detail.
- Conversational.
- Motivational.
- Give 1-3 clear action steps.
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
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.8 })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LLM error:", response.status, errorText);
    return "I had trouble connecting to my AI brain. Check the backend API key/model settings.";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I'm here with you. Tell me what you want to work on.";
}

app.get("/", (req, res) => {
  res.json({ ok: true, app: "GlowCoach backend running" });
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
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
    if (existing) return res.status(409).json({ error: "That email already has an account." });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)")
      .run(id, name.trim(), cleanEmail, passwordHash);

    const user = { id, name: name.trim(), email: cleanEmail };
    const token = createToken(user);

    db.prepare("INSERT INTO memories (user_id, category, memory) VALUES (?, ?, ?)")
      .run(id, "identity", `The user's name is ${name.trim()}.`);

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: "Invalid login." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid login." });

    const safeUser = { id: user.id, name: user.name, email: user.email };
    res.json({ token: createToken(safeUser), user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/me", authRequired, (req, res) => {
  res.json({ user: req.user, profile: getUserProfile(req.user.id) });
});

app.get("/api/chat/history", authRequired, (req, res) => {
  const messages = db.prepare(
    "SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 100"
  ).all(req.user.id);
  res.json({ messages });
});

app.post(["/chat", "/api/chat"], authRequired, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const cleanMessage = message.trim();
    db.prepare("INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)")
      .run(req.user.id, "user", cleanMessage);

    extractMemories(req.user.id, cleanMessage);
    const profile = getUserProfile(req.user.id);

    const recentMessages = db.prepare(
      "SELECT role, content FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 14"
    ).all(req.user.id).reverse();

    const reply = await callLLM([
      { role: "system", content: buildSystemPrompt(req.user, profile) },
      ...recentMessages
    ]);

    db.prepare("INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)")
      .run(req.user.id, "assistant", reply);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "GlowCoach had trouble responding." });
  }
});

app.get("/api/memories", authRequired, (req, res) => {
  res.json(getUserProfile(req.user.id));
});

app.listen(PORT, () => {
  console.log(`GlowCoach backend running on port ${PORT}`);
});
