# Tickets Finder

MVP for flight price monitoring, alerting, and future booking attempts.

## Deploy

1. Apply the SQL migration from `supabase/migrations` in the Supabase SQL editor.
2. Push this repository to GitHub.
3. Import it in Vercel.
4. Add these environment variables in Vercel and GitHub Actions:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TRAVELPAYOUTS_TOKEN`
   - `TRAVELPAYOUTS_MARKER`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. Deploy.

`TELEGRAM_CHAT_ID` is required for notifications. Without it, searches still run
and save offers, but Telegram alerts are recorded as failed.

## Supabase

The app uses `SUPABASE_SERVICE_ROLE_KEY` only on the server side. The browser
does not talk to Supabase directly in this MVP.

Tables:

- `search_profiles`
- `search_runs`
- `offer_snapshots`
- `alerts`
- `booking_attempts`

## Local development

```bash
npm install
npm run dev
```

## Worker

GitHub Actions runs the worker every 30 minutes and it can also be triggered
manually from the Actions tab:

```bash
npm run flight:check
```

The same search logic is available from the dashboard through the "Проверить
сейчас" button.
