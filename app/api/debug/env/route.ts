import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const envNames = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TRAVELPAYOUTS_TOKEN",
  "TRAVELPAYOUTS_MARKER",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID"
];

export function GET() {
  return NextResponse.json({
    env: envNames.map((name) => ({
      name,
      configured: Boolean(process.env[name])
    }))
  });
}
