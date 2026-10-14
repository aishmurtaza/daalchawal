import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to send interactive WhatsApp notification via Meta Cloud API with reply buttons
async function sendWhatsAppKitchenAlert(chefPhone: string, order: { id: string; customerName: string; phone: string; address: string; items: string[]; total: number }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log("WhatsApp credentials missing in .env. Skipping WhatsApp alert.");
    return;
  }

  const orderShortId = order.id.slice(0, 6);

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: chefPhone,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: `🔔 *NEW ORDER ALERT!* (#${orderShortId})\n\n👤 *Customer:* ${order.customerName} (${order.phone})\n📍 *Address:* ${order.address}\n🛒 *Items:* ${order.items.join(", ")}\n💰 *Total:* PKR ${order.total}\n\nTap a button below to accept and start cooking instantly:`
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: `cook_${order.id}`,
                  title: "🍳 Start Cooking"
                }
              },
              {
                type: "reply",
                reply: {
                  id: `cancel_${order.id}`,
                  title: "❌ Cancel"
                }
              }
            ]
          }
        }
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to send interactive WhatsApp kitchen alert:", data);
    } else {
      console.log("Interactive WhatsApp kitchen alert sent successfully:", data);
    }
  } catch (err) {
    console.error("Error dispatching interactive WhatsApp notification:", err);
  }
}

// GET: Fetch tenant data, orders, customers, and chat logs for the dashboard
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const orders = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    const chats = await prisma.chatMessage.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: { customer: true },
    });

    return NextResponse.json({
      success: true,
      tenant,
      orders,
      customers,
      chats,
    });
  } catch (error: any) {
    console.error("Dashboard GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Handle new order checkouts from the storefront
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const body = await req.json();
    const { customerName, phone, address, items, total } = body;

    // 1. Save order with proper tenant and compound-key customer relation connectOrCreate
    const newOrder = await prisma.order.create({
      data: {
        tenant: {
          connect: { id: tenantId },
        },
        customer: {
          connectOrCreate: {
            where: {
              tenantId_phone: {
                tenantId,
                phone,
              },
            },
            create: {
              tenantId,
              phone,
              name: customerName,
              address,
            },
          },
        },
        customerName,
        phone,
        address,
        items,
        total: Number(total),
        status: "NEW",
      },
    });

    // 2. Trigger automated WhatsApp interactive alert to the kitchen staff/chef
    const chefPhone = process.env.KITCHEN_CHEF_PHONE || "923349440201";
    await sendWhatsAppKitchenAlert(chefPhone, newOrder);

    return NextResponse.json({
      success: true,
      message: "Order placed successfully and kitchen notified via WhatsApp",
      orderId: newOrder.id,
      order: newOrder,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Checkout webhook error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update order status (e.g. NEW -> PREPARING -> DELIVERING -> COMPLETED)
export async function PATCH(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const body = await req.json();
    const { orderId, status } = body;

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Order update error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}