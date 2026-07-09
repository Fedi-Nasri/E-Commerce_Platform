import { NextResponse } from "next/server";
import { getRetailShopAvgPrices } from "@/lib/retailShopAvgPrices";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = getRetailShopAvgPrices();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
