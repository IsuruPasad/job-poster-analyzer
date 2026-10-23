import { NextResponse } from "next/server";
import { getLocationData } from "@/lib/locations/server";

// ikman.lk's district -> town tree for the job form's dropdowns. Served per request (GET
// handlers aren't prerendered) from the server's in-memory cache.
export async function GET() {
  try {
    const data = await getLocationData();
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (err) {
    console.error("[locations] ✖ Couldn't load ikman.lk locations:", err);
    return NextResponse.json(
      { error: "Couldn't load districts and towns from ikman.lk. Please try again." },
      { status: 502 }
    );
  }
}
