"use client";

import React from "react";

interface ProvidersProps {
  readonly children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.ReactElement {
  return <>{children}</>;
}
