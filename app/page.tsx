import { createSupabaseAdmin } from "../lib/supabase-admin";
import type { OfferSnapshot, SearchProfile } from "../lib/types";
import { SearchForm } from "./components/SearchForm";

export const dynamic = "force-dynamic";

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

async function loadDashboardData() {
  const supabase = createSupabaseAdmin();
  const [profiles, offers] = await Promise.all([
    supabase
      .from("search_profiles")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("offer_snapshots")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(20)
  ]);

  if (profiles.error) {
    throw new Error(profiles.error.message);
  }

  if (offers.error) {
    throw new Error(offers.error.message);
  }

  return {
    profiles: (profiles.data || []) as SearchProfile[],
    offers: (offers.data || []) as OfferSnapshot[]
  };
}

export default async function Home() {
  let profiles: SearchProfile[] = [];
  let offers: OfferSnapshot[] = [];
  let loadError: string | null = null;

  try {
    const data = await loadDashboardData();
    profiles = data.profiles;
    offers = data.offers;
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }
  const activeCount = profiles.filter((profile) => profile.active).length;

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
        <article>
          <div className="articleHeader">
            <h2>Поисковые профили</h2>
            <form action="/api/run-search" method="post">
              <button type="submit">Проверить активные</button>
            </form>
          </div>
          <div className="list">
            {profiles.length === 0 ? (
              <p className="empty">Пока нет сохранённых поисков.</p>
            ) : (
              profiles.map((profile) => (
                <div className="listRow" key={profile.id}>
                  <div>
                    <strong>
                      {`${profile.origin} -> ${profile.destination}`}
                    </strong>
                    <span>
                      {profile.depart_date}
                      {profile.return_date ? ` - ${profile.return_date}` : ""}
                    </span>
                  </div>
                  <span className={profile.active ? "ok" : "missing"}>
                    {profile.active ? "active" : "paused"}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article>
          <h2>Последние цены</h2>
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
                      {formatPrice(offer.total_price, offer.currency)} ·{" "}
                      {formatDate(offer.observed_at)}
                    </span>
                  </div>
                  <span className="ok">{offer.provider}</span>
                </a>
              ))
            )}
          </div>
        </article>
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
