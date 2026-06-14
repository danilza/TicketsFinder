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

function getPaidPassengerCount(profile: SearchProfile) {
  return Math.max(1, profile.adults + profile.children);
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
    adults: String(profile.adults),
    children: String(profile.children),
    infants: String(profile.infants)
  });

  if (profile.return_date) {
    params.set("return_date", profile.return_date);
  }

  return `https://www.aviasales.com/search?${params.toString()}`;
}

export function getTravelpayoutsSearchUrl(profile: SearchProfile) {
  return getSearchUrl(profile);
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

async function fetchTravelpayoutsPricesForDate(
  profile: SearchProfile,
  endpoint: string,
  departDate: string
) {
  const token = getRequiredEnv("TRAVELPAYOUTS_TOKEN");
  const url = new URL(endpoint);

  url.searchParams.set("origin", normalizeIata(profile.origin));
  url.searchParams.set("destination", normalizeIata(profile.destination));
  url.searchParams.set("depart_date", departDate);
  url.searchParams.set("currency", profile.currency);
  url.searchParams.set("token", token);

  if (profile.return_date) {
    url.searchParams.set("return_date", profile.return_date);
  }

  if (endpoint.endsWith("/calendar")) {
    url.searchParams.set("calendar_type", "departure_date");
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
  const passengerCount = getPaidPassengerCount(profile);

  return rows
    .map((item): NormalizedOffer | null => {
      const basePrice = getPrice(item);
      const departDate =
        toDateOnly(item.depart_date || item.departure_at) || profile.depart_date;
      const returnDate =
        toDateOnly(item.return_date || item.return_at) || profile.return_date;

      if (!basePrice) {
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
        totalPrice: basePrice * passengerCount,
        outboundPrice: profile.return_date ? null : basePrice * passengerCount,
        returnPrice: null,
        passengerCount,
        priceNote:
          passengerCount > 1
            ? `Travelpayouts Data API returned a base fare; stored price is multiplied by ${passengerCount} paid passengers.`
            : null,
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

function filterExactProfileDate(profile: SearchProfile, offers: NormalizedOffer[]) {
  return offers.filter((offer) => {
    if (offer.departDate !== profile.depart_date) {
      return false;
    }

    if (profile.return_date && offer.returnDate !== profile.return_date) {
      return false;
    }

    return true;
  });
}

async function findCachedOffers(profile: SearchProfile) {
  const departureMonth = profile.depart_date.slice(0, 7);
  const cheapPayload = await fetchTravelpayoutsPricesForDate(
    profile,
    "https://api.travelpayouts.com/v1/prices/cheap",
    profile.depart_date
  );
  const cheapOffers = normalizePayload(profile, cheapPayload);

  if (cheapOffers.length > 0) {
    return cheapOffers;
  }

  const cheapMonthPayload = await fetchTravelpayoutsPricesForDate(
    profile,
    "https://api.travelpayouts.com/v1/prices/cheap",
    departureMonth
  );
  const cheapMonthOffers = filterExactProfileDate(
    profile,
    normalizePayload(profile, cheapMonthPayload)
  );

  if (cheapMonthOffers.length > 0) {
    return uniqueOffers(cheapMonthOffers);
  }

  const calendarPayload = await fetchTravelpayoutsPricesForDate(
    profile,
    "https://api.travelpayouts.com/v1/prices/calendar",
    departureMonth
  );

  return uniqueOffers(filterExactProfileDate(profile, normalizePayload(profile, calendarPayload)));
}

function getOneWayProfile(
  profile: SearchProfile,
  direction: "outbound" | "return"
): SearchProfile {
  if (direction === "outbound") {
    return {
      ...profile,
      return_date: null
    };
  }

  return {
    ...profile,
    origin: profile.destination,
    destination: profile.origin,
    depart_date: profile.return_date || profile.depart_date,
    return_date: null
  };
}

function combineRoundTrip(profile: SearchProfile, outbound: NormalizedOffer, inbound: NormalizedOffer) {
  const outboundPrice = outbound.totalPrice;
  const returnPrice = inbound.totalPrice;

  return {
    ...outbound,
    providerOfferId: [
      "travelpayouts-roundtrip",
      outbound.providerOfferId,
      inbound.providerOfferId
    ].join(":"),
    origin: profile.origin,
    destination: profile.destination,
    departDate: profile.depart_date,
    returnDate: profile.return_date,
    airline:
      outbound.airline && inbound.airline && outbound.airline !== inbound.airline
        ? `${outbound.airline}/${inbound.airline}`
        : outbound.airline || inbound.airline,
    flightNumber:
      outbound.flightNumber && inbound.flightNumber
        ? `${outbound.flightNumber}/${inbound.flightNumber}`
        : outbound.flightNumber || inbound.flightNumber,
    transfers:
      outbound.transfers === null && inbound.transfers === null
        ? null
        : (outbound.transfers || 0) + (inbound.transfers || 0),
    durationMinutes:
      outbound.durationMinutes === null && inbound.durationMinutes === null
        ? null
        : (outbound.durationMinutes || 0) + (inbound.durationMinutes || 0),
    totalPrice: outboundPrice + returnPrice,
    outboundPrice,
    returnPrice,
    passengerCount: getPaidPassengerCount(profile),
    priceNote:
      "Round-trip breakdown is composed from cached one-way Travelpayouts fares. It may differ from a live round-trip fare.",
    bookingUrl: getSearchUrl(profile),
    rawPayload: {
      outbound: outbound.rawPayload,
      return: inbound.rawPayload
    }
  } satisfies NormalizedOffer;
}

export async function searchTravelpayouts(profile: SearchProfile) {
  if (!profile.return_date) {
    return findCachedOffers(profile);
  }

  const outboundOffers = await findCachedOffers(getOneWayProfile(profile, "outbound"));
  const returnOffers = await findCachedOffers(getOneWayProfile(profile, "return"));

  if (outboundOffers.length > 0 && returnOffers.length > 0) {
    return [
      combineRoundTrip(
        profile,
        outboundOffers[0],
        returnOffers[0]
      )
    ];
  }

  const fallbackRoundTripOffers = await findCachedOffers(profile);

  return fallbackRoundTripOffers.map((offer) => ({
    ...offer,
    outboundPrice: null,
    returnPrice: null,
    passengerCount: getPaidPassengerCount(profile),
    priceNote:
      "Travelpayouts returned a cached round-trip fare without leg-by-leg price breakdown."
  }));
}
