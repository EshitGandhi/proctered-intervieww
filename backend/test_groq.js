/**
 * Local manual test for Groq. Run: node test_groq.js (requires GROQ_API_KEY in .env)
 */
require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

groq.chat.completions
  .create({
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    model: 'llama-3.3-70b-versatile',
  })
  .then((r) => console.log(r.choices[0]?.message?.content))
  .catch((e) => console.error('Groq error:', e.message));
