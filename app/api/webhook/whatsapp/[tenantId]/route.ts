import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

interface RouteContext {
  params: Promise<{ tenantId: string }>;
}

// Helper: Send text message back to customer on WhatsApp
async function sendWhatsAppTextMessage(recipientPhone: string, messageText: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log("WhatsApp credentials missing in .env. Skipping outbound text reply.");
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "text",
        text: {
          body: messageText,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to send outbound WhatsApp message:", data);
    } else {
      console.log("Outbound WhatsApp message sent successfully:", data);
    }
  } catch (err) {
    console.error("Error dispatching outbound WhatsApp message:", err);
  }
}

// Helper: Send WhatsApp Kitchen Alert with interactive buttons & map link
async function sendWhatsAppKitchenAlert(chefPhone: string, order: { id: string; customerName: string; phone: string; address: string; items: string[]; total: number; lat?: number | null; lng?: number | null }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log("WhatsApp credentials missing in .env. Skipping WhatsApp alert.");
    return;
  }

  const orderShortId = order.id.slice(0, 6);
  const mapLink = order.lat && order.lng ? `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}` : null;
  const addressText = mapLink ? `${order.address}\n🗺️ *Open Map:* ${mapLink}` : order.address;

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
            text: `🔔 *WHATSAPP ORDER ALERT!* (#${orderShortId})\n\n👤 *Customer:* ${order.customerName} (${order.phone})\n📍 *Address:* ${addressText}\n\n🛒 *Items:* ${order.items.join(", ")}\n💰 *Total:* PKR ${order.total}\n\nTap below to start cooking:`
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
    console.error("Error sending WhatsApp kitchen alert:", err);
  }
}

// GET: Meta WhatsApp Cloud API Webhook Verification Challenge
export async function GET(request: Request, context: RouteContext) {
  try {
    await context.params;
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "daalchaawal_secret";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("[WhatsApp Webhook] Verification challenge passed");
      return new Response(challenge || "", { status: 200 });
    }

    return new Response("Forbidden: Invalid verification token", { status: 403 });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("WhatsApp Verification error:", error);
    return new Response("Internal Error", { status: 500 });
  }
}

// POST: Receives incoming Meta WhatsApp messages, interactive button clicks, and handles AI chat & order recording
export async function POST(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await context.params;
    const body = await request.json();

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messageObj = value?.messages?.[0];

    // 1. Handle Chef Interactive Button Taps First
    if (messageObj && messageObj.type === "interactive" && messageObj.interactive?.type === "button_reply") {
      const buttonId = messageObj.interactive.button_reply.id; 
      if (buttonId.startsWith("cook_")) {
        const orderId = buttonId.replace("cook_", "");
        await prisma.order.update({ where: { id: orderId }, data: { status: "PREPARING" } });
      } else if (buttonId.startsWith("cancel_")) {
        const orderId = buttonId.replace("cancel_", "");
        await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
      }
      return NextResponse.json({ success: true, message: "Button action handled successfully" }, { status: 200 });
    }

    // 2. Extract message & customer data for regular incoming text chats
    let phone: string | null = null;
    let customerName: string = "WhatsApp Customer";
    let userText: string | null = null;

    if (messageObj) {
      phone = messageObj.from;
      userText = messageObj.text?.body || messageObj.caption || null;
      const contactObj = value?.contacts?.[0];
      if (contactObj?.profile?.name) {
        customerName = contactObj.profile.name;
      }
    } else if (body.phone && (body.message || body.text)) {
      phone = String(body.phone).trim();
      userText = String(body.message || body.text).trim();
      if (body.customerName || body.name) {
        customerName = String(body.customerName || body.name).trim();
      }
    }

    if (!userText || !phone) {
      return NextResponse.json({ success: true, message: "No readable text message or phone found" });
    }

    // 3. Fetch tenant and available menu context
    let tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] },
      include: { menuItems: { where: { available: true } } },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    // 4. Find or create customer record
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: phone } },
      update: { name: customerName !== "WhatsApp Customer" ? customerName : undefined },
      create: { tenantId: tenant.id, phone: phone, name: customerName },
    });

    // 5. Save incoming customer message to ChatMessage log
    await prisma.chatMessage.create({
      data: { tenantId: tenant.id, customerId: customer.id, role: "user", content: userText },
    });

    const chatHistory = await prisma.chatMessage.findMany({
      where: { tenantId: tenant.id, customerId: customer.id },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    // 6. Build dynamic menu context & JSON-structured prompt for Gemini AI
    const menuSummary = tenant.menuItems
      .map((m: { name: string; price: number; category: string; description: string | null }) => 
        `• ${m.name} - ${tenant.currency} ${m.price} [${m.category}]: ${m.description || "Freshly cooked"}`
      )
      .join("\n");

    const systemPrompt = `You are the friendly AI ordering manager for "${tenant.businessName}". 
Here is the live menu:
${menuSummary}

Conversation History:
${chatHistory.map(h => `${h.role}:${h.content}`).join("\n")}

User's latest message: "${userText}"

Your tasks:
1. Reply naturally in friendly Roman Urdu or English to assist the customer with menu items, prices, or recommendations.
2. Determine if the customer has CONFIRMED an order (i.e., they selected items and provided a delivery address).
3. Output your response strictly in valid JSON format with this exact structure:
{
  "replyMessage": "Your chat reply to the customer here",
  "isOrderConfirmed": true/false,
  "orderData": {
    "items": ["1x Special Chicken Daal Chawal"],
    "address": "Customer delivery address",
    "total": 450
  }
}
If the order is not yet confirmed, set "isOrderConfirmed": false and "orderData": null. Do not include markdown backticks around the json, output raw JSON or standard JSON block.`;

    let parsedData: { replyMessage: string; isOrderConfirmed: boolean; orderData?: { items: string[]; address: string; total: number } | null } = {
      replyMessage: "",
      isOrderConfirmed: false,
      orderData: null,
    };

    // 7. Invoke Google Gemini Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: systemPrompt,
        });

        const rawText = response.text || "{}";
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        parsedData = JSON.parse(cleanJson);
      } catch (geminiError) {
        console.warn("Gemini API call or JSON parsing failed:", geminiError);
      }
    }

    if (!parsedData.replyMessage) {
      parsedData.replyMessage = `Jee bilkul! Batayen aap kya order karna chahtay hain?`;
    }

    // 8. Save assistant reply to ChatMessage log
    await prisma.chatMessage.create({
      data: { tenantId: tenant.id, customerId: customer.id, role: "assistant", content: parsedData.replyMessage },
    });

    // 9. ⭐ SEND REPLY BACK TO CUSTOMER ON WHATSAPP ⭐
    await sendWhatsAppTextMessage(phone, parsedData.replyMessage);

    let createdOrder = null;

    // 10. If Gemini detects the order is confirmed, record it to Prisma and trigger Kitchen Alert
    if (parsedData.isOrderConfirmed && parsedData.orderData) {
      const { items, address, total } = parsedData.orderData;

      createdOrder = await prisma.order.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          customerName: customerName,
          phone: phone,
          address: address || customer.address || "WhatsApp Order",
          items: items || ["Special Chicken Daal Chawal"],
          total: total || 450,
          status: "NEW",
        },
      });

      if (address) {
        await prisma.customer.update({ where: { id: customer.id }, data: { address } });
      }

      const chefPhone = process.env.CHEF_WHATSAPP_PHONE || "923349440201";
      await sendWhatsAppKitchenAlert(chefPhone, {
        id: createdOrder.id,
        customerName: createdOrder.customerName,
        phone: createdOrder.phone,
        address: createdOrder.address,
        items: createdOrder.items,
        total: createdOrder.total,
      });
    }

    return NextResponse.json({
      success: true,
      reply: parsedData.replyMessage,
      orderConfirmed: parsedData.isOrderConfirmed,
      orderId: createdOrder?.id || null,
    });
  } catch (error) {
    console.error("WhatsApp Webhook processing error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}