"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { SiweMessage } from "siwe";
import { useAccount, useSignMessage } from "wagmi";

export default function FirebaseTest() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const collectionName = process.env.NEXT_PUBLIC_FIREBASE_COLLECTION;

  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: session, status } = useSession();

  const handleSignIn = async () => {
    try {
      if (!isConnected || !address || !chain) {
        setError("Please connect your wallet first");
        return;
      }

      setIsSigningIn(true);
      setError(null);

      // Get nonce from server
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();

      // Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address: address,
        statement: "Sign in with Ethereum to access your RPC keys.",
        uri: window.location.origin,
        version: "1",
        chainId: chain.id,
        nonce: nonce,
      });

      const messageToSign = message.prepareMessage();

      console.log("Requesting signature for SIWE...");
      console.log("Message to sign:", messageToSign);

      // Request user to sign the SIWE message
      const signature = await signMessageAsync({ message: messageToSign });

      console.log("Signature received, authenticating...");

      // Authenticate with NextAuth
      const result = await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      console.log("Successfully signed in!");
      setIsSigningIn(false);
    } catch (err: any) {
      console.error("Error signing in:", err);
      setError(err.message || "Failed to sign in");
      setIsSigningIn(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Fetching data with session...");

      // Fetch data using session (no signature needed)
      const response = await fetch("/api/firebase-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collection: collectionName,
          document: "rpcKeys",
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log("Document data:", result.data);

      setData(result.data);
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching Firebase data:", err);
      setError(err.message || "Failed to fetch data");
      setLoading(false);
    }
  }, [collectionName]);

  useEffect(() => {
    if (session && status === "authenticated") {
      fetchData();
    }
  }, [session, status, fetchData]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My RPC Keys</h1>

      {!isConnected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong>Connect Wallet:</strong> Please connect your wallet using the button in the header.
        </div>
      )}

      {isConnected && address && (
        <div className="mb-6">
          <p className="text-gray-600">
            Connected: <strong>{address}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Session Status: <strong>{status === "authenticated" ? "Signed In ✓" : "Not Signed In"}</strong>
          </p>
        </div>
      )}

      {isConnected && status === "unauthenticated" && (
        <div className="mb-6">
          <button onClick={handleSignIn} disabled={isSigningIn} className="btn btn-primary btn-lg" type="button">
            {isSigningIn ? "Signing In..." : "Sign In with Ethereum"}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            You&apos;ll be asked to sign a message to verify wallet ownership. This only needs to be done once per
            session.
          </p>
        </div>
      )}

      {loading && <div className="text-lg">Loading your API keys...</div>}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <div>
          <p className="mb-4 text-sm text-gray-600">Check the browser console (F12) to see the logged data.</p>

          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-3">Your API Keys:</h2>
            <pre className="bg-white p-4 rounded overflow-auto max-h-96 text-sm">{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
