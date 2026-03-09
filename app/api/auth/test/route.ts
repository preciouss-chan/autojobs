import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("🧪 Testing NextAuth configuration...");
    console.log("   Auth options keys:", Object.keys(authOptions));
    console.log("   Providers count:", authOptions.providers?.length);
    
    if (authOptions.providers && authOptions.providers.length > 0) {
      console.log("   First provider:", authOptions.providers[0].name);
    }
    
    return NextResponse.json({
      status: "ok",
      authOptionsKeys: Object.keys(authOptions),
      providersCount: authOptions.providers?.length || 0,
    });
  } catch (error: any) {
    console.error("🚨 NextAuth config error:", error.message);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
