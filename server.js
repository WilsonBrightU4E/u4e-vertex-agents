const express = require('express');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
app.use(express.json());

// Initialize Vertex AI with the exact project ID
const vertexAi = new VertexAI({ project: 'ardent-particle-382720', location: 'us-central1' });

// 1. The User Interface Route
app.get('/', (req, res) => {
    res.send(`
        <html>
            <body style="font-family: Arial; padding: 40px; background: #f4f4f9;">
                <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <h1 style="color: #333;">Nia: AI Architect</h1>
                    <label style="font-weight: bold;">Topic</label><br>
                    <input type="text" id="topic" value="climate change" style="width: 100%; padding: 10px; margin-top: 5px; margin-bottom: 20px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px;">
                    <button onclick="generate()" style="background: #0d52bf; color: white; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-size: 16px; font-weight: bold;">Generate Lesson</button>
                    
                    <div id="status" style="margin-top: 20px; color: #333; white-space: pre-wrap; font-family: monospace; background: #eee; padding: 15px; border-radius: 5px; display: none; border: 1px solid #ccc;"></div>
                </div>
                <script>
                    async function generate() {
                        const topic = document.getElementById('topic').value;
                        const status = document.getElementById('status');
                        const btn = document.querySelector('button');
                        
                        btn.disabled = true;
                        status.style.display = 'block';
                        status.innerHTML = "⏳ Nia is architecting the lesson... (Takes about 10-15 seconds)";
                        
                        try {
                            const response = await fetch('/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ topic })
                            });
                            const data = await response.json();
                            
                            // Display the exact output or error on the screen
                            status.innerHTML = JSON.stringify(data, null, 2);
                        } catch (e) {
                            status.innerHTML = "❌ Network Error: " + e.message;
                        } finally {
                            btn.disabled = false;
                        }
                    }
                </script>
            </body>
        </html>
    `);
});

// 2. The AI Generation Route
app.post('/generate', async (req, res) => {
    try {
        const { topic } = req.body;
        
        // Setup Gemini 1.5 Pro. The generationConfig forces pure JSON output to prevent crashing.
        const generativeModel = vertexAi.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `You are Nia, the Master Educational Architect for U4Education. 
        Create a 3-snippet (30 second) lesson on "${topic}" for African children. Keep it relatable and clear.
        Constraints: Spoken script MUST be 20-25 words. On-screen text 3-5 words.
        Output ONLY valid JSON matching this exact schema:
        { "lesson_title": "string", "snippets": [ { "id": 1, "spoken_script": "string", "on_screen_text": "string", "visual_prompt": "string" } ] }`;

        const request = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
        const response = await generativeModel.generateContent(request);
        const responseText = response.response.candidates[0].content.parts[0].text;
        
        // Parse and send the successful JSON back to the UI
        res.json({ success: true, ai_blueprint: JSON.parse(responseText) });

    } catch (error) {
        console.error("AI GENERATION ERROR:", error);
        // If it fails, send the EXACT error message to the website screen
        res.status(500).json({ 
            success: false, 
            message: "The AI encountered an error.", 
            exact_error: error.message || error.toString() 
        });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
