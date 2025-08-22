
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.post('/chat', async (req, res) => {
    const { message } = req.body;

    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "phi3",
            prompt: message,
            stream: false
        })
    });
    const data = await response.json();
    res.json({ reply: data.response || "Sorry, I couldn't process that." });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    