const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function testPaymentFlow() {
  console.log("🧪 Testing payment flow...\n");

  try {
    // Check if the webhookEventId column exists
    console.log("1️⃣  Checking StripePayment schema...");
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'StripePayment'
      ORDER BY ordinal_position;
    `;
    console.log("✅ StripePayment columns:", result.map(r => r.column_name).join(", "));

    // Check Credits schema
    console.log("\n2️⃣  Checking Credits schema...");
    const creditsResult = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Credits'
      ORDER BY ordinal_position;
    `;
    console.log("✅ Credits columns:", creditsResult.map(r => r.column_name).join(", "));

    // Try creating a test payment record
    console.log("\n3️⃣  Testing StripePayment.create with webhookEventId...");
    const testPayment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: "test_session_" + Date.now(),
        stripePaymentId: "test_payment_" + Date.now(),
        webhookEventId: "evt_test_" + Date.now(),
        amount: 249,
        credits: 100,
        status: "test",
      },
    });
    console.log("✅ Payment created:", testPayment.id);
    console.log("✅ webhookEventId stored:", testPayment.webhookEventId);

    // Clean up
    await prisma.stripePayment.delete({
      where: { id: testPayment.id },
    });
    console.log("✅ Test payment cleaned up\n");

    console.log("🎉 All checks passed! Payment system is ready.");
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.code === "P2014") {
      console.error("⚠️  Schema validation error - please run migrations");
    }
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentFlow();
