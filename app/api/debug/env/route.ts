import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const envNames = [
  ["SUPABASE_URL", "URL"],
  ["SUPABASE_ANON_KEY", "ANON_KEY"],
  ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"],
  ["TRAVELPAYOUTS_TOKEN"],
  ["TRAVELPAYOUTS_MARKER"],
  ["TELEGRAM_BOT_TOKEN"],
  ["TELEGRAM_CHAT_ID"]
];

export function GET() {
  return NextResponse.json({
    env: envNames.map((names) => ({
      name: names.join(" or "),
      configured: names.some((name) => Boolean(process.env[name]))
    }))
  });
}
