"use client";

import { useEffect } from "react";

export const dynamic = "force-dynamic";

export default function ExtensionAuthPage(): React.ReactElement {
  useEffect(() => {
    // After Google OAuth redirects here, close this window
    // The extension popup will detect login via polling
    const timer = setTimeout(() => {
      window.close();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
