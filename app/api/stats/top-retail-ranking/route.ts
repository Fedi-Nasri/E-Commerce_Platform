import { NextResponse } from "next/server";
import { getTopRetailRankingForApiAsync } from "@/lib/topRetailShops";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getTopRetailRankingForApiAsync());
}
