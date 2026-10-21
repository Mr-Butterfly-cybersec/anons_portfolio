import { NextResponse } from "next/server";
import { terminateVm } from "@/lib/aws";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const instanceId = body?.instanceId;

    if (!instanceId || !/^i-[a-f0-9]+$/.test(instanceId)) {
      return NextResponse.json({ error: "Invalid instance ID." }, { status: 400 });
    }

    const vm = await terminateVm(instanceId);
    return NextResponse.json(vm);
  } catch (error) {
    console.error("VM TERMINATE ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to terminate VM." },
      { status: 500 }
    );
  }
}
