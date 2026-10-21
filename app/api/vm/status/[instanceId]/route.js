import { NextResponse } from "next/server";
import { getVm } from "@/lib/aws";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  try {
    const { instanceId } = await params;

    if (!/^i-[a-f0-9]+$/.test(instanceId)) {
      return NextResponse.json({ error: "Invalid instance ID." }, { status: 400 });
    }

    const vm = await getVm(instanceId);
    return NextResponse.json(vm);
  } catch (error) {
    console.error("VM STATUS ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to read VM status." },
      { status: 500 }
    );
  }
}
