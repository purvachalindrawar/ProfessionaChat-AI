export default async function handler(req, res) {
  const apiKey = process.env.API_KEY; // This stays secret on Vercel

  const body = await req.json(); // read your request data from the HTML page
  const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

  // call Google Generative Language API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  const json = await response.json();
  res.status(200).json(json);
}
