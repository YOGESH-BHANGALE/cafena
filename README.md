# ☕ Cafena - Modern Coffee Shop Website

Welcome to the **Cafena Coffee Shop** repository! This is a fully functional, dynamic, and production-ready e-commerce website built for a premium coffee shop. 

## ✨ Key Features
- **Stunning UI/UX**: A modern, dark-themed, and fully responsive design built with HTML, CSS, and Vanilla JavaScript.
- **Dynamic Content**: Menu items, products, and blogs are dynamically fetched from **Firebase Firestore** in real-time.
- **Shopping Cart**: Fully functional cart side-panel allowing users to add/remove items and calculate totals.
- **Secure Payments**: Integrated **Razorpay** payment gateway via Firebase Cloud Functions for seamless checkout.
- **Table Reservations**: Customers can easily book a table, which is saved directly to the database.
- **Secret Admin Dashboard**: A secure, hidden portal (`/admin.html`) protected by **Firebase Authentication**. Admins can:
  - View incoming orders and contact messages.
  - Approve/Decline table reservations.
  - Add, edit, delete, or mark menu items as "Out of Stock".
  - Write and publish new blog posts.

## 🛠️ Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend/Database**: Firebase Firestore, Firebase Authentication
- **Serverless Compute**: Firebase Cloud Functions (Node.js)
- **Payments**: Razorpay API
- **Hosting**: Firebase Hosting

## 🚀 Setup & Installation

### 1. Firebase Setup
Create a new project on the [Firebase Console](https://console.firebase.google.com/) and enable:
- **Firestore Database** (Create collections: `menu`, `blogs`, `reservations`, `orders`, `contacts`)
- **Authentication** (Enable Email/Password sign-in)
- **Hosting**

### 2. Configure Environment Variables
Navigate to the `functions` directory and create a `.env` file with your Razorpay API keys:
```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

### 3. Deploy to Firebase
Make sure you have the Firebase CLI installed:
```bash
npm install -g firebase-tools
firebase login
```
Deploy the rules, functions, and hosting:
```bash
firebase deploy
```

## 🔒 Security
All sensitive customer data is protected by strict Firestore Security Rules. The `orders`, `contacts`, and `reservations` collections are completely locked down and can only be read by authenticated Admin accounts. Secret API keys are securely managed via Cloud Functions and are never exposed to the client browser.

---
*Developed with modern web standards and high-quality UI design.*
