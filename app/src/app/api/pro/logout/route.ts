import { NextResponse } from "next/server";
import { PRO_COOKIE_NAME } from "@/lib/proAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PRO_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
