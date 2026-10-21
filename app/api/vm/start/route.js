import { NextResponse } from "next/server";
import { createVm } from "@/lib/aws";

export const runtime = "nodejs";

export async function POST() {
  try {
    const vm = await createVm();

    if (vm.occupied) {
      return NextResponse.json(
        { occupied: true, instanceId: vm.instanceId },
        { status: 409 }
      );
    }

    return NextResponse.json(vm, { status: 201 });
  } catch (error) {
    console.error("VM START ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to start VM." },
      { status: 500 }
    );
  }
}
