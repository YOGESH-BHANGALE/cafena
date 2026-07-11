const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const Razorpay = require("razorpay");
const crypto = require("crypto");

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
        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            res.status(400).json({ success: false, error: "Invalid or missing amount." });
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

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            keyId: process.env.RAZORPAY_KEY_ID
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
            customerName,
            phone,
            items,
            totalAmount
        } = req.body;

        // Basic validations
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            res.status(400).json({ success: false, error: "Missing Razorpay payment verification parameters." });
            return;
        }

        if (!customerName || !phone || !items || !Array.isArray(items) || !totalAmount) {
            res.status(400).json({ success: false, error: "Missing customer or order details." });
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

        // Write order details to the Firestore collection
        const orderRef = await db.collection("orders").add({
            customerName,
            phone,
            items: items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image || ""
            })),
            totalAmount,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            status: "paid",
            createdAt: FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            id: orderRef.id,
            message: "Payment verified and order created successfully!"
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
