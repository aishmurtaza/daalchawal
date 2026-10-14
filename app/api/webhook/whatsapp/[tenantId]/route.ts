import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

interface RouteContext {
  params: Promise<{ tenantId: string }>;
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

// POST: Receives incoming Meta WhatsApp messages, interactive button clicks, and handles AI chat
export async function POST(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await context.params;
    const body = await request.json();

    console.log("📥 INBOUND WHATSAPP WEBHOOK RECEIVED:", JSON.stringify(body, null, 2));

    // Parse Meta WhatsApp Cloud API payload structure
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messageObj = value?.messages?.[0];

    // 1. Handle Chef Interactive Button Taps First (e.g., "🍳 Start Cooking")
    if (messageObj && messageObj.type === "interactive" && messageObj.interactive?.type === "button_reply") {
      const buttonId = messageObj.interactive.button_reply.id; // e.g. "cook_<orderId>"
      console.log("🔘 Button reply clicked by chef:", buttonId);

      if (buttonId.startsWith("cook_")) {
        const orderId = buttonId.replace("cook_", "");
        const updatedOrder = await prisma.order.update({
          where: { id: orderId },
          data: { status: "PREPARING" },
        });
        console.log(`✅ Order ${orderId} successfully moved to PREPARING via WhatsApp button!`, updatedOrder);
      } else if (buttonId.startsWith("cancel_")) {
        const orderId = buttonId.replace("cancel_", "");
        const cancelledOrder = await prisma.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED" },
        });
        console.log(`❌ Order ${orderId} marked as CANCELLED via WhatsApp button!`, cancelledOrder);
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
      return NextResponse.json({
        success: true,
        message: "No readable text message or phone found in payload (status update, ack, or media)",
      });
    }

    // 3. Fetch tenant and available menu context
    let tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id: tenantId }, { slug: tenantId }],
      },
      include: {
        menuItems: {
          where: { available: true },
        },
      },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          id: tenantId,
          businessName: "Daal Chaawal Express",
          slug: tenantId === "daal-chaawal-tenant-id" ? "daal-chaawal" : tenantId,
          currency: "PKR",
          timezone: "Asia/Karachi",
          primaryColor: "#f59e0b",
          menuItems: {
            create: [
              {
                name: "Special Chicken Daal Chawal",
                description: "Slow-cooked yellow lentil daal with fragrant basmati rice & chicken shami kabab",
                price: 450,
                category: "Main Course",
                available: true,
              },
              {
                name: "Desi Ghee Daal Fry Plate",
                description: "Pure desi ghee garlic tadka mash daal served with crispy zeera rice",
                price: 350,
                category: "Main Course",
                available: true,
              },
              {
                name: "Karachi Chicken Biryani",
                description: "Authentic spicy karachi dum biryani with marinated chicken pieces",
                price: 500,
                category: "Main Course",
                available: true,
              },
              {
                name: "Mint Lemon Margarita",
                description: "Chilled fresh mint leaves blended with lemon juice & soda",
                price: 200,
                category: "Beverages",
                available: true,
              },
            ],
          },
        },
        include: {
          menuItems: {
            where: { available: true },
          },
        },
      });
    }

    // 4. Find or create customer record
    const customer = await prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId: tenant.id,
          phone: phone,
        },
      },
      update: {
        name: customerName !== "WhatsApp Customer" ? customerName : undefined,
      },
      create: {
        tenantId: tenant.id,
        phone: phone,
        name: customerName,
      },
    });

    // 5. Save incoming customer message to ChatMessage log
    await prisma.chatMessage.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        role: "user",
        content: userText,
      },
    });

    // 6. Build dynamic menu context & prompt for Gemini AI
    const menuSummary = tenant.menuItems
      .map(
        (m) =>
          `• ${m.name} - ${tenant.currency} ${m.price} [${m.category}]: ${m.description || "Freshly cooked"}`
      )
      .join("\n");

    const systemPrompt = `You are the friendly, fast, and polite AI Ordering Manager for "${tenant.businessName}".
Your mission is to take customer food orders, answer questions about the menu, delivery, and pricing, and guide them to order.

Restaurant Context:
- Currency: ${tenant.currency}
- Menu Items:
${menuSummary}

Language & Tone Guidelines:
- Match the customer's language. If they write in Roman Urdu (e.g., "Salam, kya hal hai", "bhai daal chawal kitne ka hai"), reply in warm, natural, respectful Roman Urdu.
- If they write in English, reply in courteous English.
- Always be helpful, appetizing, and brief (WhatsApp users prefer concise replies).
- When the customer confirms what they want, ask politely for their delivery address and name if not already provided.
- Never invent menu items that are not on the list.

Customer Name: ${customer.name || "Customer"}
Customer Phone: ${customer.phone}
Customer said: "${userText}"`;

    let aiReply = "";

    // 7. Invoke Google Gemini Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: systemPrompt,
        });

        aiReply = response.text || "";
      } catch (geminiError) {
        console.warn("Gemini API call failed, using intelligent fallback:", geminiError);
      }
    }

    // Intelligent fallback if Gemini API key is missing or quota/network error occurs
    if (!aiReply) {
      const lower = userText.toLowerCase();
      if (lower.includes("salam") || lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        aiReply = `Walaikum Assalam! ${tenant.businessName} mein khushamdeed! Aaj hamare paas taza Special Chicken Daal Chawal (PKR 450), Desi Ghee Daal Fry (PKR 350) aur Karachi Chicken Biryani (PKR 500) tayar hain. Batayen aap ke liye kya pack karwayen?`;
      } else if (lower.includes("price") || lower.includes("rate") || lower.includes("kitn") || lower.includes("menu")) {
        aiReply = `Hamara taza menu aur prices:\n${tenant.menuItems.map((m) => `• ${m.name}: ${tenant.currency}${m.price}`).join("\n")}\nAap kitni plates order karna chahtay hain?`;
      } else if (lower.includes("order") || lower.includes("chahiye") || lower.includes("bhejo") || lower.includes("bhej do") || lower.includes("pack")) {
        aiReply = `Zabardast! Aap ka order note kar rahe hain. Barah-e-karam apna Delivery Address aur contact confirm farma dein taake hum kitchen ko order forward karein.`;
      } else {
        aiReply = `Jee bilkul! ${tenant.businessName} aap ki khidmat mein hazir hai. Hum taza aur khalis desi khaney deliver kartay hain. Batayen aap kya order karna chahte hain?`;
      }
    }

    // 8. Save assistant reply to ChatMessage log
    const savedAssistantMsg = await prisma.chatMessage.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        role: "assistant",
        content: aiReply,
      },
    });

    return NextResponse.json({
      success: true,
      reply: aiReply,
      chatId: savedAssistantMsg.id,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
      },
    });
  } catch (error) {
    console.error("WhatsApp Webhook processing error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error processing WhatsApp message" },
      { status: 500 }
    );
  }
}