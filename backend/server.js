const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const SYSTEM_PROMPT = `
You are GlowCoach, a motivational AI life partner and supportive friend.
Your job is to help the user build confidence, discipline, money habits, self-esteem, and momentum.
Be warm, practical, and conversational. Do not shame the user. Ask one thoughtful question at a time.
Do not pretend to be human. If the user mentions self-harm or immediate danger, encourage emergency/professional help.
Keep replies under 180 words unless the user asks for detail.
`;

app.get('/', (req, res) => {
  res.json({ ok: true, app: 'GlowCoach backend running' });
});

app.get(['/chat', '/api/chat'], (req, res) => {
  res.json({
    ok: true,
    message: 'GlowCoach chat route is live. Send a POST request with JSON: { "message": "Hello" }'
  });
});

async function handleChat(req, res) {
  try {
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'Missing OPENAI_API_KEY in Render environment variables.'
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() }
        ],
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI request failed.'
      });
    }

    const reply = data.choices?.[0]?.message?.content || "I'm here for you!";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'GlowCoach had trouble replying.' });
  }
}

app.post('/chat', handleChat);
app.post('/api/chat', handleChat);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
