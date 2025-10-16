const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const pdf = require('pdf-parse');

// --- CRUCIAL SECURITY STEP ---
// This key will be pulled from the Render/hosting environment variable.
const API_KEY = process.env.CHAT_API_KEY; 
const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

// Use the port provided by the hosting environment (e.g., Render sets this)
const port = process.env.PORT || 3000; 

const app = express();
// Configure multer to store files temporarily in the 'uploads/' directory
const upload = multer({ dest: 'uploads/' }); 

// Middleware setup
app.use(cors());
app.use(express.json());
// Serve static files (like index.html) from the 'public' folder
app.use(express.static('public')); 

// Global chat history to maintain conversation context on the server
// NOTE: For production, this should ideally be replaced with a database (like Firestore) 
// to handle multiple users simultaneously.
let chatHistory = [];

// Endpoint to handle chat messages and file uploads
app.post('/chat', upload.single('file'), async (req, res) => {
    // 1. Pre-flight checks
    if (!API_KEY) {
        return res.status(500).json({ error: 'Server is missing the API key configuration.' });
    }
    const userQuery = req.body.text || "";
    const file = req.file;

    let userParts = [{ text: userQuery }];
    
    // 2. Handle file processing
    if (file) {
        try {
            const dataBuffer = await fs.readFile(file.path);
            const base64Data = dataBuffer.toString('base64');
            const mimeType = file.mimetype;

            userParts.push({
                inlineData: { data: base64Data, mimeType: mimeType }
            });

            // Add prompt instructions for multimodal input
            userParts.push({ text: `Analyze the attached file (MIME type: ${mimeType}) in the context of the user's request.`});
            
            await fs.unlink(file.path); // Clean up the temporary file
        } catch (error) {
            console.error('File processing error:', error);
            await fs.unlink(file.path).catch(() => {});
            return res.status(500).json({ error: 'Failed to process the uploaded file.' });
        }
    }

    // 3. Update chat history and create payload
    chatHistory.push({ role: "user", parts: userParts });

    const systemInstruction = "You are a concise, helpful, and friendly AI. For every response, analyze the text and wrap the most **important keywords or short phrases** in double asterisks, like **this example**, so the user can easily see the key points. Be informative and supportive.";

    const payload = {
        contents: chatHistory,
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    // Set headers for chunked response (streaming)
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
    });

    try {
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok || !apiResponse.body) {
            const errorBody = await apiResponse.text();
            throw new Error(`API error: ${apiResponse.status} - ${errorBody}`);
        }

        // Stream the raw API response body directly to the client
        await new Promise((resolve, reject) => {
            const reader = apiResponse.body.getReader();

            function pump() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        res.end();
                        return resolve();
                    }
                    if (value) {
                        res.write(value);
                    }
                    return pump();
                }).catch(reject);
            }
            pump();
        });


    } catch (error) {
        console.error("API or Streaming Error:", error);
        res.status(500).end(JSON.stringify({ error: "An internal server error occurred." }));
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
