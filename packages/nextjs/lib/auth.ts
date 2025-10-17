import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { SiweMessage } from "siwe";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Ethereum",
      credentials: {
        message: {
          label: "Message",
          type: "text",
        },
        signature: {
          label: "Signature",
          type: "text",
        },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.message || !credentials?.signature) {
            return null;
          }

          const siwe = new SiweMessage(JSON.parse(credentials.message as string));

          const result = await siwe.verify({
            signature: credentials.signature as string,
          });

          if (result.success) {
            console.log("[Auth] SIWE verification successful for:", siwe.address);
            return {
              id: siwe.address,
            };
          }
          return null;
        } catch (e) {
          console.error("[Auth] Error verifying SIWE message:", e);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        console.log("[Auth] JWT callback - storing address:", user.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.address = token.sub;
        console.log("[Auth] Session callback - address:", token.sub);
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  debug: true,
  trustHost: true,
});
