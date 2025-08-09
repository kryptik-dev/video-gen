#!/usr/bin/env node
import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getAuthUrl, saveAuthCode } from '../src/uploader/youtube.js';

async function main() {
  const url = await getAuthUrl();
  // eslint-disable-next-line no-console
  console.log('Open this URL in your browser, grant access:');
  // eslint-disable-next-line no-console
  console.log(url);

  const rl = readline.createInterface({ input, output });
  const code = await rl.question('Paste the code here and press Enter: ');
  rl.close();

  await saveAuthCode(code.trim());
  // eslint-disable-next-line no-console
  console.log('YouTube OAuth token saved.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});




