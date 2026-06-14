import type { NormalizedOffer, SearchProfile } from "./types";
import { getRequiredEnv } from "./env";

type TravelpayoutsPrice = {
  value?: number;
  price?: number;
  origin?: string;
  destination?: string;
  depart_date?: string;
  return_date?: string;
  departure_at?: string;
  return_at?: string;
  airline?: string;
  flight_number?: string;
  transfers?: number;
  duration?: number;
  expires_at?: string;
};

type TravelpayoutsResponse = {
  success?: boolean;
  data?: unknown;
  error?: string;
};

function normalizeIata(value: string) {
  return value.trim().toUpperCase();
}

function getPrice(item: TravelpayoutsPrice) {
  return item.value ?? item.price ?? null;
}

function toDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenPrices(value: unknown): TravelpayoutsPrice[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenPrices);
  }

  if (!isRecord(value)) {
    return [];
  }

  if ("price" in value || "value" in value) {
    return [value as TravelpayoutsPrice];
  }

  return Object.values(value).flatMap(flattenPrices);
}

function getSearchUrl(profile: SearchProfile) {
  const marker = getRequiredEnv("TRAVELPAYOUTS_MARKER");
  const params = new URLSearchParams({
    marker,
    origin_iata: profile.origin,
    destination_iata: profile.destination,
    depart_date: profile.depart_date,
    adults: String(profile.adults)
  });

  if (profile.return_date) {
    params.set("return_date", profile.return_date);
  }

  return `https://www.aviasales.com/search?${params.toString()}`;
}

function fingerprint(profile: SearchProfile, item: TravelpayoutsPrice) {
  const departDate = toDateOnly(item.depart_date || item.departure_at) || profile.depart_date;
  const returnDate = toDateOnly(item.return_date || item.return_at) || profile.return_date || "";

  return [
    "travelpayouts",
    normalizeIata(item.origin || profile.origin),
    normalizeIata(item.destination || profile.destination),
    departDate,
    returnDate,
    item.airline || "",
    item.flight_number || "",
    item.transfers ?? ""
  ].join(":");
}

async function fetchTravelpayoutsPrices(profile: SearchProfile, endpoint: string) {
  const token = getRequiredEnv("TRAVELPAYOUTS_TOKEN");
  const url = new URL(endpoint);

  url.searchParams.set("origin", normalizeIata(profile.origin));
  url.searchParams.set("destination", normalizeIata(profile.destination));
  url.searchParams.set("depart_date", profile.depart_date);
  url.searchParams.set("currency", profile.currency);
  url.searchParams.set("token", token);

  if (profile.return_date) {
    url.searchParams.set("return_date", profile.return_date);
  }

  const response = await fetch(url, {
    headers: {
      "X-Access-Token": token
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Travelpayouts request failed with ${response.status}`);
  }

  return (await response.json()) as TravelpayoutsResponse;
}

function normalizePayload(profile: SearchProfile, payload: TravelpayoutsResponse) {
  if (payload.success === false) {
    throw new Error(payload.error || "Travelpayouts returned success=false");
  }

  const rows = flattenPrices(payload.data);
  const bookingUrl = getSearchUrl(profile);

  return rows
    .map((item): NormalizedOffer | null => {
      const totalPrice = getPrice(item);
      const departDate =
        toDateOnly(item.depart_date || item.departure_at) || profile.depart_date;
      const returnDate =
        toDateOnly(item.return_date || item.return_at) || profile.return_date;

      if (!totalPrice) {
        return null;
      }

      if (profile.direct_only && item.transfers && item.transfers > 0) {
        return null;
      }

      return {
        provider: "travelpayouts",
        providerOfferId: fingerprint(profile, item),
        origin: normalizeIata(item.origin || profile.origin),
        destination: normalizeIata(item.destination || profile.destination),
        departDate,
        returnDate,
        airline: item.airline || null,
        flightNumber: item.flight_number || null,
        transfers: item.transfers ?? null,
        durationMinutes: item.duration ?? null,
        totalPrice,
        currency: profile.currency,
        bookingUrl,
        rawPayload: item as Record<string, unknown>
      };
    })
    .filter((item): item is NormalizedOffer => Boolean(item))
    .sort((a, b) => a.totalPrice - b.totalPrice);
}

function uniqueOffers(offers: NormalizedOffer[]) {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    const key = offer.providerOfferId;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function searchTravelpayouts(profile: SearchProfile) {
  const cheapPayload = await fetchTravelpayoutsPrices(
    profile,
    "https://api.travelpayouts.com/v1/prices/cheap"
  );
  const cheapOffers = normalizePayload(profile, cheapPayload);

  if (cheapOffers.length > 0) {
    return cheapOffers;
  }

  const calendarPayload = await fetchTravelpayoutsPrices(
    profile,
    "https://api.travelpayouts.com/v1/prices/calendar"
  );

  return uniqueOffers(normalizePayload(profile, calendarPayload));
}
