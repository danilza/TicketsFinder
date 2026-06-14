import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createSupabaseAdmin();
  const [profiles, offers, runs] = await Promise.all([
    supabase.from("search_profiles").select("id", { count: "exact", head: true }),
    supabase.from("offer_snapshots").select("id", { count: "exact", head: true }),
    supabase.from("search_runs").select("id", { count: "exact", head: true })
  ]);

  return NextResponse.json({
    profiles: profiles.count ?? 0,
    offers: offers.count ?? 0,
    runs: runs.count ?? 0,
    errors: [profiles.error?.message, offers.error?.message, runs.error?.message].filter(
      Boolean
    )
  });
}
