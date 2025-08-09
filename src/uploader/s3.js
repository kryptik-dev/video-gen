import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs-extra';
import path from 'node:path';

let s3Client = null;
function getClient() {
  if (s3Client) return s3Client;
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const region = process.env.S3_REGION || 'auto';
  s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    } : undefined
  });
  return s3Client;
}

export async function uploadToS3({ filePath, key }) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET is not set');

  const fileStream = await fs.readFile(filePath);
  const contentType = 'video/mp4';

  await getClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
    ACL: 'public-read'
  }));

  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, '')}/${key}`;
  }
  const endpoint = process.env.S3_ENDPOINT;
  const host = endpoint ? endpoint.replace(/^https?:\/\//, '') : `s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com`;
  return `https://${host}/${bucket}/${key}`;
}




