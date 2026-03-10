const express = require('express');
const { VertexAI } = require('@google-cloud/vertexai');
const { Firestore } = require('@google-cloud/firestore');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;

const app = express();
app.use(express.json());

// Initialize Google Cloud Services
const PROJECT_ID = 'ardent-particle-382720';
const vertexAi = new VertexAI({ project: PROJECT_ID, location: 'us-central1' });
const firestore = new Firestore({ projectId: PROJECT_ID, databaseId: 'u4e-students' });
const MONGO_URI = String(process.env.MONGO_URI || '').trim();
const ADMIN_EMAILS = ['wilson.bright@u4e.com'];
const PHILIP_EMAIL = String(process.env.PHILIP_EMAIL || 'Philip@u4education.com').trim();
const PHILIP_APP_PASSWORD = String(
    process.env.PHILIP_APP_PASSWORD ||
    process.env.PHILIP_EMAIL_PASS ||
    ''
).trim();
const startupStatus = {
    mongoConnected: false,
    adminRecognized: false,
    checkedAdminEmail: 'wilson.bright@u4e.com',
    startupError: null
};

const getMailTransporter = () => {
    if (!PHILIP_APP_PASSWORD) {
        throw new Error('PHILIP_APP_PASSWORD is missing.');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: PHILIP_EMAIL, pass: PHILIP_APP_PASSWORD },
        tls: { rejectUnauthorized: false }
    });
};

async function connectToMongo() {
    if (!MONGO_URI) {
        throw new Error('MONGO_URI is missing.');
    }

    await mongoose.connect(MONGO_URI);
    startupStatus.mongoConnected = true;
    console.log('SUCCESS: Connected to MongoDB!');
}

function runStartupAdminCheck() {
    const testAdminEmail = 'wilson.bright@u4e.com';
    const isRecognized = ADMIN_EMAILS.includes(testAdminEmail);
    startupStatus.adminRecognized = isRecognized;

    if (isRecognized) {
        console.log('SUCCESS: Admin recognized!');
        return;
    }

    console.log('ERROR: Admin not recognized.');
}

// 1. The Admin UI Route
app.get('/', (req, res) => {
    res.send(`
        <html>
            <body style="font-family: Arial; padding: 40px; background: #f4f4f9;">
                <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <h1 style="color: #333;">🎓 Philip: AI Email Tutor</h1>
                    <p>Philip is currently sleeping to save costs. Click below to wake him up so he can check his inbox, reply to students, and update their files.</p>
                    <button onclick="checkMail()" style="background: #28a745; color: white; padding: 15px 20px; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-size: 18px; font-weight: bold;">📥 Wake Philip to Check Inbox</button>
                    <div id="status" style="margin-top: 20px; color: #333; white-space: pre-wrap; font-family: monospace; background: #eee; padding: 15px; border-radius: 5px; display: none; border: 1px solid #ccc;"></div>
                </div>
                <script>
                    async function checkMail() {
                        const status = document.getElementById('status');
                        const btn = document.querySelector('button');
                        btn.disabled = true;
                        status.style.display = 'block';
                        status.innerHTML = "⏳ Waking Philip up... connecting to Gmail and reading unread messages...";
                        
                        try {
                            const response = await fetch('/check-emails', { method: 'POST' });
                            const data = await response.json();
                            status.innerHTML = JSON.stringify(data, null, 2);
                        } catch (e) {
                            status.innerHTML = "❌ Error: " + e.message;
                        } finally {
                            btn.disabled = false;
                        }
                    }
                </script>
            </body>
        </html>
    `);
});

app.get('/startup-status', (_req, res) => {
    const ok = startupStatus.mongoConnected && startupStatus.adminRecognized && !startupStatus.startupError;
    return res.status(ok ? 200 : 500).json({
        status: ok ? 'Success' : 'Error',
        mongoConnected: startupStatus.mongoConnected,
        adminRecognized: startupStatus.adminRecognized,
        checkedAdminEmail: startupStatus.checkedAdminEmail,
        startupError: startupStatus.startupError
    });
});

app.post('/send-emails', async (req, res) => {
    try {
        const emails = Array.isArray(req.body?.emails)
            ? req.body.emails.map((email) => String(email || '').trim()).filter(Boolean)
            : [];
        const message = String(
            req.body?.message ||
            'Hello Admins,\n\nWelcome to the new Vertex Management Dashboard. I am Philip, your AI assistant.\n\nBest,\nPhilip'
        ).trim();

        if (emails.length === 0) {
            return res.status(400).json({ error: 'No emails provided in the request body' });
        }

        const transporter = getMailTransporter();
        await transporter.sendMail({
            from: `"Philip: AI Email Tutor" <${PHILIP_EMAIL}>`,
            to: PHILIP_EMAIL,
            bcc: emails.join(', '),
            subject: 'Vertex Dashboard Introduction',
            text: message
        });

        console.log(`Successfully sent emails to ${emails.length} admins.`);
        return res.status(200).json({ success: true, message: 'Emails dispatched successfully' });
    } catch (error) {
        console.error('Philip failed to send emails:', error);
        return res.status(500).json({ error: 'Internal server error while sending emails' });
    }
});

// 2. The Core AI & Email Logic Route
app.post('/check-emails', async (req, res) => {
    const config = {
        imap: {
            user: PHILIP_EMAIL,
            password: PHILIP_APP_PASSWORD,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 30000
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // Find all unread emails
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: [''], markSeen: true }; // markSeen marks it as read!
        const messages = await connection.search(searchCriteria, fetchOptions);
        
        let actionsLog = [];

        if (messages.length === 0) {
            connection.end();
            return res.json({ status: "Success", message: "Inbox checked. No new unread emails." });
        }

        // Process each email
        for (let item of messages) {
            const all = item.parts.find(part => part.which === '');
            const id = item.attributes.uid;
            const idHeader = 'Imap-Id: ' + id + '\r\n';
            const mail = await simpleParser(idHeader + all.body);
            
            const studentEmail = mail.from.value[0].address;
            const studentQuestion = mail.text;

            // 1. Check Student Database Memory
            const studentRef = firestore.collection('students').doc(studentEmail);
            const doc = await studentRef.get();
            let memory = "";
            let points = 0;

            if (!doc.exists) {
                await studentRef.set({ interactions: 1, history: [], first_contact: new Date() });
                memory = "This is the student's first time emailing you. Welcome them!";
                points = 1;
            } else {
                const data = doc.data();
                points = data.interactions + 1;
                memory = `You have interacted with this student ${data.interactions} times before.`;
            }

            // 2. Ask Vertex AI to formulate the reply
            const generativeModel = vertexAi.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const prompt = `You are Philip, a friendly, encouraging AI tutor for U4Education in Africa. 
            A student with the email ${studentEmail} just asked you this question: "${studentQuestion}".
            ${memory}
            Write a helpful, simple email reply. End the email by giving them one quick practice question to test their understanding. Keep it under 150 words.`;

            const aiResponse = await generativeModel.generateContent(prompt);
            const replyText = aiResponse.response.candidates[0].content.parts[0].text;

            // 3. Email the reply back to the student
            await getMailTransporter().sendMail({
                from: '"Philip the Tutor" <' + PHILIP_EMAIL + '>',
                to: studentEmail,
                subject: 'Re: Your Question for Philip',
                text: replyText
            });

            // 4. Update Database
            await studentRef.update({
                interactions: points,
                history: Firestore.FieldValue.arrayUnion({ question: studentQuestion, answer: replyText, date: new Date() })
            });

            actionsLog.push(`Replied to ${studentEmail} and awarded +1 interaction point.`);
        }

        connection.end();
        res.json({ status: "Success", processed_count: messages.length, log: actionsLog });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;

async function startServer() {
    try {
        await connectToMongo();
        runStartupAdminCheck();
        app.listen(PORT, () => console.log(`Philip is alive on port ${PORT}`));
    } catch (error) {
        startupStatus.startupError = error && error.message ? error.message : String(error);
        console.error('ERROR: Failed to start Philip service.', error);
        process.exit(1);
    }
}

startServer();
