import { NextResponse } from "next/server";
import { getShopCatalogDetailForApi } from "@/lib/shopCatalogDetail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const shop = new URL(req.url).searchParams.get("shop")?.trim().toLowerCase();
  if (!shop) {
    return NextResponse.json({ error: "shop is required" }, { status: 400 });
  }

  const detail = await getShopCatalogDetailForApi(shop);
  if (!detail) {
    return NextResponse.json({ error: "shop not found" }, { status: 404 });
  }

  return NextResponse.json(detail, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
