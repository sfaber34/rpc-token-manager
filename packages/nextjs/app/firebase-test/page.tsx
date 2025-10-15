"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

export default function FirebaseTest() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const collectionName = process.env.NEXT_PUBLIC_FIREBASE_COLLECTION;

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!isConnected || !address) {
          setError("Please connect your wallet to view your API keys");
          setLoading(false);
          return;
        }

        // Create a message to sign (with timestamp to prevent replay attacks)
        const message = `Sign this message to access your RPC keys.\n\nTimestamp: ${Date.now()}`;

        console.log("Requesting signature...");

        // Request user to sign the message
        const signature = await signMessageAsync({ message });

        console.log("Signature received, fetching data...");

        // Send the signature to the API for verification
        const response = await fetch("/api/firebase-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            collection: collectionName,
            document: "rpcKeys",
            address,
            signature,
            message,
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
    };

    if (isConnected && address) {
      fetchData();
    } else {
      setLoading(false);
      setError("Please connect your wallet to view your API keys");
    }
  }, [address, isConnected, collectionName, signMessageAsync]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My RPC Keys</h1>

      {!isConnected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong>Connect Wallet:</strong> Please connect your wallet to view your API keys.
        </div>
      )}

      {isConnected && address && (
        <p className="mb-6 text-gray-600">
          Connected: <strong>{address}</strong>
        </p>
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
