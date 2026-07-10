import { NextResponse } from "next/server";
import { getTopRetailRankingForApi } from "@/lib/topRetailShops";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getTopRetailRankingForApi());
}
