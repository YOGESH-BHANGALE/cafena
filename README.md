# ☕ Cafena - Modern Coffee Shop Website

Welcome to the **Cafena Coffee Shop** repository! This is a fully functional, dynamic, and production-ready e-commerce website built for a premium coffee shop. 

## ✨ Key Features
- **Stunning UI/UX**: A modern, dark-themed, and fully responsive design built with HTML, CSS, and Vanilla JavaScript.
- **Dynamic Content**: Menu items, products, and blogs are dynamically fetched from **Firebase Firestore** in real-time.
- **AI Barista Recommendations (New!)**: A smart AI assistant powered by **LLaMA 3.3 70B via Groq API**. As users add items to their shopping cart, the AI strictly analyzes their flavor profile and dynamically recommends complementary items from the active menu in real-time.
- **Shopping Cart**: Fully functional cart side-panel allowing users to add/remove items and calculate totals.
- **Secure Payments**: Integrated **Razorpay** payment gateway via Firebase Cloud Functions for seamless checkout.
- **Table Reservations & SMS Alerts**: Customers can easily book a table, which is saved directly to the database. The system instantly sends an SMS notification to the restaurant owner via the **Twilio API**.
- **Secret Admin Dashboard**: A secure, hidden portal (`/admin.html`) protected by **Firebase Authentication**. Admins can:
  - View real-time analytics (total revenue, total orders).
  - Track incoming orders, table reservations, and contact messages.
  - Add, edit, delete, or mark menu items as "Out of Stock".
  - Write and publish new blog posts.

## 🛠️ Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend/Database**: Firebase Firestore, Firebase Authentication
- **Serverless Compute**: Firebase Cloud Functions (Node.js)
- **AI Integration**: Groq API (LLaMA 3.3 70B)
- **SMS Integration**: Twilio API
- **Payments**: Razorpay API
- **Hosting**: Firebase Hosting

## 🚀 Setup & Installation

### 1. Firebase Setup
Create a new project on the [Firebase Console](https://console.firebase.google.com/) and enable:
- **Firestore Database** (Create collections: `menu`, `blogs`, `reservations`, `orders`, `contacts`)
- **Authentication** (Enable Email/Password sign-in)
- **Hosting**

### 2. Configure Environment Variables
Navigate to the `functions` directory and create a `.env` file with your secret keys:
```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

GROQ_API_KEY=your_groq_api_key
```

### 3. Deploy to Firebase
Make sure you have the Firebase CLI installed:
```bash
npm install -g firebase-tools
firebase login
```
Install backend dependencies:
```bash
cd functions
npm install
```
Deploy the rules, functions, and hosting:
```bash
firebase deploy
```

## 🔒 Security
All sensitive customer data is protected by strict Firestore Security Rules. The `orders`, `contacts`, and `reservations` collections are completely locked down and can only be read by authenticated Admin accounts. Secret API keys are securely managed via Cloud Functions and are never exposed to the client browser.

---
*Developed with modern web standards and high-quality UI design.*
