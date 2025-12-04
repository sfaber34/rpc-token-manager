"use client";

import { useCallback, useEffect, useState } from "react";
import type { NextPage } from "next";
import { signIn, signOut, useSession } from "next-auth/react";
import { SiweMessage } from "siwe";
import { useAccount, useSignMessage } from "wagmi";
import { notification } from "~~/utils/scaffold-eth";

interface ApiKey {
  keyValue: string;
  createdAt: Date | string;
}

const Home: NextPage = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: session, status } = useSession();

  const handleSignIn = useCallback(async () => {
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
  }, [isConnected, address, chain, signMessageAsync]);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/keys/list");
      const result = await response.json();

      if (!result.success) {
        if (response.status === 401) {
          await signOut({ redirect: false });
          setError("Session expired. Please sign in again.");
        } else {
          throw new Error(result.error);
        }
        setLoading(false);
        return;
      }

      setKeys(result.keys);
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching keys:", err);
      setError(err.message || "Failed to fetch keys");
      setLoading(false);
    }
  }, []);

  const createKey = async () => {
    try {
      setIsCreatingKey(true);
      setError(null);
      setNewlyCreatedKey(null);

      const response = await fetch("/api/keys/create", {
        method: "POST",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setNewlyCreatedKey(result.key);
      await fetchKeys();
      setIsCreatingKey(false);
    } catch (err: any) {
      console.error("Error creating key:", err);
      setError(err.message || "Failed to create key");
      setIsCreatingKey(false);
    }
  };

  const confirmDeleteKey = (keyValue: string) => {
    setKeyToDelete(keyValue);
  };

  const deleteKey = async () => {
    if (!keyToDelete) return;

    try {
      setError(null);

      const response = await fetch("/api/keys/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyValue: keyToDelete }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      notification.success("Key deleted successfully");
      setKeyToDelete(null);
      await fetchKeys();
    } catch (err: any) {
      console.error("Error deleting key:", err);
      setError(err.message || "Failed to delete key");
      setKeyToDelete(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Track if wallet was previously connected to distinguish between "not yet connected" and "disconnected"
  const [wasConnected, setWasConnected] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setWasConnected(true);
    }
  }, [isConnected]);

  // Detect wallet address changes and automatically re-authenticate
  useEffect(() => {
    if (session?.user?.address && address && session.user.address.toLowerCase() !== address.toLowerCase()) {
      console.log("Wallet address changed, signing out and re-authenticating...");
      signOut({ redirect: false });
      setKeys([]);
      setNewlyCreatedKey(null);
      // Will trigger auto sign-in below
    }
  }, [address, session]);

  // Auto sign-in when wallet is connected but no session exists
  useEffect(() => {
    const autoSignIn = async () => {
      // Only auto sign-in if:
      // 1. Wallet is connected
      // 2. Not already signed in
      // 3. Not currently signing in
      // 4. Chain is available
      if (isConnected && address && chain && status === "unauthenticated" && !isSigningIn) {
        console.log("Auto-triggering sign in for connected wallet...");
        await handleSignIn();
      }
    };

    autoSignIn();
  }, [isConnected, address, chain, status, isSigningIn, handleSignIn]);

  // Detect wallet disconnect and sign out (only if wallet was previously connected)
  useEffect(() => {
    if (wasConnected && !isConnected && session) {
      console.log("Wallet disconnected, signing out...");
      signOut({ redirect: false });
      setKeys([]);
      setNewlyCreatedKey(null);
    }
  }, [isConnected, session, wasConnected]);

  useEffect(() => {
    if (session && status === "authenticated") {
      fetchKeys();
    }
  }, [session, status, fetchKeys]);

  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5 w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-6 text-center">RPC Key Manager</h1>

        {!isConnected && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            <strong>Connect Wallet:</strong> Please connect your wallet using the button in the header.
          </div>
        )}

        {isConnected && address && (
          <div className="mb-6">
            <p className="text-gray-600">
              Connected: <strong className="font-mono text-sm">{address}</strong>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Session Status: <strong>{status === "authenticated" ? "Signed In ✓" : "Not Signed In"}</strong>
            </p>
          </div>
        )}

        {isConnected && isSigningIn && (
          <div className="mb-6">
            <div className="alert alert-info bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
              <span className="loading loading-spinner"></span>
              <span>Please sign the message in your wallet to continue...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {status === "authenticated" && (
          <div>
            {/* Create new key section */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4">Create New API Key</h2>
              <p className="text-gray-600 mb-4">
                Generate a new RPC key for your applications. Keep it secure and don&apos;t share it publicly!
              </p>
              <button
                onClick={createKey}
                disabled={isCreatingKey}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingKey ? "Creating..." : "Create New Key"}
              </button>
            </div>

            {/* Show newly created key */}
            {newlyCreatedKey && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-green-800 mb-2">✓ New Key Created!</h3>
                <p className="text-sm text-gray-700 mb-3">
                  Your new API key is ready to use. Copy it to your application.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-green-300 px-4 py-2 rounded font-mono text-sm break-all">
                    {newlyCreatedKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* List of existing keys */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">Your API Keys</h2>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <p className="mt-2 text-gray-600">Loading keys...</p>
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No API keys yet. Create your first key above!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {keys.map(key => (
                    <div
                      key={key.keyValue}
                      className="flex items-center justify-between border border-gray-300 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="font-mono text-sm text-gray-800 break-all">{key.keyValue}</code>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(key.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => copyToClipboard(key.keyValue)}
                          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => confirmDeleteKey(key.keyValue)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {keyToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold mb-4">Delete API Key</h3>
              <p className="text-gray-600 mb-2">Are you sure you want to delete this key?</p>
              <code className="block bg-gray-100 px-3 py-2 rounded font-mono text-sm break-all mb-4">
                {keyToDelete}
              </code>
              <p className="text-sm text-red-600 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setKeyToDelete(null)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteKey}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
