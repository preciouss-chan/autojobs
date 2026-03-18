"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function DashboardContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "cancelled" | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");

  /**
   * Sync extension authentication token with dashboard
   * This broadcasts the token to any extension windows listening
   */
  const syncExtensionToken = useCallback(async () => {
    try {
      const response = await fetch("/api/extension/token");
      if (response.ok) {
        const data = await response.json();
        
        // Method 1: Try to send via extension runtime (most reliable)
        try {
          const chromeAPI = (window as any).chrome;
          if (chromeAPI && chromeAPI.runtime) {
            chromeAPI.runtime.sendMessage(
              {
                action: "SYNC_TOKEN_FROM_DASHBOARD",
                token: data.token,
                email: data.email,
              },
              (response: any) => {
                if (chromeAPI.runtime.lastError) {
                  console.log(
                    "ℹ️  Extension not installed or not listening"
                  );
                } else {
                  console.log("✅ Token sent to extension via runtime");
                }
              }
            );
          }
        } catch (err) {
          console.log("ℹ️  Could not send via chrome.runtime");
        }

        // Method 2: Broadcast via postMessage (fallback)
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "EXTENSION_TOKEN_SYNC",
              token: data.token,
              email: data.email,
              name: data.name,
            },
            "*"
          );
        }
        window.postMessage(
          {
            type: "EXTENSION_TOKEN_SYNC",
            token: data.token,
            email: data.email,
            name: data.name,
          },
          "*"
        );
        
        console.log("✅ Extension token synced with dashboard");
      }
    } catch (error) {
      console.error("Failed to sync extension token:", error);
    }
  }, []);

  // Check for payment status from URL
  useEffect(() => {
    const status = searchParams.get("payment");
    if (status === "success") {
      setPaymentStatus("success");
      setPaymentMessage("Payment successful! Your credits have been added.");
      // Refresh credits after successful payment
      setTimeout(() => {
        fetchCredits();
      }, 1000);
      // Clear the URL parameter after 5 seconds
      setTimeout(() => {
        setPaymentStatus(null);
        setPaymentMessage("");
      }, 5000);
    } else if (status === "cancelled") {
      setPaymentStatus("cancelled");
      setPaymentMessage("Payment was cancelled. No charges were made.");
      setTimeout(() => {
        setPaymentStatus(null);
        setPaymentMessage("");
      }, 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchCredits();
      // Sync extension token after login
      syncExtensionToken();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, syncExtensionToken]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.action === "EXTENSION_LOGOUT_REQUEST") {
        console.log("📩 Extension requested logout from dashboard (via postMessage)");
        signOut({ redirect: true, callbackUrl: "/auth/signin" });
      }
    };

    window.addEventListener("message", handleMessage);

    // Also try to listen via chrome.runtime (if available)
    try {
      const chromeAPI = (window as any).chrome;
      if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
        const runtimeListener = (msg: any, sender: any, sendResponse: any) => {
          if (msg.action === "EXTENSION_LOGOUT_REQUEST") {
            console.log("📩 Extension requested logout from dashboard (via runtime)");
            signOut({ redirect: true, callbackUrl: "/auth/signin" });
            sendResponse({ success: true });
          }
        };
        chromeAPI.runtime.onMessage.addListener(runtimeListener);
        return () => {
          window.removeEventListener("message", handleMessage);
          chromeAPI.runtime.onMessage.removeListener(runtimeListener);
        };
      }
    } catch (err) {
      console.log("ℹ️  Chrome runtime API not available");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const fetchCredits = async () => {
    try {
      const res = await fetch("/api/credits/balance");
      if (res.ok) {
        const data = await res.json();
        setCredits(data.balance);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching credits:", error);
      setLoading(false);
    }
  };

  const handleBuyCredits = async () => {
    setPurchasing(true);
    try {
      const res = await fetch("/api/payments/create-session", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          alert("Error: No checkout URL received from server");
        }
      } else {
        const error = await res.json();
        alert(`Failed to create checkout session: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Error creating checkout session. Check console for details.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Notify extension to also log out
      const chromeAPI = (window as any).chrome;
      if (chromeAPI && chromeAPI.runtime) {
        // Use a promise wrapper to ensure message is sent
        await new Promise<void>((resolve) => {
          chromeAPI.runtime.sendMessage(
            {
              action: "LOGOUT_FROM_DASHBOARD",
            },
            (response: any) => {
              if (chromeAPI.runtime.lastError) {
                console.log("ℹ️  Extension not listening for logout message");
              } else {
                console.log("✅ Extension notified of logout");
              }
              resolve();
            }
          );
          // Fallback timeout in case extension doesn't respond
          setTimeout(() => resolve(), 500);
        });
      }
    } catch (err) {
      console.log("ℹ️  Could not notify extension");
    }

    // Sign out from dashboard
    await signOut({ redirect: true, callbackUrl: "/auth/signin" });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-md w-full">
          <h1 className="text-xl font-semibold mb-6 text-center text-gray-800">AutoJobs Dashboard</h1>
          <p className="text-gray-500 text-sm mb-6 text-center">
            Sign in to manage your credits and purchase application packs
          </p>
          <button
            onClick={() => signIn("google")}
            className="w-full bg-gray-700 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg text-sm transition"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold text-gray-800">AutoJobs</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-800 transition"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         {/* Payment Status Alert */}
         {paymentStatus && (
           <div
             className={`mb-6 p-4 rounded-lg text-sm ${
               paymentStatus === "success"
                 ? "bg-green-50 border border-green-200 text-green-700"
                 : "bg-yellow-50 border border-yellow-200 text-yellow-700"
             }`}
           >
             <p
               className={`text-sm font-medium ${
                 paymentStatus === "success"
                   ? "text-green-700"
                   : "text-yellow-700"
               }`}
             >
              {paymentMessage}
            </p>
          </div>
        )}

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Credits Card */}
           <div className="bg-white rounded-lg border border-gray-100 p-6">
             <h2 className="text-lg font-semibold mb-4 text-gray-800">Your Credits</h2>
             <div className="mb-6">
               <p className="text-gray-500 text-sm mb-2">Available Applications:</p>
               <p className="text-4xl font-semibold text-gray-900">{credits}</p>
               <p className="text-gray-500 text-xs mt-2">1 credit = 1 job application</p>
             </div>
             <button
               onClick={handleBuyCredits}
               disabled={purchasing}
               className="w-full bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg text-sm transition"
             >
               {purchasing ? "Processing..." : "Buy 100 Credits for $2.49"}
             </button>
             <p className="text-xs text-gray-500 mt-3">
               Uses Stripe test mode. Card: 4242 4242 4242 4242
             </p>
           </div>

           {/* Account Info */}
           <div className="bg-white rounded-lg border border-gray-100 p-6">
             <h2 className="text-lg font-semibold mb-4 text-gray-800">Account Information</h2>
             <div className="space-y-4">
               <div>
                 <p className="text-gray-500 text-xs uppercase tracking-wide">Email</p>
                 <p className="text-gray-700 text-sm">{session?.user?.email}</p>
               </div>
               <div>
                 <p className="text-gray-500 text-xs uppercase tracking-wide">Name</p>
                 <p className="text-gray-700 text-sm">{session?.user?.name || "N/A"}</p>
               </div>
             </div>
             <Link
               href="/billing"
               className="block mt-6 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm py-2 px-4 rounded-lg transition"
             >
              View Billing History
            </Link>
          </div>
        </div>

         {/* Info Section */}
         <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8">
           <h3 className="text-base font-semibold text-gray-800 mb-3">How AutoJobs Works</h3>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li>• Each application uses 1 credit</li>
              <li>• Your resume is automatically tailored for each job</li>
              <li>• A cover letter can be generated if needed</li>
              <li>• Credits expire 1 year after purchase</li>
              <li>• Your free starter credit never expires</li>
            </ul>
          </div>
       </main>
     </div>
   );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
         <div className="min-h-screen bg-gray-50 flex items-center justify-center">
           <div className="text-center">
             <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-gray-600 mx-auto mb-4"></div>
             <p className="text-gray-500 text-sm">Loading...</p>
           </div>
         </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
