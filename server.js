const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['POST','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '10kb' }));

app.get('/', (req, res) => res.json({ status: 'Rythm AI Proxy running ✓' }));

// Fetch a webpage and return its text content for workout import
app.post('/fetch', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RythmApp/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await response.text();
    // Strip HTML tags and collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000);
    res.json({ text });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch URL', text: '' });
  }
});

app.post('/ai', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: system || 'You are Rythm AI, a helpful fitness and nutrition coach.',
        messages,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(response.status).json({ error: 'Upstream API error' });
    }
    const data = await response.json();
    res.json({ reply: data.content?.[0]?.text || 'No response.' });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy server error' });
  }
});

app.listen(PORT, () => console.log(`Rythm AI Proxy on port ${PORT}`));
