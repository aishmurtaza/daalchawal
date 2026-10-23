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
    await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
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
        text: { body: messageText },
      }),
    });
  } catch (err) {
    console.error("Error dispatching outbound WhatsApp message:", err);
  }
}

// Helper: Send menu image brochure back to customer on WhatsApp
async function sendWhatsAppImageMessage(recipientPhone: string, captionText: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log("WhatsApp credentials missing in .env. Skipping image dispatch.");
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://unabdicating-aweless-edwin.ngrok-free.dev");
  const imageUrl = `${baseUrl}/daal-chaawal-express-menu.png`;

  try {
    await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "image",
        image: {
          link: imageUrl,
          caption: captionText,
        },
      }),
    });
  } catch (err) {
    console.error("Error dispatching WhatsApp image brochure:", err);
    await sendWhatsAppTextMessage(recipientPhone, captionText);
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

    // 3. Fetch tenant and strictly synchronize exact website menu items
    let tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] },
      include: { menuItems: { where: { available: true } } },
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
              { name: "Daal Channa", description: "Split chickpea lentils slow-cooked, finished with garlic and cumin tarka in desi ghee", price: 370, category: "Main Course", available: true },
              { name: "Daal Kaali Masar", description: "Whole masoor lentils with skin, deep and earthy, tempered with cumin and curry leaves", price: 350, category: "Main Course", available: true },
              { name: "Daal Moong Masoor", description: "Yellow moong and red masoor cooked down soft and golden with mustard seed tarka", price: 350, category: "Main Course", available: true },
              { name: "Sada Chaawal", description: "Aged basmati boiled and drained, long and separate grains", price: 140, category: "Main Course", available: true },
              { name: "Single Thali Deal", description: "Any 1 Daal + Sada Chaawal + Free Aam ka Achaar & Fresh Salad", price: 440, category: "Deals", available: true },
              { name: "Daftar Box", description: "5 Single Thalis with mix & match daals in packed boxes", price: 2050, category: "Deals", available: true },
            ],
          },
        },
        include: { menuItems: { where: { available: true } } },
      });
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

    // 6. Build dynamic menu context & Strict Human-Like System Prompt
    const menuSummary = tenant.menuItems
      .map((m: { name: string; price: number; category: string; description: string | null }) => 
        `• ${m.name} - ${tenant.currency} ${m.price} [${m.category}]: ${m.description || "Freshly cooked"}`
      )
      .join("\n");

    const systemPrompt = [
      `You are a warm, casual, and friendly human restaurant manager / host for ${tenant.businessName}.`,
      `Location: Bahria Town Phase 4, Islamabad. Timings: 12pm - 10pm.`,
      `Minimum order Rs 300. Delivery Rs 100, free over Rs 1,500. Every thali includes free aam ka achaar and fresh salad.`,
      `STRICT MENU (Do NOT invent or suggest anything else):`,
      menuSummary,
      `Conversation History:`,
      chatHistory.map(h => `${h.role}: ${h.content}`).join("\n"),
      `User's latest message: "${userText}"`,
      `Behavioral Guidelines:`,
      `- Talk like a real human friend/manager in natural Roman Urdu or English depending on how the user speaks. Never sound robotic or formal.`,
      `- If the user asks for the menu, prices, or options: Set "sendMenuImage" to true and say something natural like "Yeh lein menu brochure! 🍛 Batayen kya pack karwayen?"`,
      `- If the user gives their order and address: Acknowledge it warmly, calculate the total, set "isOrderConfirmed" to true, and give a friendly sign-off.`,
      `- Output your response strictly in valid JSON format with this exact structure:`,
      `{`,
      `  "replyMessage": "Your warm human reply here",`,
      `  "sendMenuImage": false,`,
      `  "isOrderConfirmed": false,`,
      `  "orderData": {`,
      `    "items": ["1x Single Thali Deal (Daal Channa)"],`,
      `    "address": "Customer address",`,
      `    "total": 440`,
      `  }`,
      `}`,
      `If the order is not yet confirmed, set "isOrderConfirmed" to false and "orderData" to null. Output raw JSON without markdown backticks.`
    ].join("\n");

    let parsedData: { replyMessage: string; sendMenuImage?: boolean; isOrderConfirmed: boolean; orderData?: { items: string[]; address: string; total: number } | null } = {
      replyMessage: "",
      sendMenuImage: false,
      isOrderConfirmed: false,
      orderData: null,
    };

    let geminiFailed = false;

    // 7. Invoke Google Gemini Flash (using gemini-3.6-flash) with error handling
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: systemPrompt,
        });

        const rawText = response.text || "{}";
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        parsedData = JSON.parse(cleanJson);
      } catch (geminiError: any) {
        console.warn("Gemini API quota/error encountered, switching to smart fallback:", geminiError?.message || geminiError);
        geminiFailed = true;
      }
    } else {
      geminiFailed = true;
    }

    // Intelligent Fallback Handler (Triggers automatically if Gemini quota is exhausted or missing)
    if (geminiFailed || !parsedData.replyMessage) {
      const lower = userText.toLowerCase();

      if (lower.includes("menu") || lower.includes("price") || lower.includes("rate") || lower.includes("kya hai") || lower.includes("list")) {
        parsedData.replyMessage = "Yeh lein menu brochure! 🍛 Batayen kya pack karwayen?";
        parsedData.sendMenuImage = true;
      } else if (lower.includes("order") || lower.includes("bhej do") || lower.includes("chahiye") || lower.includes("kardain")) {
        parsedData.replyMessage = "Zabardast! Aap ka order note kar liya hai. Meherbani karke apna delivery address share kar dein taake garam garam khana dispatch karwayen! 🛵";
        parsedData.isOrderConfirmed = true;
        parsedData.orderData = {
          items: [userText],
          address: customer.address || "Pending Address",
          total: 440
        };
      } else if (lower.includes("salam") || lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        parsedData.replyMessage = `Walaikum Assalam! ${tenant.businessName} mein khushamdeed! Ghar jaisa taza daal chaawal tayar hai. Menu dekhne ke liye 'menu' likhein ya direct order batayen! 😊`;
      } else {
        parsedData.replyMessage = `Jee bilkul! Batayen ${tenant.businessName} se kya order karna pasand kareinge? Menu dekhne ke liye 'menu' type karein.`;
      }
    }

    // 8. Save assistant reply to ChatMessage log
    await prisma.chatMessage.create({
      data: { tenantId: tenant.id, customerId: customer.id, role: "assistant", content: parsedData.replyMessage },
    });

    // 9. Send response back to customer on WhatsApp
    if (parsedData.sendMenuImage) {
      await sendWhatsAppImageMessage(phone, parsedData.replyMessage);
    } else {
      await sendWhatsAppTextMessage(phone, parsedData.replyMessage);
    }

    let createdOrder = null;

    // 10. If order is confirmed, record to PostgreSQL and trigger Kitchen Alert
    if (parsedData.isOrderConfirmed && parsedData.orderData) {
      const { items, address, total } = parsedData.orderData;

      createdOrder = await prisma.order.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          customerName: customerName,
          phone: phone,
          address: address || customer.address || "WhatsApp Order",
          items: items || ["Single Thali Deal"],
          total: total || 440,
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