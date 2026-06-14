import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdmin } from "../lib/supabase-admin";
import { getTravelpayoutsSearchUrl } from "../lib/travelpayouts";
import type { OfferSnapshot, SearchProfile, SearchRun } from "../lib/types";
import { SearchForm } from "./components/SearchForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function formatOptionalPrice(value: number | null, currency: string) {
  return value === null ? "нет данных" : formatPrice(value, currency);
}

async function loadDashboardData(requestedProfileId: string | null) {
  noStore();

  const supabase = createSupabaseAdmin();
  const profiles = await supabase
    .from("search_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (profiles.error) {
    throw new Error(profiles.error.message);
  }

  const profileRows = (profiles.data || []) as SearchProfile[];
  const selectedProfile =
    profileRows.find((profile) => profile.id === requestedProfileId) ||
    profileRows.find((profile) => profile.active) ||
    profileRows[0] ||
    null;

  let offersQuery = supabase
    .from("offer_snapshots")
    .select("*")
    .order("observed_at", { ascending: false })
    .limit(20);

  let runsQuery = supabase
    .from("search_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);

  if (selectedProfile) {
    offersQuery = offersQuery.eq("search_profile_id", selectedProfile.id);
    runsQuery = runsQuery.eq("search_profile_id", selectedProfile.id);
  }

  const [offers, runs] = await Promise.all([offersQuery, runsQuery]);

  if (offers.error) {
    throw new Error(offers.error.message);
  }

  if (runs.error) {
    throw new Error(runs.error.message);
  }

  return {
    profiles: profileRows,
    offers: (offers.data || []) as OfferSnapshot[],
    runs: (runs.data || []) as SearchRun[],
    selectedProfile
  };
}

function getNotice(searchParams: SearchParams) {
  const notice = getParam(searchParams, "notice");
  const profiles = getParam(searchParams, "profiles");
  const offers = getParam(searchParams, "offers");
  const alerts = getParam(searchParams, "alerts");

  if (notice === "draft") {
    return "Черновик сохранён. Он виден в блоке «Поисковые профили» со статусом paused.";
  }

  if (notice === "started") {
    return `Мониторинг запущен. Проверено профилей: ${profiles || "0"}, сохранено офферов: ${offers || "0"}, отправлено алертов: ${alerts || "0"}.`;
  }

  if (notice === "checked") {
    return `Проверка активных профилей завершена. Проверено профилей: ${profiles || "0"}, сохранено офферов: ${offers || "0"}, отправлено алертов: ${alerts || "0"}.`;
  }

  return null;
}

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getProfileLabel(profileById: Map<string, SearchProfile>, profileId: string) {
  const profile = profileById.get(profileId);
  return profile ? `${profile.origin} -> ${profile.destination}` : profileId.slice(0, 8);
}

export default async function Home({
  searchParams = {}
}: {
  searchParams?: SearchParams;
}) {
  let profiles: SearchProfile[] = [];
  let offers: OfferSnapshot[] = [];
  let runs: SearchRun[] = [];
  let selectedProfile: SearchProfile | null = null;
  let loadError: string | null = null;

  try {
    const data = await loadDashboardData(getParam(searchParams, "profile") || null);
    profiles = data.profiles;
    offers = data.offers;
    runs = data.runs;
    selectedProfile = data.selectedProfile;
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }
  const activeCount = profiles.filter((profile) => profile.active).length;
  const notice = getNotice(searchParams);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MVP</p>
          <h1>Tickets Finder</h1>
          <p className="lead">
            Мониторинг цен через Travelpayouts, история найденных офферов и
            Telegram-пуши, когда цена подходит под правило.
          </p>
        </div>
        <div className="statusPanel">
          <span className="statusValue">
            {activeCount}
          </span>
          <span className="statusLabel">активных поисков</span>
        </div>
      </section>

      {notice ? <section className="noticePanel">{notice}</section> : null}

      {loadError ? (
        <section className="errorPanel">
          <h2>Ошибка подключения</h2>
          <p>{loadError}</p>
          <p>
            Проверь переменные окружения Vercel и что Supabase migration уже
            выполнена.
          </p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Новый поиск</h2>
            <p>Начни вводить город или аэропорт, затем выбери вариант из списка.</p>
          </div>
        </div>

        <SearchForm />
      </section>

      <section className="grid">
        <article id="profiles">
          <div className="articleHeader">
            <h2>Поисковые профили</h2>
            <form action="/api/run-search" method="post">
              {selectedProfile ? (
                <input name="selected_profile_id" type="hidden" value={selectedProfile.id} />
              ) : null}
              <button type="submit">Проверить активные</button>
            </form>
          </div>
          <div className="list">
            {profiles.length === 0 ? (
              <p className="empty">Пока нет сохранённых поисков.</p>
            ) : (
              profiles.map((profile) => (
                <div
                  className={
                    selectedProfile?.id === profile.id
                      ? "listRow selectedRow"
                      : "listRow"
                  }
                  key={profile.id}
                >
                  <div>
                    <a className="profileLink" href={`/?profile=${profile.id}#offers`}>
                      {`${profile.origin} -> ${profile.destination}`}
                    </a>
                    <span>
                      {profile.depart_date}
                      {profile.return_date ? ` - ${profile.return_date}` : ""}
                    </span>
                    <span>
                      Последняя проверка: {formatDate(profile.last_checked_at)}
                    </span>
                    <a className="inlineLink" href={getTravelpayoutsSearchUrl(profile)}>
                      Открыть live-поиск
                    </a>
                  </div>
                  <span className={profile.active ? "ok" : "missing"}>
                    {profile.active ? "active" : "paused"}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article id="offers">
          <div className="articleHeader">
            <div>
              <h2>Последние цены</h2>
              {selectedProfile ? (
                <p className="subhead">
                  {`${selectedProfile.origin} -> ${selectedProfile.destination}`}
                </p>
              ) : null}
            </div>
            <span className="countBadge">{offers.length}</span>
          </div>
          <div className="list">
            {offers.length === 0 ? (
              <p className="empty">После первой проверки здесь появятся офферы.</p>
            ) : (
              offers.map((offer) => (
                <a className="listRow linkRow" href={offer.booking_url || "#"} key={offer.id}>
                  <div>
                    <strong>
                      {`${offer.origin} -> ${offer.destination}`}
                    </strong>
                    <span>
                      Итого: {formatPrice(offer.total_price, offer.currency)} ·{" "}
                      {formatDate(offer.observed_at)}
                    </span>
                    <span>
                      Туда: {formatOptionalPrice(offer.outbound_price, offer.currency)}
                      {offer.return_date
                        ? ` · Обратно: ${formatOptionalPrice(
                            offer.return_price,
                            offer.currency
                          )}`
                        : ""}
                    </span>
                    <span>
                      Пассажиров в цене: {offer.passenger_count}
                    </span>
                    {offer.price_note ? (
                      <span className="mutedNote">{offer.price_note}</span>
                    ) : null}
                  </div>
                  <span className="ok">{offer.provider}</span>
                </a>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="panel" id="runs">
        <div className="articleHeader">
          <h2>Последние проверки</h2>
          <span className="countBadge">{runs.length}</span>
        </div>
        <div className="list">
          {runs.length === 0 ? (
            <p className="empty">Проверок ещё не было.</p>
          ) : (
            runs.map((run) => (
              <div className="listRow" key={run.id}>
                <div>
                  <strong>{getProfileLabel(profileById, run.search_profile_id)}</strong>
                  <span>
                    {run.provider} · {run.status} · {formatDate(run.started_at)}
                  </span>
                  {run.error_message ? (
                    <span className="errorText">{run.error_message}</span>
                  ) : null}
                </div>
                <span className={run.status === "failed" ? "missing" : "ok"}>
                  {run.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Что уже работает</h2>
        <div className="steps">
          <span>Supabase schema</span>
          <span>Travelpayouts Data API</span>
          <span>Telegram alerts</span>
          <span>GitHub Actions worker</span>
        </div>
      </section>
    </main>
  );
}
