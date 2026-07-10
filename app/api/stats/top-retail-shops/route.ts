import { NextResponse } from "next/server";
import { getTopRetailShopsData, getTopRetailShopsForApi } from "@/lib/topRetailShops";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = getTopRetailShopsData();
  return NextResponse.json({
    shops: getTopRetailShopsForApi(),
    meta: {
      clustersUsed: data.clusters_used,
      scrapesUsed: data.scrapes_used ?? null,
      generatedAt: data.generated_at,
    },
  });
}
