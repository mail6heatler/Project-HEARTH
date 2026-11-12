import { NextResponse } from "next/server";
import { spaceFireFacts } from "@/lib/vesta/facts";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** Mini VESTA's "space fire facts": built from tool results over the NASA data, each with its source. */
export async function GET() {
  return NextResponse.json(await spaceFireFacts());
}
