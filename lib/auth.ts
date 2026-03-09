import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth/next";
import { prisma } from "./prisma";

console.log("🔐 NextAuth v4 initializing...");
console.log("  AUTH_GOOGLE_ID:", process.env.AUTH_GOOGLE_ID ? "SET" : "MISSING");
console.log("  AUTH_GOOGLE_SECRET:", process.env.AUTH_GOOGLE_SECRET ? "SET" : "MISSING");
console.log("  prisma object:", typeof prisma, prisma ? "exists" : "null");

if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.error("❌ Missing Google OAuth credentials!");
}

if (!prisma) {
  throw new Error("Prisma client not initialized!");
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
  ],
  session: {
    strategy: "database" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }: any) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: {
    async signIn({ user }: any) {
      // Create initial credits for new users (1 free app)
      if (user && user.id && user.email) {
        const userId = user.id;
        const existingCredits = await prisma.credits.findUnique({
          where: { userId },
        });

        if (!existingCredits) {
          // Create credits record with 1 free app
          await prisma.credits.create({
            data: {
              userId,
              balance: 1,
              totalPurchased: 0,
            },
          });

          // Record the free grant transaction
          await prisma.transaction.create({
            data: {
              userId,
              type: "grant",
              amount: 1,
              reason: "free_trial",
            },
          });
        }
      }
    },
  },
} as any;

// Wrapper function for NextAuth v4 - cast to any to avoid type issues
export async function auth(): Promise<any> {
  return await getServerSession(authOptions as any);
}

