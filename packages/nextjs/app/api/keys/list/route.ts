import { NextResponse } from "next/server";
import { auth } from "~~/lib/auth";
import { adminDb } from "~~/lib/firebaseAdmin";

export async function GET() {
  try {
    // Check if user is authenticated
    const session = await auth();
    if (!session?.user?.address) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ethereumAddress = session.user.address;
    const environment = process.env.NEXT_PUBLIC_FIREBASE_COLLECTION;
    const collectionName = `rpcKeys${environment}`;

    // Get all keys for this user from dynamic collection
    const keysSnapshot = await adminDb.collection(collectionName).where("ethereumAddress", "==", ethereumAddress).get();

    const keys = keysSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        keyValue: data.keyValue,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        telegram: data.telegram,
      };
    });

    // Sort by createdAt descending (newest first)
    keys.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      keys,
    });
  } catch (error: any) {
    console.error("Error listing keys:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to list keys" }, { status: 500 });
  }
}
