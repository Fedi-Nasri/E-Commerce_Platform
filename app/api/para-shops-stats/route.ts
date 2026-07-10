import { NextResponse } from "next/server";
import { getTopParaShopsForApiAsync, getTopParaShopsDataForApi } from "@/lib/topParaShops";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getTopParaShopsDataForApi();
  const shops = await getTopParaShopsForApiAsync();
  return NextResponse.json({
    shops,
    meta: {
      clustersUsed: data.clusters_used,
      scrapesUsed: data.scrapes_used ?? null,
      generatedAt: data.generated_at,
      method: data.method,
    },
  });
}
