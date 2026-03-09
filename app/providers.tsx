"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";

interface ProvidersProps {
  readonly children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.ReactElement {
  return <SessionProvider>{children}</SessionProvider>;
}
