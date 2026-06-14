export type SearchProfile = {
  id: string;
  title: string;
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string | null;
  adults: number;
  children: number;
  infants: number;
  currency: string;
  max_price: number | null;
  direct_only: boolean;
  active: boolean;
  check_interval_minutes: number;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OfferSnapshot = {
  id: string;
  search_profile_id: string;
  search_run_id: string | null;
  provider: string;
  offer_fingerprint: string;
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string | null;
  airline: string | null;
  flight_number: string | null;
  transfers: number | null;
  duration_minutes: number | null;
  total_price: number;
  currency: string;
  booking_url: string | null;
  observed_at: string;
};

export type SearchRun = {
  id: string;
  search_profile_id: string;
  provider: string;
  status: "success" | "failed" | "partial";
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
};

export type NormalizedOffer = {
  provider: "travelpayouts";
  providerOfferId: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  airline: string | null;
  flightNumber: string | null;
  transfers: number | null;
  durationMinutes: number | null;
  totalPrice: number;
  currency: string;
  bookingUrl: string;
  rawPayload: Record<string, unknown>;
};

export type SearchRunResult = {
  checkedProfiles: number;
  offersSaved: number;
  alertsSent: number;
  errors: string[];
};
