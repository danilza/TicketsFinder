import { NextResponse } from "next/server";
import { runFlightSearch } from "../../../lib/search-runner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const selectedProfileId = String(form.get("selected_profile_id") || "");
    const result = await runFlightSearch({ force: true });
    const url = new URL("/", request.url);
    url.searchParams.set("notice", "checked");
    url.searchParams.set("profiles", String(result.checkedProfiles));
    url.searchParams.set("offers", String(result.offersSaved));
    url.searchParams.set("alerts", String(result.alertsSent));
    if (selectedProfileId) {
      url.searchParams.set("profile", selectedProfileId);
    }
    url.hash = result.offersSaved > 0 ? "offers" : "runs";
    return NextResponse.redirect(url, 303);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
