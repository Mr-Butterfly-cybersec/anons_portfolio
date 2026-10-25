import { NextResponse } from "next/server";
import {
  authenticateDrawingRequest,
  getRegisteredDrawings,
  addDrawingAtomically
} from "@/lib/drawing-auth";

export const dynamic = "force-dynamic";

/* Validation helper for image magic bytes */
function validateImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 8) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: "png", mime: "image/png" };
  }
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { ext: "gif", mime: "image/gif" };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }

  return null;
}

/**
 * GET /api/drawings
 * Public retrieval of slideshow drawings
 */
export async function GET() {
  const drawings = getRegisteredDrawings();
  return NextResponse.json(
    { success: true, drawings },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}

/**
 * POST /api/drawings
 * High-security protected drawing ingestion
 * - Never logs master passphrase
 * - Mutex-guarded against race attacks
 * - Rate limited with IP lockouts
 */
export async function POST(request) {
  try {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    let title = "";
    let passphrase = "";
    let imageBuffer = null;
    let declaredMime = "image/jpeg";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      title = (formData.get("title") || "").toString();
      passphrase = (formData.get("passphrase") || "").toString();
      const file = formData.get("image");

      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const ab = await file.arrayBuffer();
        imageBuffer = Buffer.from(ab);
        declaredMime = file.type || "image/jpeg";
      }
    } else if (contentType.includes("application/json")) {
      const json = await request.json();
      title = json.title || "";
      passphrase = json.passphrase || "";
      if (json.imageBase64) {
        const cleanBase64 = json.imageBase64.replace(/^data:[^;]+;base64,/, "");
        imageBuffer = Buffer.from(cleanBase64, "base64");
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported content type" },
        { status: 400 }
      );
    }

    // 1. Authenticate with 1024-bit hash (Mutex & Rate-Limit Guarded)
    const authResult = await authenticateDrawingRequest(passphrase, clientIp);
    // Explicitly zero / drop reference to passphrase in memory
    passphrase = "";

    if (!authResult.ok) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    // 2. Auto-generate title if not provided
    const currentDrawings = getRegisteredDrawings();
    const nextNum = currentDrawings.length + 1;
    const formattedNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    const cleanTitle = (title || "").trim() || `Artwork #${formattedNum}`;

    // 3. Validate image presence & size (Max 15MB)
    if (!imageBuffer || imageBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "No image file provided." },
        { status: 400 }
      );
    }
    if (imageBuffer.length > 15 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Image file exceeds 15MB limit." },
        { status: 400 }
      );
    }

    // 4. Validate image magic bytes to prevent masquerading files
    const magic = validateImageMagicBytes(imageBuffer);
    if (!magic) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file format. Only valid JPEG, PNG, WEBP, or GIF images are allowed."
        },
        { status: 400 }
      );
    }

    // 5. Atomic Mutex-guarded persistence
    const newDrawing = await addDrawingAtomically({
      title: cleanTitle,
      imageBuffer,
      ext: magic.ext,
      mimeType: magic.mime || declaredMime
    });

    return NextResponse.json(
      {
        success: true,
        message: "Artwork successfully authenticated and imported.",
        drawing: newDrawing
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Internal server error during drawing ingestion." },
      { status: 500 }
    );
  }
}
