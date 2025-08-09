import fs from 'fs-extra';
import path from 'node:path';
import process from 'node:process';
import { google } from 'googleapis';

const TOKEN_PATH = path.resolve(process.cwd(), 'youtube_oauth_token.json');

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4001/oauth2/callback';
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthUrl() {
  const oAuth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
  ];
  return oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes, prompt: 'consent' });
}

export async function saveAuthCode(code) {
  const oAuth2Client = getOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  await fs.writeJson(TOKEN_PATH, tokens, { spaces: 2 });
}

async function getAuthedClient() {
  const oAuth2Client = getOAuth2Client();
  const exists = await fs.pathExists(TOKEN_PATH);
  if (!exists) {
    const url = await getAuthUrl();
    throw new Error(`YouTube OAuth not initialized. Open this URL, grant access, then pass the code via init-youtube script:\n${url}`);
  }
  const tokens = await fs.readJson(TOKEN_PATH);
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

export async function uploadToYouTube({ filePath, title, description, tags }) {
  const auth = await getAuthedClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const requestBody = {
    snippet: { title, description, tags, categoryId: '24' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  };

  const media = { body: fs.createReadStream(filePath) };

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody,
    media
  });
  return res.data;
}




