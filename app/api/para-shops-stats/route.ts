import { NextResponse } from "next/server";
import { getTopParaShopsData, getTopParaShopsForApi } from "@/lib/topParaShops";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = getTopParaShopsData();
  return NextResponse.json({
    shops: getTopParaShopsForApi(),
    meta: {
      clustersUsed: data.clusters_used,
      scrapesUsed: data.scrapes_used ?? null,
      generatedAt: data.generated_at,
      method: data.method,
    },
  });
}
