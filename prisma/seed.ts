const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "daal-chaawal" },
    update: {},
    create: {
      id: "daal-chaawal-tenant-id",
      businessName: "Daal Chaawal Express",
      slug: "daal-chaawal",
      timezone: "Asia/Karachi",
      currency: "PKR",
    },
  });

  console.log("Seeded tenant successfully:", tenant);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });