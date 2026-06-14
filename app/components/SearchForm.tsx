"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Place = {
  code?: string;
  name?: string;
  city_name?: string;
  country_name?: string;
  type?: string;
};

type FieldName = "origin" | "destination";

function getPlaceTitle(place: Place) {
  const name = place.name || place.city_name || place.code || "";
  const details = [place.city_name && place.city_name !== name ? place.city_name : null, place.country_name]
    .filter(Boolean)
    .join(", ");

  return details ? `${name} · ${details}` : name;
}

function getPlaceKind(place: Place) {
  return place.type === "airport" ? "аэропорт" : "город";
}

function AutocompleteField({
  label,
  name,
  placeholder
}: {
  label: string;
  name: FieldName;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 2 || selectedCode === query.trim().toUpperCase()) {
      setPlaces([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?term=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { data?: Place[] };
        setPlaces((payload.data || []).filter((place) => place.code).slice(0, 8));
        setOpen(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPlaces([]);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selectedCode]);

  const displayValue = useMemo(() => query, [query]);

  return (
    <label className="autocomplete">
      <span>{label}</span>
      <input
        autoComplete="off"
        value={displayValue}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedCode("");
        }}
        onFocus={() => {
          if (places.length > 0) {
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        required
      />
      <input name={name} type="hidden" value={selectedCode || query.trim().toUpperCase()} />
      {open && places.length > 0 ? (
        <div className="suggestions">
          {places.map((place) => (
            <button
              className="suggestion"
              key={`${place.type}-${place.code}-${place.name}`}
              type="button"
              onMouseDown={() => {
                const code = String(place.code || "").toUpperCase();
                setSelectedCode(code);
                setQuery(`${getPlaceTitle(place)} (${code})`);
                setOpen(false);
              }}
            >
              <span>
                <strong>{getPlaceTitle(place)}</strong>
                <small>{getPlaceKind(place)}</small>
              </span>
              <code>{place.code}</code>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

export function SearchForm() {
  return (
    <form className="searchForm" action="/api/search-profiles" method="post">
      <AutocompleteField label="Откуда" name="origin" placeholder="Москва или MOW" />
      <AutocompleteField label="Куда" name="destination" placeholder="Стамбул или IST" />
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
        <input name="check_interval_minutes" type="number" min={15} defaultValue={60} />
      </label>
      <label className="checkboxLabel">
        <input name="direct_only" type="checkbox" />
        <span>Только прямые</span>
      </label>
      <div className="formActions">
        <button name="intent" type="submit" value="start">
          Запустить мониторинг
        </button>
        <button className="secondaryButton" name="intent" type="submit" value="draft">
          Сохранить черновик
        </button>
      </div>
    </form>
  );
}
