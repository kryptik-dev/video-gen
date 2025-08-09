import fs from 'fs-extra';
import path from 'node:path';
import { Octokit } from '@octokit/rest';

function getClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required to push to GitHub');
  return new Octokit({ auth: token });
}

export async function uploadToGitHub({ filePath, owner, repo, baseDir = 'finished' }) {
  const octokit = getClient();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = path.basename(filePath);
  const destPath = `${baseDir}/${dateStr}/${filename}`;

  const content = await fs.readFile(filePath);
  const contentBase64 = content.toString('base64');

  // Ensure repo exists and we can fetch default branch
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch || 'main';

  // Try to see if file exists to get sha
  let sha;
  try {
    const { data: existing } = await octokit.repos.getContent({ owner, repo, path: destPath });
    // If it's a file, grab its sha
    if (!Array.isArray(existing) && existing.type === 'file') {
      sha = existing.sha;
    }
  } catch (_) {
    // ignore 404
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: destPath,
    message: `Add video ${filename} (${dateStr})`,
    content: contentBase64,
    branch: defaultBranch,
    sha
  });

  return { owner, repo, path: destPath, branch: defaultBranch };
}



