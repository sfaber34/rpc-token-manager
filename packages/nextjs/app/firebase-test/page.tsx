"use client";

import { useEffect, useState } from "react";

export default function FirebaseTest() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const collectionName = process.env.NEXT_PUBLIC_FIREBASE_COLLECTION;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch specific document: {collection}/rpcKeys
        const response = await fetch(`/api/firebase-data?collection=${collectionName}&document=rpcKeys`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error);
        }

        console.log("Document data:", result.data);

        setData(result.data);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching Firebase data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [collectionName]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Firebase Connection Test</h1>
      <p className="mb-6 text-gray-600">Fetching document: {collectionName}/rpcKeys</p>

      {loading && <div className="text-lg">Loading data from Firebase...</div>}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <div>
          <p className="mb-4 text-lg">
            Document ID: <strong>{data.id}</strong>
          </p>
          <p className="mb-4 text-sm text-gray-600">Check the browser console (F12) to see the logged data.</p>

          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-3">Document Contents:</h2>
            <pre className="bg-white p-4 rounded overflow-auto max-h-96 text-sm">{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
