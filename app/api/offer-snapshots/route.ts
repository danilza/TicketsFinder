import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("offer_snapshots")
    .select("*")
    .order("observed_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
