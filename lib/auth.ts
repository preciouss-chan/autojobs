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
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.AUTH_SECRET || "",
  },
  callbacks: {
    async jwt({ token, user }: any) {
      console.log("🔐 [JWT CALLBACK] token at start:", token);
      console.log("🔐 [JWT CALLBACK] user:", user);
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      console.log("🔐 [JWT CALLBACK] token at end:", token);
      return token;
    },
    async session({ session, token }: any) {
      console.log("🔐 [SESSION CALLBACK] session:", session);
      console.log("🔐 [SESSION CALLBACK] token:", token);
      if (session.user && token) {
        session.user.id = token.id;
      }
      console.log("🔐 [SESSION CALLBACK] returning:", session);
      return session;
    },
    async signIn({ user, account, profile }: any) {
      console.log("🔐 [SIGNIN CALLBACK] user:", user);
      return true;
    },
  },
  pages: {
    // signIn: "/auth/signin",
    error: "/auth/error",
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false, // Set to false for localhost HTTP
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
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

