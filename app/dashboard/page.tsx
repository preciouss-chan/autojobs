"use client";

import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "cancelled" | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");

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
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">AutoJobs Dashboard</h1>
          <p className="text-gray-600 mb-6 text-center">
            Sign in to manage your credits and purchase application packs
          </p>
          <button
            onClick={() => signIn("google")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">AutoJobs</h1>
          <button
            onClick={() => signOut()}
            className="text-gray-600 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Payment Status Alert */}
        {paymentStatus && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              paymentStatus === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-yellow-50 border border-yellow-200"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                paymentStatus === "success"
                  ? "text-green-800"
                  : "text-yellow-800"
              }`}
            >
              {paymentMessage}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Credits Card */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Your Credits</h2>
            <div className="mb-6">
              <p className="text-gray-600 mb-2">Available Applications:</p>
              <p className="text-5xl font-bold text-blue-600">{credits}</p>
              <p className="text-gray-500 text-sm mt-2">1 credit = 1 job application</p>
            </div>
            <button
              onClick={handleBuyCredits}
              disabled={purchasing}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              {purchasing ? "Processing..." : "Buy 100 Credits for $2.49"}
            </button>
            <p className="text-xs text-gray-500 mt-3">
              Uses Stripe test mode. Card: 4242 4242 4242 4242
            </p>
          </div>

          {/* Account Info */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm">Email</p>
                <p className="font-semibold">{session?.user?.email}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Name</p>
                <p className="font-semibold">{session?.user?.name || "N/A"}</p>
              </div>
            </div>
            <Link
              href="/billing"
              className="block mt-6 text-center bg-blue-100 hover:bg-blue-200 text-blue-600 font-semibold py-2 px-4 rounded-lg"
            >
              View Billing History
            </Link>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-bold text-blue-900 mb-2">How AutoJobs Works</h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li>✓ Each application uses 1 credit</li>
            <li>✓ Your resume is automatically tailored for each job</li>
            <li>✓ A cover letter can be generated if needed</li>
            <li>✓ Credits expire 1 year after purchase</li>
            <li>✓ Your free starter credit never expires</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
