const express = require("express");

const app = express();
const port = 8080;

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

app.post("/generate", (req, res) => {
  const { topic } = req.body;

  res.json({
    success: true,
    message: `Received topic: ${topic || "unknown"}. Connection test succeeded.`
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
