const express = require("express");
const { SchemaType, VertexAI } = require("@google-cloud/vertexai");

const app = express();
const port = 8080;

const vertexAI = new VertexAI({
  project: "ardent-particle-382720",
  location: "us-central1"
});

const generativeModel = vertexAI.getGenerativeModel({
  model: "gemini-1.5-pro",
  systemInstruction: {
    role: "system",
    parts: [
      {
        text: "You are Nia, the Master Educational Architect for U4Education. Create warm, culturally grounded mini-lessons for African children. Always follow the requested JSON schema exactly."
      }
    ]
  },
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      required: ["lesson_title", "snippets"],
      properties: {
        lesson_title: {
          type: SchemaType.STRING
        },
        snippets: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            required: ["spoken_script", "visual_prompt"],
            properties: {
              spoken_script: {
                type: SchemaType.STRING
              },
              visual_prompt: {
                type: SchemaType.STRING
              }
            }
          }
        }
      }
    }
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>U4E Vertex Agents</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f4f6fb;
          }
          main {
            width: min(480px, 92vw);
            background: #ffffff;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
          }
          h1 {
            margin-top: 0;
          }
          form {
            display: grid;
            gap: 1rem;
          }
          input,
          button {
            font: inherit;
            padding: 0.8rem 1rem;
          }
          button {
            border: 0;
            border-radius: 8px;
            background: #1d4ed8;
            color: #ffffff;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Generate Agent Request</h1>
          <form method="post" action="/generate">
            <label for="topic">Topic</label>
            <input id="topic" name="topic" type="text" placeholder="Enter a topic" required />
            <button type="submit">Generate</button>
          </form>
        </main>
      </body>
    </html>
  `);
});

function extractResponseText(response) {
  const part = response?.candidates?.[0]?.content?.parts?.find(
    (candidatePart) => typeof candidatePart.text === "string"
  );

  return part?.text || "";
}

app.post("/generate", async (req, res) => {
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";

  if (!topic) {
    return res.status(400).json({
      error: "A topic is required."
    });
  }

  const prompt = [
    "Create a 3-snippet lesson for African children.",
    `Topic: ${topic}.`,
    "Each snippet must represent roughly 30 seconds of teaching.",
    "Return strict JSON only.",
    "Use a short lesson_title.",
    "Return exactly 3 snippets.",
    "For each snippet, provide:",
    '- "spoken_script": exactly 20 words.',
    '- "visual_prompt": a vivid image-generation prompt aligned to the spoken script.'
  ].join(" ");

  try {
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    const responseText = extractResponseText(result.response);

    if (!responseText) {
      return res.status(502).json({
        error: "Vertex AI returned an empty response."
      });
    }

    const lesson = JSON.parse(responseText);
    return res.json(lesson);
  } catch (error) {
    console.error("Vertex AI generation failed:", error);

    return res.status(500).json({
      error: "Failed to generate lesson content."
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
