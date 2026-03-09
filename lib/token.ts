import jwt from "jsonwebtoken";

export interface TokenPayload {
  email: string;
  id: string;
  iat: number;
}

/**
 * Verify JWT token from Authorization header
 */
export function verifyToken(authHeader: string | null): TokenPayload | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.AUTH_SECRET || "fallback_secret"
    );
    return decoded as TokenPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Extract user ID from either JWT token or NextAuth session
 */
export function getUserId(
  authHeader: string | null,
  sessionUserId: string | undefined
): string | null {
  // Try JWT token first (extension)
  const tokenPayload = verifyToken(authHeader);
  if (tokenPayload) {
    return tokenPayload.id;
  }

  // Fall back to NextAuth session
  if (sessionUserId) {
    return sessionUserId;
  }

  return null;
}
