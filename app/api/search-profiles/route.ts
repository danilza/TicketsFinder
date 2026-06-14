import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

function cleanIata(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function toInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableInteger(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("search_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const origin = cleanIata(form.get("origin"));
  const destination = cleanIata(form.get("destination"));
  const departDate = String(form.get("depart_date") || "");
  const returnDate = String(form.get("return_date") || "") || null;

  if (origin.length !== 3 || destination.length !== 3 || !departDate) {
    return NextResponse.json(
      { error: "Origin, destination and departure date are required" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("search_profiles").insert({
    title: `${origin} -> ${destination}`,
    origin,
    destination,
    depart_date: departDate,
    return_date: returnDate,
    adults: toInteger(form.get("adults"), 1),
    children: toInteger(form.get("children"), 0),
    infants: toInteger(form.get("infants"), 0),
    currency: String(form.get("currency") || "RUB").toUpperCase(),
    max_price: toNullableInteger(form.get("max_price")),
    direct_only: form.get("direct_only") === "on",
    check_interval_minutes: toInteger(form.get("check_interval_minutes"), 60)
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/", request.url), 303);
}
