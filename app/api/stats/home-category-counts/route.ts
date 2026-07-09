import { NextResponse } from "next/server";
import { getHomeCategoryCounts } from "@/lib/homeCategoryCountsServer";

export const revalidate = 600;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const counts = await getHomeCategoryCounts();
    return NextResponse.json(
      { counts, updatedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("[home-category-counts]", err);
    return NextResponse.json({ counts: {}, updatedAt: null }, { status: 503 });
  }
}
