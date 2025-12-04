import { NextResponse } from "next/server";
import { auth } from "~~/lib/auth";
import { adminDb } from "~~/lib/firebaseAdmin";

export async function DELETE(request: Request) {
  try {
    // Check if user is authenticated
    const session = await auth();
    if (!session?.user?.address) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ethereumAddress = session.user.address;
    const { keyValue } = await request.json();

    if (!keyValue) {
      return NextResponse.json({ success: false, error: "keyValue is required" }, { status: 400 });
    }

    const environment = process.env.NEXT_PUBLIC_FIREBASE_COLLECTION;
    const collectionName = `rpcKeys${environment}`;

    // Get the key document from dynamic collection
    const keyRef = adminDb.collection(collectionName).doc(keyValue);
    const keyDoc = await keyRef.get();

    if (!keyDoc.exists) {
      return NextResponse.json({ success: false, error: "Key not found" }, { status: 404 });
    }

    const keyData = keyDoc.data();

    // Verify the key belongs to this user
    if (keyData?.ethereumAddress !== ethereumAddress) {
      return NextResponse.json({ success: false, error: "Unauthorized to delete this key" }, { status: 403 });
    }

    // Delete the key
    await keyRef.delete();

    return NextResponse.json({
      success: true,
      message: "Key deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting key:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to delete key" }, { status: 500 });
  }
}
