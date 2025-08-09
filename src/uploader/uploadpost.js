import axios from 'axios';
import fs from 'fs-extra';
import FormData from 'form-data';

const DEFAULT_ENDPOINT = 'https://api.upload-post.com/api/upload';

export async function uploadViaUploadPost({ filePath, title, user, platforms, apiKey, endpoint = DEFAULT_ENDPOINT }) {
  if (!apiKey) throw new Error('UPLOADPOST_API_KEY is required');
  if (!user) throw new Error('UPLOADPOST_USER is required');
  if (!platforms || platforms.length === 0) throw new Error('At least one platform is required');

  const form = new FormData();
  form.append('title', title);
  for (const platform of platforms) {
    form.append('platform[]', platform);
  }
  form.append('video', fs.createReadStream(filePath));
  form.append('user', user);

  const { data } = await axios.post(endpoint, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Apikey ${apiKey}`
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300_000
  });

  return data;
}




