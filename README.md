# Flight Watch

MVP for flight price monitoring, alerting, and future booking attempts.

## Deploy

1. Push this repository to GitHub.
2. Import it in Vercel.
3. Add these environment variables in Vercel and GitHub Actions:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TRAVELPAYOUTS_TOKEN`
   - `TRAVELPAYOUTS_MARKER`
   - `TELEGRAM_BOT_TOKEN`
4. Deploy.

## Local development

```bash
npm install
npm run dev
```

## Worker

The first worker script is only a bootstrap check:

```bash
npm run flight:check
```

The next implementation step is to add Supabase tables, load active search
profiles, call Travelpayouts, store price snapshots, and send Telegram alerts.
