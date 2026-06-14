import { NextResponse } from "next/server";
import { runFlightSearch } from "../../../lib/search-runner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await runFlightSearch();
    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
