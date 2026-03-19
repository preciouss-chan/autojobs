import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): Promise<React.ReactNode> {
  // Check session server-side (more reliable than middleware)
  const session = await auth();

  // If no session, redirect to signin
  if (!session) {
    redirect("/auth/signin");
  }

  // If we get here, user is authenticated - render dashboard
  return <>{children}</>;
}
