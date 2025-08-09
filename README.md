Short Video Daily Bot

What this does
- Runs the open-source `short-video-maker` service via Docker
- Generates one short video per day via its REST API
- Optionally uploads to S3 for public hosting
- Uploads to YouTube Shorts (OAuth installed app)
- Placeholders included for TikTok/Instagram uploads

Prerequisites
- Windows 10/11 with Docker Desktop
- Node.js 22+
- Pexels API key

Setup
1) Copy `env.sample` to `.env` and fill values
2) Start Docker service
   - `npm run up`
   - Wait until `http://localhost:3123/health` responds with `{ status: 'ok' }`
3) Initialize YouTube OAuth
   - Run: `node scripts/youtube-auth.js` and follow URL, paste code
4) Test one run
   - `node src/index.js --once`

Scheduling
- App supports a CRON via `CRON_SCHEDULE` env (default: daily at 10:00 UTC)
- Alternatively use Windows Task Scheduler and `scripts\schedule_daily_task.ps1`

Notes on TikTok/Instagram
- Official APIs require Business accounts or specific permissions
- Many users automate with headless browsers and session cookies which can break
- Stubs are provided; implement your preferred method




