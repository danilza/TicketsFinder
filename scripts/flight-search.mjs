const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TRAVELPAYOUTS_TOKEN",
  "TRAVELPAYOUTS_MARKER",
  "TELEGRAM_BOT_TOKEN"
];

const missing = requiredEnv.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Flight search worker bootstrap OK.");
console.log("Next step: load active search profiles from Supabase and query Travelpayouts.");
