import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'node:path';
import { google } from 'googleapis';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: path.resolve(process.cwd(), 'tmp_uploads') });

const TOKEN_PATH = path.resolve(process.cwd(), 'youtube_oauth_token.json');

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4001/oauth2/callback';
  if (!clientId || !clientSecret) throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

app.get('/oauth2/authorize', async (req, res) => {
  try {
    const oAuth2Client = getOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube'
    ];
    const url = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes, prompt: 'consent' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>YouTube OAuth</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b1220;color:#e6e6e6;margin:0}
    .card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:28px;max-width:520px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
    h1{margin:0 0 10px;font-size:22px}
    p{margin:0 0 20px;line-height:1.5;color:#cbd5e1}
    .btn{appearance:none;border:none;border-radius:10px;padding:12px 16px;background:#2563eb;color:white;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:10px}
    .btn:hover{background:#1d4ed8}
    .sub{margin-top:12px;font-size:12px;color:#94a3b8}
  </style>
  </head>
<body>
  <div class="card">
    <h1>Connect your YouTube account</h1>
    <p>Click the button below to open Google sign-in in a new tab and grant upload permissions.</p>
    <a class="btn" href="${url}" target="_blank" rel="noopener noreferrer">Open Google Sign‑In</a>
    <div class="sub">After approving, you can close the new tab. This page does not need to refresh.</div>
  </div>
</body>
</html>`);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/oauth2/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');
    const oAuth2Client = getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    await fs.ensureFile(TOKEN_PATH);
    await fs.writeJson(TOKEN_PATH, tokens, { spaces: 2 });
    res.send('YouTube OAuth successful. You can close this tab.');
  } catch (e) {
    res.status(500).send(e.message);
  }
});

async function getAuthedClient() {
  const oAuth2Client = getOAuth2Client();
  if (!(await fs.pathExists(TOKEN_PATH))) throw new Error('Not authorized. Hit /oauth2/authorize first.');
  const tokens = await fs.readJson(TOKEN_PATH);
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Missing video file' });

    const auth = await getAuthedClient();
    const youtube = google.youtube({ version: 'v3', auth });

    const requestBody = {
      snippet: {
        title: title || 'Untitled Upload',
        description: description || '',
        tags: tags ? (Array.isArray(tags) ? tags : String(tags).split(',').map((s) => s.trim())) : undefined,
        categoryId: '24'
      },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    };

    const media = { body: fs.createReadStream(req.file.path) };
    const response = await youtube.videos.insert({ part: ['snippet', 'status'], requestBody, media });

    // clean temp
    try { await fs.remove(req.file.path); } catch (_) {}

    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = Number(process.env.YOUTUBE_SERVICE_PORT || 4001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`YouTube service listening on http://localhost:${port}`);
});



