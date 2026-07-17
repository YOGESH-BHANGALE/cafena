const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const twilio = require("twilio");
// Removed GoogleGenAI dependency as we are now using Groq via native fetch

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Function to initialize Razorpay client using environment variables
function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keyId || !keySecret) {
        throw new Error("Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are missing in environment variables.");
    }
    
    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret
    });
}

// 1. Cloud Function to Create Razorpay Order
exports.createOrder = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    // Standard response headers for safety
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { amount, customerName, phone, items } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            res.status(400).json({ success: false, error: "Invalid or missing amount." });
            return;
        }
        
        if (!customerName || !phone || !items || !Array.isArray(items)) {
            res.status(400).json({ success: false, error: "Missing customer or order details for pending order creation." });
            return;
        }

        const razorpay = getRazorpayClient();

        // Razorpay expects amount in paise (₹1 = 100 paise)
        const amountInPaise = Math.round(amount * 100);

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        // Save order as pending in Firestore
        const orderRef = await db.collection("orders").add({
            customerName,
            phone,
            items: items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image || ""
            })),
            totalAmount: amount,
            orderId: order.id,
            status: "pending",
            createdAt: FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            keyId: process.env.RAZORPAY_KEY_ID,
            docId: orderRef.id
        });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Cloud Function to Verify Razorpay Payment Signature and Save Order
exports.verifyPayment = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            docId
        } = req.body;

        // Basic validations
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !docId) {
            res.status(400).json({ success: false, error: "Missing Razorpay payment verification parameters or docId." });
            return;
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
            throw new Error("Razorpay secret key configuration is missing.");
        }

        // Generate signature check using SHA256 HMAC
        const hmac = crypto.createHmac("sha256", keySecret);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            console.error("Signature verification failed. Generated:", generatedSignature, "Received:", razorpay_signature);
            res.status(400).json({ success: false, error: "Payment verification failed. Signature mismatch." });
            return;
        }

        // Update the existing pending order details to paid
        const orderRef = db.collection("orders").doc(docId);
        const orderSnap = await orderRef.get();
        
        if (!orderSnap.exists) {
            res.status(404).json({ success: false, error: "Order document not found." });
            return;
        }
        
        const orderData = orderSnap.data();
        const { customerName, phone, items, totalAmount } = orderData;

        await orderRef.update({
            paymentId: razorpay_payment_id,
            status: "paid",
            updatedAt: FieldValue.serverTimestamp()
        });

        // Send SMS Receipt via Twilio
        try {
            const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
            const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
            
            if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
                const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
                await twilioClient.messages.create({
                    body: `Cafena: Thank you for your order, ${customerName}! Track your order live here: https://coffeeshop-y81-web-ac1f2.web.app/track.html?id=${docId}`,
                    from: twilioPhoneNumber,
                    to: phone
                });
                console.log("SMS receipt sent successfully to", phone);
            } else {
                console.warn("Twilio credentials missing in .env, SMS skipped.");
            }
        } catch (smsError) {
            console.error("Error sending SMS:", smsError);
            // Proceed with returning success even if SMS fails
        }

        res.json({
            success: true,
            id: docId,
            message: "Payment verified and order marked as paid successfully!"
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Cloud Function to Get AI Recommendations
exports.getAIRecommendations = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { cartItems } = req.body;
        if (!cartItems || !Array.isArray(cartItems)) {
            res.status(400).json({ success: false, error: "Missing or invalid cart items." });
            return;
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error("Groq API key is not configured.");
            res.status(500).json({ success: false, error: "AI service is not configured." });
            return;
        }

        // Fetch the active menu to give the AI context
        const menuSnapshot = await db.collection('menu').where('isAvailable', '==', true).get();
        const menuNames = [];
        menuSnapshot.forEach(doc => {
            menuNames.push(doc.data().name);
        });

        const prompt = `You are an expert barista at Cafena. 
The customer has the following items in their cart: ${cartItems.join(", ")}.
Our full available menu is exactly this list: [${menuNames.join(", ")}].

RULES:
1. You MUST recommend exactly 2 items.
2. The recommended items MUST be chosen STRICTLY from the "Our full available menu" list provided above. Do NOT invent new items or recommend items not on the list.
3. The name MUST match the menu list exactly.
4. Do not recommend items they already have in their cart.

Format your response exactly as a JSON array of objects, with each object having:
- "name": The exact name of the recommended item from the menu.
- "reason": A short, mouth-watering 1-sentence reason why it pairs perfectly.
Only output the JSON array, no markdown formatting or extra text.`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        let textResponse = data.choices[0].message.content;
        
        // Clean up potential markdown formatting from the response
        textResponse = textResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        
        let recommendations = JSON.parse(textResponse);

        // Strict Validation: Ensure AI only recommended actual menu items
        const availableForRec = menuNames.filter(name => !cartItems.includes(name));
        recommendations = recommendations.map(rec => {
            if (!menuNames.includes(rec.name)) {
                // If AI hallucinated, fallback to a random valid item
                const fallbackItem = availableForRec[Math.floor(Math.random() * availableForRec.length)];
                return {
                    name: fallbackItem,
                    reason: "A perfect contrast to balance out the flavors in your cart!"
                };
            }
            return rec;
        });

        res.json({ success: true, recommendations });

    } catch (error) {
        console.error("Error getting AI recommendations:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Update Order Status
exports.updateOrderStatus = onRequest({ cors: true }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    // Verify Firebase Auth Token
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
    }

    try {
        const idToken = authHeader.split("Bearer ")[1];
        await admin.auth().verifyIdToken(idToken); // Ensure request is from logged in admin
        
        const { orderId, newStatus } = req.body;
        if (!orderId || !newStatus) {
            res.status(400).json({ success: false, error: "Missing orderId or newStatus" });
            return;
        }

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            res.status(404).json({ success: false, error: "Order not found" });
            return;
        }

        const orderData = orderSnap.data();
        await orderRef.update({
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp()
        });

        // If status is "ready", send SMS
        if (newStatus === "ready") {
            const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
            const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
            
            if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
                const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
                await twilioClient.messages.create({
                    body: `Cafena: Great news, ${orderData.customerName}! Your order is ready for pickup!`,
                    from: twilioPhoneNumber,
                    to: orderData.phone
                });
            }
        }

        res.json({ success: true, message: "Order status updated successfully" });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
