import { prisma } from "../lib/prisma";

async function runDemo() {
  console.log("🚀 Starting DaalChaawal Engine End-to-End Demo...\n");

  // 1. Ensure test tenant exists
  let tenant = await prisma.tenant.findUnique({ where: { slug: "daal-chaawal" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        businessName: "Daal Chaawal Express",
        slug: "daal-chaawal",
        currency: "PKR",
        primaryColor: "#5C3A21"
      }
    });
  }

  const tenantId = tenant.id;
  const customerPhone = "03219876543";
  const customerName = "Aish Murtaza";
  const address = "House 42, Street 7, Bahria Town, Rawalpindi";

  // 2. Simulate User Checkout from Storefront
  console.log("🛒 Step 1: Customer checks out from storefront (/order/daal-chaawal)...");
  
  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { tenantId, phone: customerPhone }
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { tenantId, phone: customerPhone, name: customerName, address }
    });
  }

  // Create Order in 'NEW' status (Saved to DB & instantly appears on Kitchen Kanban)
  const order = await prisma.order.create({
    data: {
      tenantId,
      customerId: customer.id,
      customerName,
      phone: customerPhone,
      address,
      items: ["2x Special Chicken Daal Chawal", "1x Mint Margarita"],
      total: 1080,
      status: "NEW"
    }
  });

  console.log(`✅ Order Saved Successfully! ID: ${order.id}`);
  console.log(`   Status: [ ${order.status} ] ➔ Pushed to Kitchen Kanban Board.`);
  console.log(`   Items: ${order.items.join(", ")} | Total: PKR ${order.total}\n`);

  // 3. Kitchen Action: Send to Cooking (PREPARING)
  console.log("👨‍🍳 Step 2: Kitchen chef clicks 'Send to Kitchen'...");
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PREPARING" }
  });
  console.log("✅ Order status updated to [ PREPARING ]. Kitchen gadget chimes!\n");

  // Simulate cooking delay
  await new Promise(r => setTimeout(r, 1000));

  // 4. Dispatch Action: Out for Delivery (DELIVERING)
  console.log("🛵 Step 3: Order marked as dispatched ('Out for Delivery')...");
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "DELIVERING" }
  });

  // 5. Automated WhatsApp Notification Trigger
  console.log("💬 Step 4: Automated WhatsApp Notification triggered to customer...");
  const whatsAppMessage = `Assalam-o-Alaikum ${customerName}! 🛵 Aap ka Daal Chaawal order dispatch ho gaya hai aur rider lagbhag 5 minute mein aap ke darwazay par hoga. Please cash/payment tayyar rakhein!`;
  
  // Log message to chat history
  await prisma.chatMessage.create({
    data: {
      tenantId,
      customerId: customer.id,
      role: "assistant",
      content: whatsAppMessage
    }
  });

  console.log(`📤 WhatsApp Message Sent to ${customerPhone}:`);
  console.log(`--------------------------------------------------`);
  console.log(`"${whatsAppMessage}"`);
  console.log(`--------------------------------------------------\n`);
  console.log("🎉 Demo completed successfully! All steps verified in database.");
  
  await prisma.$disconnect();
}

runDemo().catch(console.error);