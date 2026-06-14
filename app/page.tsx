import { createSupabaseAdmin } from "../lib/supabase-admin";
import type { OfferSnapshot, SearchProfile } from "../lib/types";

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
  const { profiles, offers } = await loadDashboardData();

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
            {profiles.length}
          </span>
          <span className="statusLabel">активных поисков</span>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Новый поиск</h2>
            <p>Укажи IATA-коды аэропортов или городов, даты и порог цены.</p>
          </div>
          <form action="/api/run-search" method="post">
            <button type="submit">Проверить сейчас</button>
          </form>
        </div>

        <form className="searchForm" action="/api/search-profiles" method="post">
          <label>
            <span>Откуда</span>
            <input name="origin" placeholder="MOW" maxLength={3} required />
          </label>
          <label>
            <span>Куда</span>
            <input name="destination" placeholder="IST" maxLength={3} required />
          </label>
          <label>
            <span>Туда</span>
            <input name="depart_date" type="date" required />
          </label>
          <label>
            <span>Обратно</span>
            <input name="return_date" type="date" />
          </label>
          <label>
            <span>Взрослые</span>
            <input name="adults" type="number" min={1} defaultValue={1} />
          </label>
          <label>
            <span>Дети</span>
            <input name="children" type="number" min={0} defaultValue={0} />
          </label>
          <label>
            <span>Младенцы</span>
            <input name="infants" type="number" min={0} defaultValue={0} />
          </label>
          <label>
            <span>Валюта</span>
            <input name="currency" defaultValue="RUB" maxLength={3} />
          </label>
          <label>
            <span>Порог цены</span>
            <input name="max_price" type="number" min={1} placeholder="45000" />
          </label>
          <label>
            <span>Интервал, мин</span>
            <input
              name="check_interval_minutes"
              type="number"
              min={15}
              defaultValue={60}
            />
          </label>
          <label className="checkboxLabel">
            <input name="direct_only" type="checkbox" />
            <span>Только прямые</span>
          </label>
          <button type="submit">Сохранить поиск</button>
        </form>
      </section>

      <section className="grid">
        <article>
          <h2>Поисковые профили</h2>
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
