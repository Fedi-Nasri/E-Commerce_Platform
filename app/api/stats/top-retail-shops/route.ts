import { NextResponse } from "next/server";
import { getTopRetailShopsDataForApi, getTopRetailShopsForApiAsync } from "@/lib/topRetailShops";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getTopRetailShopsDataForApi();
  const shops = await getTopRetailShopsForApiAsync();
  return NextResponse.json({
    shops,
    meta: {
      clustersUsed: data.clusters_used,
      scrapesUsed: data.scrapes_used ?? null,
      generatedAt: data.generated_at,
    },
  });
}
