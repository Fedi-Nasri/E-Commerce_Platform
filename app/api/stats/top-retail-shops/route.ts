import { NextResponse } from "next/server";
import { getTopRetailShopsForApi } from "@/lib/topRetailShops";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ shops: getTopRetailShopsForApi() });
}
