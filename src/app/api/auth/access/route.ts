import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/services/user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) {
      return NextResponse.json({ allowed: false }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ allowed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ allowed: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
