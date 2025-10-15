import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { adminDb } from "~~/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { collection: collectionName, document: documentId, address, signature, message } = body;

    if (!collectionName || !documentId || !address || !signature || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: collection, document, address, signature, and message",
        },
        { status: 400 },
      );
    }

    console.log("[API] Verifying signature for address:", address);

    // Verify the signature to ensure the user owns this address
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      console.log("[API] Invalid signature");
      return NextResponse.json(
        {
          success: false,
          error: "Invalid signature. Please sign in with your wallet.",
        },
        { status: 401 },
      );
    }

    console.log("[API] Signature verified. Fetching data for address:", address);
    console.log("[API] Collection:", collectionName, "Document:", documentId);

    // Fetch the document
    const docSnapshot = await adminDb.collection(collectionName).doc(documentId).get();

    if (!docSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: `Document '${documentId}' not found in collection '${collectionName}'`,
        },
        { status: 404 },
      );
    }

    const documentData = docSnapshot.data();

    // Filter to only return data for the authenticated address
    const userKey = documentData?.[address];

    if (userKey === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "No API key found for your address",
        },
        { status: 404 },
      );
    }

    // Return only the user's data
    const filteredData = {
      id: docSnapshot.id,
      [address]: userKey,
    };

    console.log("[API] Returning filtered data for address:", address);

    return NextResponse.json({
      success: true,
      data: filteredData,
    });
  } catch (error: any) {
    console.error("[API] Error fetching Firebase data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
