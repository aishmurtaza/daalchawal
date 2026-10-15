import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, lat, lng } = body;

    if (!orderId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing orderId, lat, or lng parameters" },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        riderLat: Number(lat),
        riderLng: Number(lng),
        riderLastUpdated: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Rider location updated successfully",
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Rider location update error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}