import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth/next";
import { prisma } from "./prisma";

interface AuthUser {
  readonly id?: string;
  readonly email?: string | null;
}

type SessionUserWithId = Session["user"] & {
  id?: string;
};

const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
export const authEnabled = Boolean(
  authSecret &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET &&
    prisma
);

if (!authSecret) {
  console.warn("⚠️ NEXTAUTH_SECRET or AUTH_SECRET must be set. Missing auth secret will cause production login issues.");
}

if (!authEnabled) {
  console.warn("⚠️ Auth is disabled. The app will run in open-source BYO-key mode.");
}

export const authOptions: AuthOptions = {
  ...(authEnabled && prisma ? { adapter: PrismaAdapter(prisma) } : {}),
  secret: authSecret || "opensource-mode-auth-disabled",
  providers: authEnabled
    ? [
        GoogleProvider({
          clientId: process.env.AUTH_GOOGLE_ID || "",
          clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
        }),
      ]
    : [],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: authSecret,
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: AuthUser }): Promise<JWT> {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }): Promise<Session> {
      if (session.user && token) {
        const sessionUser = session.user as SessionUserWithId;
        sessionUser.id = typeof token.id === "string" ? token.id : undefined;
      }
      return session;
    },
    async signIn(): Promise<boolean> {
      return true;
    },
  },
  pages: {
    // signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: authEnabled && prisma ? {
    async signIn({ user }: { user: AuthUser }): Promise<void> {
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
  } : {},
};

// Wrapper function for NextAuth v4
export async function auth(): Promise<Session | null> {
  if (!authEnabled) {
    return null;
  }

  return await getServerSession(authOptions);
}
