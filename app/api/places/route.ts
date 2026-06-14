import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = String(searchParams.get("term") || "").trim();

  if (term.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const url = new URL("https://autocomplete.travelpayouts.com/places2");
  url.searchParams.set("locale", "ru");
  url.searchParams.set("term", term);
  url.searchParams.append("types[]", "city");
  url.searchParams.append("types[]", "airport");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    next: {
      revalidate: 3600
    }
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Travelpayouts autocomplete returned ${response.status}` },
      { status: 502 }
    );
  }

  const data = await response.json();
  return NextResponse.json({ data });
}
