import { NextResponse } from "next/server";
import { heartbeat } from "@/lib/aws";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const instanceId = body?.instanceId;

    if (!instanceId || !/^i-[a-f0-9]+$/.test(instanceId)) {
      return NextResponse.json(
        { error: "Invalid instance ID." },
        { status: 400 }
      );
    }

    const result = await heartbeat(instanceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("VM HEARTBEAT ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to update heartbeat." },
      { status: 500 }
    );
  }
}
