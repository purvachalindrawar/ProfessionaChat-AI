// api/generateContent.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash-preview-05-20';
    // Use API key in query string if that worked locally; otherwise use Authorization header.
    // For simple API key usage:
    const PROVIDER_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    // If your provider expects Authorization Bearer token instead, replace PROVIDER_URL above
    // with the endpoint (without key) and add header:
    // 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`

    const providerResp = await fetch(PROVIDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    // Copy status and content-type
    const text = await providerResp.text();
    res.status(providerResp.status);
    const ct = providerResp.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);

    res.send(text);
  } catch (err) {
    console.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server proxy error', details: err.message });
    } else {
      res.end();
    }
  }
}
