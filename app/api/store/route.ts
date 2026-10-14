import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug parameter is required" },
        { status: 400 }
      );
    }

    let tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: {
        menuItems: {
          where: { available: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Self-healing fallback: if tenant doesn't exist yet, seed demo tenant & menu automatically
    if (!tenant) {
      const isDaalChaawal = slug === "daal-chaawal";
      const formattedTitle = slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      tenant = await prisma.tenant.create({
        data: {
          id: isDaalChaawal ? "daal-chaawal-tenant-id" : slug,
          businessName: isDaalChaawal ? "Daal Chaawal Express" : `${formattedTitle} Eatery`,
          slug: slug,
          currency: "PKR",
          timezone: "Asia/Karachi",
          primaryColor: "#f59e0b",
          logoUrl: null,
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
                description: "Pure desi ghee garlic tadka mash daal served with crispy zeera rice and achar",
                price: 350,
                category: "Main Course",
                available: true,
              },
              {
                name: "Karachi Chicken Biryani",
                description: "Authentic spicy karachi dum biryani with marinated chicken pieces and raita",
                price: 500,
                category: "Main Course",
                available: true,
              },
              {
                name: "Crispy Shami Kabab (2 Pcs)",
                description: "Traditional minced chicken and chana daal kababs pan-fried with egg coating",
                price: 180,
                category: "Sides",
                available: true,
              },
              {
                name: "Mint Lemon Margarita",
                description: "Chilled fresh mint leaves blended with lemon juice, soda, and black salt",
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
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        businessName: tenant.businessName,
        slug: tenant.slug,
        currency: tenant.currency,
        timezone: tenant.timezone,
        primaryColor: tenant.primaryColor,
        logoUrl: tenant.logoUrl,
      },
      menu: tenant.menuItems,
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("Store API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error querying store" },
      { status: 500 }
    );
  }
}