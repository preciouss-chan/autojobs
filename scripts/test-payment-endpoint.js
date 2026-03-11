const http = require("http");

async function testPaymentEndpoint() {
  console.log("🧪 Testing payment creation endpoint...\n");

  // First, set up test data
  console.log("1️⃣  Setting up test user and session...");
  const setupResponse = await new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/api/test/setup",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, data: JSON.parse(data) });
      });
    });

    req.on("error", reject);
    req.end();
  });

  if (setupResponse.status !== 200) {
    console.error("❌ Setup failed:", setupResponse.data);
    return;
  }

  console.log("✅ Test user created:", setupResponse.data.user.email);
  const sessionToken = setupResponse.data.session.sessionToken;
  console.log("✅ Session token:", sessionToken.substring(0, 10) + "...");

  // Now try creating a payment session
  console.log("\n2️⃣  Testing payment creation endpoint...");
  const paymentResponse = await new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/api/payments/create-session",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `next-auth.session-token=${sessionToken}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });

  console.log("Status:", paymentResponse.status);
  console.log("Response:", JSON.stringify(paymentResponse.data, null, 2));

  if (paymentResponse.status === 200 && paymentResponse.data.checkoutUrl) {
    console.log(
      "\n🎉 Payment endpoint works! Checkout URL:",
      paymentResponse.data.checkoutUrl
    );
  } else if (paymentResponse.status === 401) {
    console.log(
      "\n⚠️  Auth issue - session may not be properly validated"
    );
  } else {
    console.log("\n❌ Unexpected response from payment endpoint");
  }
}

testPaymentEndpoint().catch(console.error);
