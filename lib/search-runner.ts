import { createSupabaseAdmin } from "./supabase-admin";
import { buildAlertMessage, sendTelegramMessage } from "./telegram";
import { searchTravelpayouts } from "./travelpayouts";
import type { NormalizedOffer, SearchProfile, SearchRunResult } from "./types";

function shouldCheck(profile: SearchProfile, force = false) {
  if (force) {
    return true;
  }

  if (!profile.last_checked_at) {
    return true;
  }

  const lastChecked = new Date(profile.last_checked_at).getTime();
  const intervalMs = profile.check_interval_minutes * 60 * 1000;

  return Date.now() - lastChecked >= intervalMs;
}

function shouldAlert(profile: SearchProfile, offer: NormalizedOffer) {
  return !profile.max_price || offer.totalPrice <= profile.max_price;
}

async function loadDueProfiles(force = false) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as SearchProfile[]).filter((profile) =>
    shouldCheck(profile, force)
  );
}

async function saveRunStart(profileId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("search_runs")
    .insert({
      search_profile_id: profileId,
      provider: "travelpayouts",
      status: "partial"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

async function finishRun(runId: string, status: "success" | "failed", error?: string) {
  const supabase = createSupabaseAdmin();
  await supabase
    .from("search_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_message: error || null
    })
    .eq("id", runId);
}

async function saveOffer(profile: SearchProfile, runId: string, offer: NormalizedOffer) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("offer_snapshots")
    .insert({
      search_profile_id: profile.id,
      search_run_id: runId,
      provider: offer.provider,
      offer_fingerprint: offer.providerOfferId,
      origin: offer.origin,
      destination: offer.destination,
      depart_date: offer.departDate,
      return_date: offer.returnDate,
      airline: offer.airline,
      flight_number: offer.flightNumber,
      transfers: offer.transfers,
      duration_minutes: offer.durationMinutes,
      total_price: offer.totalPrice,
      currency: offer.currency,
      booking_url: offer.bookingUrl,
      raw_payload: offer.rawPayload
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

async function createBookingAttempt(
  profile: SearchProfile,
  offerSnapshotId: string,
  offer: NormalizedOffer
) {
  const supabase = createSupabaseAdmin();
  await supabase.from("booking_attempts").insert({
    search_profile_id: profile.id,
    offer_snapshot_id: offerSnapshotId,
    status: "proposed",
    provider: offer.provider,
    provider_offer_id: offer.providerOfferId,
    price_at_attempt: offer.totalPrice,
    currency: offer.currency,
    booking_url: offer.bookingUrl,
    raw_offer_payload: offer.rawPayload
  });
}

async function saveAlert(
  profile: SearchProfile,
  offerSnapshotId: string,
  status: "sent" | "failed" | "skipped",
  message: string,
  error?: string
) {
  const supabase = createSupabaseAdmin();
  await supabase.from("alerts").insert({
    search_profile_id: profile.id,
    offer_snapshot_id: offerSnapshotId,
    channel: "telegram",
    status,
    message,
    error_message: error || null
  });
}

async function markProfileChecked(profileId: string) {
  const supabase = createSupabaseAdmin();
  await supabase
    .from("search_profiles")
    .update({
      last_checked_at: new Date().toISOString()
    })
    .eq("id", profileId);
}

export async function runFlightSearch(
  options: { force?: boolean } = {}
): Promise<SearchRunResult> {
  const result: SearchRunResult = {
    checkedProfiles: 0,
    offersSaved: 0,
    alertsSent: 0,
    errors: []
  };

  const profiles = await loadDueProfiles(Boolean(options.force));

  for (const profile of profiles) {
    result.checkedProfiles += 1;
    const runId = await saveRunStart(profile.id);

    try {
      const offers = await searchTravelpayouts(profile);

      for (const offer of offers) {
        const offerSnapshotId = await saveOffer(profile, runId, offer);
        result.offersSaved += 1;

        if (shouldAlert(profile, offer)) {
          await createBookingAttempt(profile, offerSnapshotId, offer);
          const message = buildAlertMessage(profile, offer);
          const telegram = await sendTelegramMessage(message);

          await saveAlert(
            profile,
            offerSnapshotId,
            telegram.sent ? "sent" : "failed",
            message,
            telegram.error || undefined
          );

          if (telegram.sent) {
            result.alertsSent += 1;
          }

          break;
        }
      }

      await markProfileChecked(profile.id);
      await finishRun(runId, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${profile.id}: ${message}`);
      await finishRun(runId, "failed", message);
    }
  }

  return result;
}
