import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

interface RouteContext {
  params: Promise<{ tenantId: string }>;
}

// Helper: Send text message back to customer on Instagram DM
async function sendInstagramTextMessage(recipientId: string, messageText: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const pageId = process.env.INSTAGRAM_PAGE_ID;

  if (!token || !pageId) {
    console.log("Instagram credentials missing in .env. Skipping outbound text reply.");
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v17.0/${pageId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error("Meta Graph API Text Error:", data.error);
    }
  } catch (err) {
    console.error("Error dispatching outbound Instagram DM:", err);
  }
}

// Helper: Send menu image brochure via Instagram DM (Matches WhatsApp rich media experience)
async function sendInstagramImageMessage(recipientId: string, captionText: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const pageId = process.env.INSTAGRAM_PAGE_ID;

  if (!token || !pageId) {
    console.log("Instagram credentials missing in .env. Skipping image dispatch.");
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://unabdicating-aweless-edwin.ngrok-free.dev");
  const imageUrl = `${baseUrl}/daal-chaawal-express-menu.png`;

  try {
    const res = await fetch(`https://graph.facebook.com/v17.0/${pageId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: imageUrl,
              is_reusable: true,
            },
          },
        },
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error("Meta Graph API Image Error:", data.error);
    }
    // Follow up with text caption
    await sendInstagramTextMessage(recipientId, captionText);
  } catch (err) {
    console.error("Error dispatching Instagram image brochure:", err);
    await sendInstagramTextMessage(recipientId, captionText);
  }
}

// GET: Meta Instagram Webhook Verification Challenge
export async function GET(request: Request, context: RouteContext) {
  try {
    await context.params;
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const expectedToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "daalchaawal_secret";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("[Instagram Webhook] Verification challenge passed successfully");
      return new Response(challenge || "", { status: 200 });
    }

    console.warn("[Instagram Webhook] Token mismatch. Received:", token, "Expected:", expectedToken);
    return new Response("Forbidden: Invalid verification token", { status: 403 });
  } catch (error: any) {
    console.error("Instagram Verification error:", error);
    return new Response("Internal Error", { status: 500 });
  }
}

// POST: Receives incoming Meta Instagram DM webhook payloads
export async function POST(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await context.params;
    const body = await request.json();

    if (body.object !== "instagram") {
      return NextResponse.json({ success: true, message: "Ignored non-instagram event" });
    }

    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    const senderId = messaging?.sender?.id;
    const userText = messaging?.message?.text;

    if (!senderId || !userText) {
      return NextResponse.json({ success: true, message: "No readable message or sender found" });
    }

    console.log(`[Instagram Webhook] Received message from ${senderId}: "${userText}"`);

    // Fetch tenant and official menu items
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
              { name: "Single Thali Deal", description: "Any 1 Daal + Sada Chaawal + Free Aam ka Achaar & Fresh Salad", price: 440, category: "Deals", available: true },
              { name: "Daftar Box", description: "5 Single Thalis with mix & match daals", price: 2050, category: "Deals", available: true },
              { name: "Daal Channa", description: "Split chickpea lentils slow-cooked with garlic & desi ghee tarka", price: 370, category: "Main Course", available: true },
              { name: "Daal Kaali Masar", description: "Whole masoor lentils tempered with cumin and curry leaves", price: 350, category: "Main Course", available: true },
              { name: "Daal Moong Masoor", description: "Yellow moong and red masoor soft and golden", price: 350, category: "Main Course", available: true },
              { name: "Sada Chaawal", description: "Aged basmati boiled and drained", price: 140, category: "Main Course", available: true },
            ],
          },
        },
        include: { menuItems: { where: { available: true } } },
      });
    }

    // Find or create customer record using Instagram sender ID
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: `insta_${senderId}` } },
      update: {},
      create: { tenantId: tenant.id, phone: `insta_${senderId}`, name: "Instagram Customer" },
    });

    // Save incoming user message
    await prisma.chatMessage.create({
      data: { tenantId: tenant.id, customerId: customer.id, role: "user", content: userText },
    });

    const chatHistory = await prisma.chatMessage.findMany({
      where: { tenantId: tenant.id, customerId: customer.id },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    const menuSummary = tenant.menuItems
      .map((m: { name: string; price: number; category: string; description: string | null }) => 
        `• ${m.name} - ${tenant.currency} ${m.price} [${m.category}]: ${m.description || "Freshly cooked"}`
      )
      .join("\n");

    const systemPrompt = [
      `You are a warm, casual, and friendly human restaurant manager / host for ${tenant.businessName} on Instagram DM.`,
      `Location: Bahria Town Phase 4, Islamabad. Timings: 12pm - 10pm.`,
      `Tagline: "Ghar jaisa daal chaawal, aap ke darwazay par."`,
      `Delivery Rules: Minimum order Rs 300, standard delivery Rs 100, free delivery on orders over Rs 1,500.`,
      `Every thali includes complimentary aam ka achaar and fresh salad.`,
      `STRICT OFFICIAL MENU (Do not invent ghost items like biryani):`,
      menuSummary,
      `Conversation History:`,
      chatHistory.map(h => `${h.role}: ${h.content}`).join("\n"),
      `User's latest message: "${userText}"`,
      `Behavioral Guidelines:`,
      `- Talk like a real human restaurant manager in natural Roman Urdu or English matching the customer's language.`,
      `- If user asks for menu, prices, or recommendations: Set "sendMenuImage" to true and write a warm welcoming reply like "Yeh lein hamara menu brochure! 🍛 Batayen kya pack karwayen?"`,
      `- If user provides order items and delivery address: Set "isOrderConfirmed" to true, calculate total price accurately based on menu, and confirm warmly.`,
      `- Output strictly in valid JSON format with no markdown wrappers:`,
      `{`,
      `  "replyMessage": "Your warm human manager reply here",`,
      `  "sendMenuImage": false,`,
      `  "isOrderConfirmed": false,`,
      `  "orderData": {`,
      `    "items": ["1x Single Thali Deal"],`,
      `    "address": "Customer delivery address",`,
      `    "total": 440`,
      `  }`,
      `}`
    ].join("\n");

    let parsedData = {
      replyMessage: "Assalam-o-Alaikum! Jee batayen Daal Chaawal Express se kya order karna pasand kareinge?",
      sendMenuImage: false,
      isOrderConfirmed: false,
      orderData: null as { items: string[]; address: string; total: number } | null,
    };

    let geminiFailed = false;

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
      } catch (err) {
        console.error("Gemini API error in Instagram route, using fallback:", err);
        geminiFailed = true;
      }
    } else {
      geminiFailed = true;
    }

    if (geminiFailed || !parsedData.replyMessage) {
      const lower = userText.toLowerCase();
      if (lower.includes("menu") || lower.includes("price") || lower.includes("rate") || lower.includes("daal")) {
        parsedData.replyMessage = "Yeh lein hamara menu brochure! 🍛 Batayen kya pack karwayen?";
        parsedData.sendMenuImage = true;
      } else if (lower.includes("order") || lower.includes("bhej do") || lower.includes("chahiye")) {
        parsedData.replyMessage = "Zabardast! Aap ka order note kar liya hai. Apni delivery address share kar dein!";
        parsedData.isOrderConfirmed = true;
        parsedData.orderData = { items: [userText], address: customer.address || "Bahria Town Phase 4, Islamabad", total: 440 };
      }
    }

    // Save assistant reply in database
    await prisma.chatMessage.create({
      data: { tenantId: tenant.id, customerId: customer.id, role: "assistant", content: parsedData.replyMessage },
    });

    // Dispatch message or rich menu brochure image to Instagram DM
    if (parsedData.sendMenuImage) {
      await sendInstagramImageMessage(senderId, parsedData.replyMessage);
    } else {
      await sendInstagramTextMessage(senderId, parsedData.replyMessage);
    }

    // If order confirmed, save to PostgreSQL and trigger kitchen alert status
    if (parsedData.isOrderConfirmed && parsedData.orderData) {
      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          customerName: "Instagram Customer",
          phone: `insta_${senderId}`,
          address: parsedData.orderData.address,
          items: parsedData.orderData.items,
          total: parsedData.orderData.total,
          status: "NEW", // Triggers kitchen alert dashboard
        },
      });
      console.log("[Instagram Order Created & Kitchen Alert Triggered]:", parsedData.orderData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Instagram Webhook error:", error);
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}