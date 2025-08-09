import 'dotenv/config';
import cron from 'node-cron';
import fs from 'fs-extra';
import axios from 'axios';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVideo } from './generator.js';
import { uploadToS3 } from './uploader/s3.js';
import { uploadToYouTube } from './uploader/youtube.js';
import { uploadToTikTok } from './uploader/tiktok.js';
import { uploadToInstagram } from './uploader/instagram.js';
import { uploadViaUploadPost } from './uploader/uploadpost.js';
import { generateDailyPlan } from './content/gemini.js';
import { uploadToGitHub } from './uploader/github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(message, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`[${ts}] ${message}`, data);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[${ts}] ${message}`);
  }
}

async function waitForShortVideoMaker() {
  const healthUrl = 'http://localhost:3123/health';
  const startTime = Date.now();
  const timeoutMs = 60_000;
  log('Checking short-video-maker health at http://localhost:3123/health ...');
  while (Date.now() - startTime < timeoutMs) {
    try {
      const { data } = await axios.get(healthUrl, { timeout: 3000 });
      if (data?.status === 'ok') return true;
    } catch (_) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('short-video-maker is not reachable on http://localhost:3123. Start it with: npm run up');
}

function buildConfig({ musicTag, voice }) {
  const paddingBack = Number(process.env.VIDEO_PADDING_BACK_MS || 1500);
  return {
    paddingBack,
    music: musicTag || process.env.VIDEO_MUSIC_TAG || 'chill',
    voice: voice || process.env.VIDEO_VOICE || 'af_heart',
    captionPosition: 'bottom',
    musicVolume: 'high',
    orientation: 'portrait'
  };
}

async function runOnce() {
  await waitForShortVideoMaker();
  log('short-video-maker is healthy.');

  const outDir = path.resolve(__dirname, '../output');
  await fs.ensureDir(outDir);

  log('Generating content plan with Gemini ...');
  const plan = await generateDailyPlan();
  log('Plan generated', {
    title: plan.title,
    tags: plan.tags,
    scenes: plan.scenes?.length,
    musicTag: plan.musicTag,
    voice: plan.voice
  });
  const scenes = plan.scenes;
  const config = buildConfig({ musicTag: plan.musicTag, voice: plan.voice });

  log('Requesting render from short-video-maker ...');
  const { id: videoId, filePath } = await generateVideoWithProgress({ scenes, config, outDir });
  log('Video ready and downloaded', { videoId, filePath });

  let publicUrl = null;
  if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    const key = `shorts/${path.basename(filePath)}`;
    log('Uploading video to S3 ...');
    publicUrl = await uploadToS3({ filePath, key });
    log('S3 upload complete', { publicUrl: publicUrl || '(not public)' });
  } else {
    log('S3 not configured; skipping S3 upload');
  }

  const title = plan.title;
  const description = plan.description;
  const tags = plan.tags;

  let uploadedOk = false;
  try {
    if (process.env.UPLOADPOST_API_KEY && process.env.UPLOADPOST_USER) {
      // Use upload-post.com to push to multiple platforms at once
      const platforms = ['youtube', 'tiktok', 'instagram'];
      log('Uploading via upload-post.com aggregator ...', { platforms });
      await uploadViaUploadPost({
        filePath,
        title,
        user: process.env.UPLOADPOST_USER,
        platforms,
        apiKey: process.env.UPLOADPOST_API_KEY,
        endpoint: process.env.UPLOADPOST_ENDPOINT || undefined
      });
      log('Aggregator upload complete');
      uploadedOk = true;
    } else {
      log('Uploading directly to YouTube ...');
      await uploadToYouTube({ filePath, title, description, tags });
      log('YouTube upload complete');
      // Fallback stubs for TikTok/Instagram
      log('Attempting TikTok upload (stub) ...');
      await uploadToTikTok({ filePath, title });
      log('Attempting Instagram upload (stub) ...');
      await uploadToInstagram({ filePath, caption: description });
      uploadedOk = true;
    }
  } catch (err) {
    log('Upload step failed', err?.message || err);
  }

  // Push to GitHub if configured and upload succeeded
  if (uploadedOk && process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
    try {
      const [owner, repo] = process.env.GITHUB_REPO.split('/');
      log('Pushing MP4 to GitHub ...', { owner, repo });
      const result = await uploadToGitHub({ filePath, owner, repo, baseDir: 'finished' });
      log('Pushed to GitHub', result);
    } catch (e) {
      log('Failed to push to GitHub', e?.message || e);
    }
  }

  return { videoId, filePath, publicUrl };
}

async function main() {
  const cronExpr = process.env.CRON_SCHEDULE || '0 10 * * *';
  if (process.argv.includes('--once')) {
    await runOnce();
    return;
  }

  // eslint-disable-next-line no-console
  console.log('Scheduling job with CRON:', cronExpr);
  cron.schedule(cronExpr, async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('Starting daily job…');
      const result = await runOnce();
      // eslint-disable-next-line no-console
      console.log('Completed daily job:', result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Daily job failed:', err?.message || err);
    }
  }, {
    timezone: 'UTC'
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


