import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL("/", env.appUrl), { status: 303 });
}
