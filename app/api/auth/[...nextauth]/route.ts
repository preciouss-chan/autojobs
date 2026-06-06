import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authEnabled, authOptions } from "@/lib/auth";

const nextAuthHandler = NextAuth(authOptions);

async function disabledAuthResponse(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Authentication is disabled in open-source mode." },
    { status: 404 }
  );
}

export const GET = authEnabled ? nextAuthHandler : disabledAuthResponse;
export const POST = authEnabled ? nextAuthHandler : disabledAuthResponse;
