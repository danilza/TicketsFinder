const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TRAVELPAYOUTS_TOKEN",
  "TRAVELPAYOUTS_MARKER",
  "TELEGRAM_BOT_TOKEN"
] as const;

function getEnvStatus() {
  return requiredEnv.map((name) => ({
    name,
    configured: Boolean(process.env[name])
  }));
}

export default function Home() {
  const envStatus = getEnvStatus();
  const configuredCount = envStatus.filter((item) => item.configured).length;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MVP</p>
          <h1>Flight Watch</h1>
          <p className="lead">
            Сервис для мониторинга цен на авиабилеты, истории офферов и пушей,
            когда найден подходящий вариант.
          </p>
        </div>
        <div className="statusPanel">
          <span className="statusValue">
            {configuredCount}/{requiredEnv.length}
          </span>
          <span className="statusLabel">секретов настроено</span>
        </div>
      </section>

      <section className="grid">
        <article>
          <h2>Первый шаг</h2>
          <p>
            Эта версия нужна, чтобы Vercel смог задеплоить проект и проверить
            переменные окружения. Следующий шаг - подключить Supabase-схему и
            Travelpayouts worker.
          </p>
        </article>
        <article>
          <h2>План MVP</h2>
          <p>
            Поисковые профили, история цен, правила алертов, Telegram-пуши и
            booking attempts без автоматической оплаты.
          </p>
        </article>
      </section>

      <section className="envCard" aria-labelledby="env-title">
        <h2 id="env-title">Environment</h2>
        <div className="envList">
          {envStatus.map((item) => (
            <div className="envRow" key={item.name}>
              <code>{item.name}</code>
              <span className={item.configured ? "ok" : "missing"}>
                {item.configured ? "configured" : "missing"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
