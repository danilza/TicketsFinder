import type { NormalizedOffer, SearchProfile } from "./types";
import { getRequiredEnv } from "./env";

type TravelpayoutsPrice = {
  value?: number;
  price?: number;
  origin?: string;
  destination?: string;
  depart_date?: string;
  return_date?: string;
  airline?: string;
  flight_number?: string;
  transfers?: number;
  duration?: number;
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
  return [
    "travelpayouts",
    normalizeIata(item.origin || profile.origin),
    normalizeIata(item.destination || profile.destination),
    item.depart_date || profile.depart_date,
    item.return_date || profile.return_date || "",
    item.airline || "",
    item.flight_number || "",
    item.transfers ?? ""
  ].join(":");
}

export async function searchTravelpayouts(profile: SearchProfile) {
  const token = getRequiredEnv("TRAVELPAYOUTS_TOKEN");
  const url = new URL("https://api.travelpayouts.com/v1/prices/cheap");

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

  const payload = (await response.json()) as TravelpayoutsResponse;

  if (payload.success === false) {
    throw new Error(payload.error || "Travelpayouts returned success=false");
  }

  const rows = flattenPrices(payload.data);

  const bookingUrl = getSearchUrl(profile);

  return rows
    .map((item): NormalizedOffer | null => {
      const totalPrice = getPrice(item);

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
        departDate: item.depart_date || profile.depart_date,
        returnDate: item.return_date || profile.return_date,
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
