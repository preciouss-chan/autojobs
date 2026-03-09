import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
  ],
  // Use database sessions (default when using an adapter)
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      if (session.user && user) {
        (session.user as any).id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: {
    async signIn({ user }) {
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
});

export { handler as GET, handler as POST };
