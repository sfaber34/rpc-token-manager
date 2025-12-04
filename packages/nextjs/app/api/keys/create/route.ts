import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "~~/lib/auth";
import { admin, adminDb } from "~~/lib/firebaseAdmin";

function generateKey(): string {
  const randomBytes = crypto.randomBytes(8).toString("hex");
  return randomBytes;
}

export async function POST() {
  try {
    // Check if user is authenticated
    const session = await auth();
    if (!session?.user?.address) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ethereumAddress = session.user.address;
    const environment = process.env.NEXT_PUBLIC_FIREBASE_COLLECTION;
    const collectionName = `rpcKeys${environment}`;

    // Generate new key
    const newKey = generateKey();

    // Store key in dynamic collection
    await adminDb.collection(collectionName).doc(newKey).set({
      keyValue: newKey,
      ethereumAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      key: newKey,
    });
  } catch (error: any) {
    console.error("Error creating key:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create key" }, { status: 500 });
  }
}
