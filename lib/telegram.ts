import { getOptionalEnv, getRequiredEnv } from "./env";
import type { NormalizedOffer, SearchProfile } from "./types";

function formatRoute(profile: SearchProfile) {
  return `${profile.origin} -> ${profile.destination}`;
}

function formatPrice(offer: NormalizedOffer) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: 0
  }).format(offer.totalPrice);
}

export function buildAlertMessage(profile: SearchProfile, offer: NormalizedOffer) {
  const returnDate = offer.returnDate ? `\nОбратно: ${offer.returnDate}` : "";
  const airline = offer.airline ? `\nАвиакомпания: ${offer.airline}` : "";
  const transfers =
    offer.transfers === null ? "" : `\nПересадки: ${offer.transfers}`;

  return [
    `Найдена цена: ${formatPrice(offer)}`,
    `Маршрут: ${formatRoute(profile)}`,
    `Туда: ${offer.departDate}${returnDate}`,
    `Пассажиры: ${profile.adults + profile.children + profile.infants}`,
    `${airline}${transfers}`,
    "",
    offer.bookingUrl
  ].join("\n");
}

export async function sendTelegramMessage(text: string) {
  const chatId = getOptionalEnv("TELEGRAM_CHAT_ID");

  if (!chatId) {
    return {
      sent: false,
      error: "TELEGRAM_CHAT_ID is not configured"
    };
  }

  const token = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false
    })
  });

  if (!response.ok) {
    return {
      sent: false,
      error: `Telegram returned ${response.status}`
    };
  }

  return {
    sent: true,
    error: null
  };
}
