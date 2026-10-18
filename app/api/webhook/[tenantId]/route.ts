import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ tenantId: string }>;
}

// Helper function to send interactive WhatsApp notification via Meta Cloud API
async function sendWhatsAppKitchenAlert(chefPhone: string, order: { id: string; customerName: string; phone: string; address: string; items: string[]; total: number; lat?: number | null; lng?: number | null }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log("WhatsApp credentials missing in .env. Skipping WhatsApp alert.");
    return;
  }

  const orderShortId = order.id.slice(0, 6);
  const mapLink = order.lat && order.lng 
    ? `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}` 
    : null;

  const addressText = mapLink 
    ? `${order.address}\n🗺️ *Open Map:* ${mapLink}` 
    : order.address;

  try {
    await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
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
            text: `🔔 *NEW ORDER ALERT!* (#${orderShortId})\n\n👤 *Customer:* ${order.customerName} (${order.phone})\n📍 *Address:* ${addressText}\n\n🛒 *Items:* ${order.items.join(", ")}\n💰 *Total:* PKR ${order.total}\n\nTap a button below to accept and start cooking instantly:`
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: `cook_${order.id}`, title: "🍳 Start Cooking" } },
              { type: "reply", reply: { id: `cancel_${order.id}`, title: "❌ Cancel" } }
            ]
          }
        }
      }),
    });
  } catch (err) {
    console.error("Error dispatching interactive WhatsApp notification:", err);
  }
}

// GET: Fetch tenant data, menu items, orders, customers, and chat logs for dashboard & storefront
export async function GET(req: Request, context: RouteContext) {
  try {
    const { tenantId: routeParam } = await context.params;

    // Resolve tenant by ID or Slug
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: routeParam },
          { slug: routeParam }
        ]
      },
      include: {
        menuItems: true,
      }
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    });

    const customers = await prisma.customer.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    });

    const chats = await prisma.chatMessage.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
      include: { customer: true },
    });

    return NextResponse.json({
      success: true,
      tenant,
      menu: tenant.menuItems,
      orders,
      customers,
      chats,
    });
  } catch (error: any) {
    console.error("Dashboard/Storefront GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Handle new order checkouts from the storefront
export async function POST(request: Request, context: RouteContext) {
  try {
    const { tenantId: routeParam } = await context.params;
    const body = await request.json();
    const { customerName, phone, address, items, total, lat, lng } = body;

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: routeParam },
          { slug: routeParam }
        ]
      }
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const customer = await prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId: tenant.id,
          phone: phone,
        },
      },
      update: {
        name: customerName,
        address: address,
      },
      create: {
        tenantId: tenant.id,
        phone: phone,
        name: customerName,
        address: address,
      },
    });

    const newOrder = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        customerName,
        phone,
        address,
        items,
        total,
        lat: lat ?? null,
        lng: lng ?? null,
        status: "NEW",
      },
    });

    const chefPhone = process.env.CHEF_WHATSAPP_PHONE || "923349440201"; 
    await sendWhatsAppKitchenAlert(chefPhone, {
      id: newOrder.id,
      customerName: newOrder.customerName,
      phone: newOrder.phone,
      address: newOrder.address,
      items: newOrder.items,
      total: newOrder.total,
      lat: newOrder.lat,
      lng: newOrder.lng,
    });

    return NextResponse.json({ success: true, order: newOrder }, { status: 200 });
  } catch (error) {
    console.error("Checkout webhook error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update order status (e.g. NEW -> PREPARING -> DELIVERING -> COMPLETED)
export async function PATCH(req: Request, context: RouteContext) {
  try {
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