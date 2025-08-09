import axios from 'axios';
import fs from 'fs-extra';
import path from 'node:path';

export async function generateVideo({ scenes, config, outDir }) {
  const baseUrl = 'http://localhost:3123';

  const { data: createResp } = await axios.post(
    `${baseUrl}/api/short-video`,
    { scenes, config },
    { timeout: 60_000 }
  );

  const videoId = createResp.videoId;
  if (!videoId) throw new Error('No videoId returned');

  // poll status
  let status = 'processing';
  const start = Date.now();
  while (status !== 'ready') {
    if (Date.now() - start > 30 * 60_000) {
      throw new Error('Video generation timed out');
    }
    await new Promise((r) => setTimeout(r, 5000));
    const { data: statusResp } = await axios.get(`${baseUrl}/api/short-video/${videoId}/status`, { timeout: 30_000 });
    status = statusResp.status;
  }

  // download the video
  const { data: stream } = await axios.get(`${baseUrl}/api/short-video/${videoId}`, {
    responseType: 'arraybuffer',
    timeout: 120_000
  });
  const filePath = path.join(outDir, `${videoId}.mp4`);
  await fs.writeFile(filePath, stream);

  return { id: videoId, filePath };
}

export async function generateVideoWithProgress({ scenes, config, outDir }) {
  const baseUrl = 'http://localhost:3123';

  const start = Date.now();
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Create render job ...`);
  const { data: createResp } = await axios.post(
    `${baseUrl}/api/short-video`,
    { scenes, config },
    { timeout: 60_000 }
  );

  const videoId = createResp.videoId;
  if (!videoId) throw new Error('No videoId returned');
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Job created`, { videoId });

  let status = 'processing';
  while (status !== 'ready') {
    const elapsed = Math.round((Date.now() - start) / 1000);
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] Poll status ... (${elapsed}s elapsed)`);
    await new Promise((r) => setTimeout(r, 5000));
    const { data: statusResp } = await axios.get(`${baseUrl}/api/short-video/${videoId}/status`, { timeout: 30_000 });
    status = statusResp.status;
  }

  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Status ready. Downloading video ...`);
  const { data: stream } = await axios.get(`${baseUrl}/api/short-video/${videoId}`, {
    responseType: 'arraybuffer',
    timeout: 120_000
  });
  const filePath = path.join(outDir, `${videoId}.mp4`);
  await fs.writeFile(filePath, stream);
  const totalElapsed = Math.round((Date.now() - start) / 1000);
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Download complete in ${totalElapsed}s`, { filePath });

  return { id: videoId, filePath };
}




