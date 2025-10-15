import { NextResponse } from "next/server";
import { auth } from "~~/lib/auth";
import { adminDb } from "~~/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    // Verify session
    const session = await auth();

    console.log("[API] Session check:", session);

    if (!session?.user?.address) {
      console.log("[API] No session found or no address in session");
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please sign in with your wallet.",
        },
        { status: 401 },
      );
    }

    const address = session.user.address;

    const body = await request.json();
    const { collection: collectionName, document: documentId } = body;

    if (!collectionName || !documentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: collection and document",
        },
        { status: 400 },
      );
    }

    console.log("[API] Authenticated user:", address);
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
