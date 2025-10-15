import { NextResponse } from "next/server";
import { adminDb } from "~~/lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionName =
      searchParams.get("collection") || process.env.NEXT_PUBLIC_FIREBASE_COLLECTION || "production";
    const documentId = searchParams.get("document");

    console.log("[API] Fetching from collection:", collectionName);

    // If documentId is provided, fetch a specific document
    if (documentId) {
      console.log("[API] Fetching document:", documentId);
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

      const documentData = {
        id: docSnapshot.id,
        ...docSnapshot.data(),
      };

      console.log("[API] Document data:", documentData);

      return NextResponse.json({
        success: true,
        data: documentData,
      });
    }

    // Otherwise, fetch all documents in the collection
    const snapshot = await adminDb.collection(collectionName).get();

    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("[API] Total documents found:", documents.length);

    return NextResponse.json({
      success: true,
      count: documents.length,
      data: documents,
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
