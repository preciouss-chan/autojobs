import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("Authorization");
    const userId = getUserId(authHeader, undefined);
    
    console.log("🧪 Debug endpoint:", { userId });
    
    if (!userId) {
      return NextResponse.json({ 
        error: "No userId",
      }, { status: 400 });
    }
    
    // Try findUnique
    const credits1 = await prisma.credits.findUnique({
      where: { userId },
    });
    
    console.log("findUnique result:", credits1);
    
    // Try findMany with filter
    const allCredits = await prisma.credits.findMany({
      where: { userId },
    });
    
    console.log("findMany result:", allCredits);
    
    // Try raw query
    let rawResult: any = null;
    try {
      rawResult = await (prisma as any).$queryRawUnsafe(
        'SELECT * FROM "Credits" WHERE "userId" = $1',
        userId
      );
      console.log("Raw query result:", rawResult);
    } catch (e) {
      console.error("Raw query error:", e);
    }
    
    return NextResponse.json({
      userId,
      findUnique: credits1,
      findMany: allCredits,
      rawQuery: rawResult,
    });
  } catch (error: any) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
