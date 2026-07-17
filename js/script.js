import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    projectId: "coffeeshop-y81-web-ac1f2",
    appId: "1:748536873736:web:f67c23b9c8badc93a6a2bd",
    storageBucket: "coffeeshop-y81-web-ac1f2.firebasestorage.app",
    apiKey: "AIzaSyB4SXUbGrQBjt9tSBbACYkWg9lO71hrLhA",
    authDomain: "coffeeshop-y81-web-ac1f2.firebaseapp.com",
    messagingSenderId: "748536873736",
    measurementId: "G-4296J5N218"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Cloud Functions Endpoints ---
const CREATE_ORDER_URL = "https://createorder-ah5moqsqoq-uc.a.run.app";
const VERIFY_PAYMENT_URL = "https://verifypayment-ah5moqsqoq-uc.a.run.app";
const GET_AI_REC_URL = "https://us-central1-coffeeshop-y81-web-ac1f2.cloudfunctions.net/getAIRecommendations";

// --- DOM References for Layout Triggers ---
const navbar = document.querySelector('.navbar');
const searchForm = document.querySelector('.search-form');
const cartItem = document.querySelector('.cart-items-container');

document.querySelector('#menu-btn').onclick = () => {
    navbar.classList.toggle('active');
    searchForm.classList.remove('active');
    cartItem.classList.remove('active');
};

document.querySelector('#search-btn').onclick = () => {
    searchForm.classList.toggle('active');
    navbar.classList.remove('active');
    cartItem.classList.remove('active');
};

document.querySelector('#cart-btn').onclick = () => {
    cartItem.classList.toggle('active');
    navbar.classList.remove('active');
    searchForm.classList.remove('active');
    if (cartItem.classList.contains('active')) {
        fetchAIRecommendations();
    }
};

document.querySelector('#close-cart-btn').onclick = () => {
    cartItem.classList.remove('active');
};

window.onscroll = () => {
    navbar.classList.remove('active');
    searchForm.classList.remove('active');
};

// --- Toast System ---
function showToast(message, type = "success") {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="toast-message">${message}</div>
    `;

    toastContainer.appendChild(toast);
    
    // Trigger slide-in animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 50);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 4000);
}

// --- Cart Logic ---
let cart = JSON.parse(localStorage.getItem('coffee_shop_cart')) || [];

function saveCart() {
    localStorage.setItem('coffee_shop_cart', JSON.stringify(cart));
    renderCart();
}

function addToCart(name, price, image) {
    const existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ name, price, image, quantity: 1 });
    }
    
    // Auto open cart for user feedback
    cartItem.classList.add('active');
    saveCart();
    showToast(`Added ${name} to your cart!`);
}

function changeQuantity(name, change) {
    const item = cart.find(item => item.name === name);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.name !== name);
        }
        saveCart();
    }
}

function removeItem(name) {
    cart = cart.filter(item => item.name !== name);
    saveCart();
    showToast(`Removed ${name} from your cart.`);
}

function clearCart() {
    cart = [];
    saveCart();
    showToast("Cart cleared.");
}

// --- AI Recommendations ---
let lastRecCartStr = "";
async function fetchAIRecommendations() {
    const aiContainer = document.getElementById('ai-recommendations');
    const aiContent = document.getElementById('ai-rec-content');
    
    if (cart.length === 0) {
        aiContainer.style.display = 'none';
        return;
    }

    const currentCartStr = JSON.stringify(cart.map(i => i.name));
    if (currentCartStr === lastRecCartStr) {
        return; // Already fetched for this cart
    }
    
    lastRecCartStr = currentCartStr;
    aiContainer.style.display = 'block';
    aiContent.innerHTML = '<div class="ai-loader"><i class="fas fa-spinner fa-spin"></i> Analyzing flavor profile...</div>';

    try {
        const res = await fetch(GET_AI_REC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartItems: cart.map(i => i.name) })
        });
        
        if (!res.ok) throw new Error("Failed to fetch AI recs");
        const data = await res.json();
        
        if (data.success && data.recommendations) {
            let html = '';
            data.recommendations.forEach(rec => {
                let imgSrc = 'images/menu-1.png'; // Fallback image
                try {
                    // Try to find the image from the DOM button
                    const btn = document.querySelector(`.add-to-cart-btn[data-name="${rec.name.replace(/"/g, '\\"')}"]`);
                    if (btn && btn.dataset.image) {
                        imgSrc = btn.dataset.image;
                    }
                } catch (e) {
                    console.error("Could not find image for", rec.name);
                }
                
                let imgHtml = `<img src="${imgSrc}" alt="${rec.name}" class="ai-item-img">`;

                html += `
                    <div class="ai-item-card">
                        ${imgHtml}
                        <div class="ai-item-info">
                            <strong>${rec.name}</strong>
                            <p>${rec.reason}</p>
                        </div>
                        <button class="ai-item-btn" onclick="addToCartFromAI('${rec.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-plus"></i> Add
                        </button>
                    </div>
                `;
            });
            aiContent.innerHTML = html;
        } else {
            aiContainer.style.display = 'none';
        }
    } catch (error) {
        console.error("AI Rec Error:", error);
        aiContainer.style.display = 'none';
    }
}

window.addToCartFromAI = async function(name) {
    // Attempt to find price and image from DOM
    const btn = document.querySelector(`.add-to-cart-btn[data-name="${name}"]`);
    if (btn) {
        addToCart(name, parseInt(btn.dataset.price), btn.dataset.image);
    } else {
        // Fallback for missing item
        addToCart(name, 199, 'images/menu-1.png');
    }
};

async function checkout() {
    if (cart.length === 0) {
        showToast("Your cart is empty!", "error");
        return;
    }

    const name = document.getElementById('checkout-name').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();

    if (!name || !phone) {
        showToast("Please provide your name and phone number for checkout.", "error");
        return;
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
        // 1. Create order on the backend
        const orderRes = await fetch(CREATE_ORDER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                amount: totalAmount,
                customerName: name,
                phone: phone,
                items: cart.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image || ''
                }))
            })
        });

        if (!orderRes.ok) {
            const errData = await orderRes.json();
            throw new Error(errData.error || "Failed to create order on server.");
        }

        const orderData = await orderRes.json();
        
        // 2. Open Razorpay Checkout Popup
        const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: "INR",
            name: "Cafena Coffee Shop",
            description: "Freshly Brewed Premium Beverages",
            image: "images/logo.png",
            order_id: orderData.orderId,
            handler: async function (response) {
                try {
                    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

                    // 3. Verify payment + save order on the backend (Cloud Function)
                    const verifyRes = await fetch(VERIFY_PAYMENT_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            docId: orderData.docId
                        })
                    });

                    if (!verifyRes.ok) {
                        const verifyErr = await verifyRes.json();
                        throw new Error(verifyErr.error || "Payment signature verification failed.");
                    }

                    const verifyData = await verifyRes.json();

                    if (verifyData.success) {
                        showToast("Payment verified! Your order has been placed.", "success");
                        clearCart();
                        cartItem.classList.remove('active');
                        
                        // Clear customer info
                        document.getElementById('checkout-name').value = '';
                        document.getElementById('checkout-phone').value = '';
                    } else {
                        showToast("Payment verification failed: " + verifyData.error, "error");
                    }
                } catch (verifyError) {
                    console.error("Verification error:", verifyError);
                    showToast(verifyError.message, "error");
                } finally {
                    checkoutBtn.innerHTML = "Checkout Now";
                    checkoutBtn.disabled = false;
                }
            },
            prefill: {
                name: name,
                contact: phone
            },
            theme: {
                color: "#d3ad7f"
            },
            modal: {
                ondismiss: function () {
                    showToast("Payment checkout cancelled.", "error");
                    checkoutBtn.innerHTML = "Checkout Now";
                    checkoutBtn.disabled = false;
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error("Checkout error:", error);
        showToast(error.message || "Failed to start checkout. Please try again.", "error");
        checkoutBtn.innerHTML = "Checkout Now";
        checkoutBtn.disabled = false;
    }
}

function renderCart() {
    const cartList = document.getElementById('cart-list');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const cartBadge = document.getElementById('cart-badge');
    const checkoutFields = document.getElementById('cart-checkout-fields');

    if (!cartList || !cartTotalPrice || !cartBadge) return;

    cartList.innerHTML = '';

    if (cart.length === 0) {
        cartList.innerHTML = '<div class="empty-cart-message">Your cart is empty.</div>';
        cartTotalPrice.innerHTML = '&#8377;0';
        cartBadge.textContent = '0';
        cartBadge.style.display = 'none';
        if (checkoutFields) checkoutFields.style.display = 'none';
        return;
    }

    if (checkoutFields) checkoutFields.style.display = 'flex';

    let totalQty = 0;
    let totalVal = 0;

    cart.forEach(item => {
        totalQty += item.quantity;
        totalVal += (item.price * item.quantity);

        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';

        cartItemEl.innerHTML = `
            <span class="fas fa-trash-alt remove-item-btn" data-name="${item.name}"></span>
            <img src="${item.image}" alt="${item.name}">
            <div class="content">
                <h3>${item.name}</h3>
                <div class="price">&#8377;${item.price}</div>
                <div class="quantity-controller">
                    <button class="qty-btn dec-btn" data-name="${item.name}">-</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn inc-btn" data-name="${item.name}">+</button>
                </div>
            </div>
        `;

        cartList.appendChild(cartItemEl);
    });

    cartTotalPrice.innerHTML = `&#8377;${totalVal}`;
    cartBadge.textContent = totalQty;
    cartBadge.style.display = 'flex';

    // Add event listeners to dynamic buttons
    cartList.querySelectorAll('.dec-btn').forEach(btn => {
        btn.addEventListener('click', () => changeQuantity(btn.dataset.name, -1));
    });

    cartList.querySelectorAll('.inc-btn').forEach(btn => {
        btn.addEventListener('click', () => changeQuantity(btn.dataset.name, 1));
    });

    cartList.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', () => removeItem(btn.dataset.name));
    });
}

// Bind footer actions
const clearCartBtn = document.getElementById('clear-cart-btn');
const checkoutBtn = document.getElementById('checkout-btn');
if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);

// --- Addon Chip Click Handlers ---
document.querySelectorAll('.addon-chip[data-name]').forEach(chip => {
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', () => {
        const name = chip.dataset.name;
        const price = parseInt(chip.dataset.price);
        addToCart(name, price, 'images/about-img.jpeg');
    });
});

// --- Fetch & Render Firestore Menu Items ---
const categoryMeta = {
    'hot-coffee': { title: 'Classic Hot Coffee', icon: 'fas fa-coffee' },
    'hot-specials': { title: 'Hot Specials', icon: 'fas fa-mug-hot' },
    'iced-coffee': { title: 'Iced Coffee', icon: 'fas fa-glass-whiskey' },
    'iced-blended': { title: 'Iced Blended Coffee', icon: 'fas fa-blender' },
    'shakes': { title: 'Shakes', icon: 'fas fa-cocktail' },
    'signature': { title: 'Signature Drinks', icon: 'fas fa-star' },
    'others': { title: 'Others', icon: 'fas fa-glass-martini-alt' }
};

// Render categories order
const categoryOrder = [
    'hot-coffee',
    'hot-specials',
    'iced-coffee',
    'iced-blended',
    'shakes',
    'signature',
    'others'
];

async function loadMenu() {
    const dynamicMenu = document.getElementById('dynamic-menu');
    const menuLoader = document.getElementById('menu-loader');
    if (!dynamicMenu) return;

    try {
        const querySnapshot = await getDocs(collection(db, 'menu'));
        const rawItems = [];
        
        querySnapshot.forEach(doc => {
            rawItems.push(doc.data());
        });

        // Filter out unavailable items
        const items = rawItems.filter(item => item.isAvailable);

        // Group by category
        const groups = {};
        categoryOrder.forEach(cat => { groups[cat] = []; });
        
        items.forEach(item => {
            if (groups[item.category]) {
                groups[item.category].push(item);
            } else {
                // fallback if any category is not in list
                if (!groups['others']) groups['others'] = [];
                groups['others'].push(item);
            }
        });

        // Generate HTML
        let htmlStr = '';
        categoryOrder.forEach(catKey => {
            const list = groups[catKey];
            if (!list || list.length === 0) return;

            const meta = categoryMeta[catKey] || { title: 'Others', icon: 'fas fa-mug-hot' };

            htmlStr += `
                <div class="menu-category" data-category="${catKey}">
                    <div class="category-header">
                        <i class="${meta.icon}"></i>
                        <h2>${meta.title}</h2>
                    </div>
                    <div class="menu-items-grid">
            `;

            list.forEach(item => {
                // Determine badges
                let badgeHtml = '';
                if (item.isFeatured) {
                    badgeHtml = `<span class="badge badge-barista">&#9749; Barista Special</span>`;
                }

                const cleanNoteHtml = item.description ? `<span class="menu-card-note">${item.description}</span>` : '';

                htmlStr += `
                    <div class="menu-card animate-on-scroll fade-up">
                        <img src="${item.imageUrl}" alt="${item.name}" class="menu-card-img">
                        <div class="menu-card-info">
                            <h3>${item.name}</h3>
                            ${badgeHtml}
                            ${cleanNoteHtml}
                        </div>
                        <div class="menu-card-right">
                            <div class="menu-card-price">&#8377;${item.price}</div>
                            <button class="add-to-cart-btn" data-name="${item.name}" data-price="${item.price}" data-image="${item.imageUrl}" title="Add to Cart">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                `;
            });

            htmlStr += `
                    </div>
                </div>
            `;
        });

        dynamicMenu.innerHTML = htmlStr;
        if (menuLoader) menuLoader.style.display = 'none';

        // Bind Add to Cart listeners to dynamically created buttons
        dynamicMenu.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.getAttribute('data-name');
                const price = parseInt(btn.getAttribute('data-price'));
                const img = btn.getAttribute('data-image');
                addToCart(name, price, img);
            });
        });

        // Initialize filtering script globally defined in index.html
        if (window.initMenuFilter) {
            window.initMenuFilter();
        }

    } catch (error) {
        console.error("Error loading Firestore menu:", error);
        if (menuLoader) {
            menuLoader.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="color: #ff5733;"></i>
                <p>Failed to brew our menu. Please try again later.</p>
            `;
        }
    }
}

// --- Fetch & Render Firestore Blogs ---
async function loadBlogs() {
    const blogsContainer = document.getElementById('blogs-container');
    const blogsLoader = document.getElementById('blogs-loader');
    if (!blogsContainer) return;

    try {
        const blogsQuery = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(blogsQuery);
        
        let htmlStr = '';
        
        querySnapshot.forEach(doc => {
            const blog = doc.data();
            
            // Only show published blogs
            if (blog.isPublished === false) return;
            
            // Format Timestamp
            let dateStr = 'Recently';
            if (blog.createdAt) {
                const date = blog.createdAt.toDate ? blog.createdAt.toDate() : new Date(blog.createdAt);
                const options = { day: '2-digit', month: 'long', year: 'numeric' };
                dateStr = date.toLocaleDateString('en-US', options).toLowerCase();
            }

            htmlStr += `
                <div class="box animate-on-scroll fade-up">
                    <div class="image">
                        <img src="${blog.imageUrl}" alt="${blog.title}">
                    </div>
                    <div class="content">
                        <a href="#" class="title">${blog.title}</a>
                        <span>by ${blog.author} / ${dateStr}</span>
                        <p>${blog.excerpt}</p>
                        <a href="#" class="btn read-blog-btn" data-slug="${blog.slug}">read more</a>
                    </div>
                </div>
            `;
        });

        if (blogsLoader) blogsLoader.remove();
        blogsContainer.innerHTML += htmlStr;

        // Bind read-more blog clicks
        blogsContainer.querySelectorAll('.read-blog-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showToast("Full blog view is coming soon!", "success");
            });
        });

    } catch (error) {
        console.error("Error loading Firestore blogs:", error);
        if (blogsLoader) {
            blogsLoader.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="color: #ff5733;"></i>
                <p>Failed to load blogs. Please try again later.</p>
            `;
        }
    }
}

// --- Submit Reservation Form ---
function initReservationForm() {
    const form = document.getElementById('reservation-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('res-name').value.trim();
        const phone = document.getElementById('res-phone').value.trim();
        const date = document.getElementById('res-date').value;
        const time = document.getElementById('res-time').value;
        const guests = parseInt(document.getElementById('res-guests').value);

        if (!name || !phone || !date || !time || isNaN(guests)) {
            showToast("Please fill in all reservation fields.", "error");
            return;
        }

        const submitBtn = form.querySelector('input[type="submit"]');
        submitBtn.value = "booking...";
        submitBtn.disabled = true;

        try {
            await addDoc(collection(db, 'reservations'), {
                name,
                phone,
                date,
                time,
                guests,
                status: "pending",
                createdAt: serverTimestamp()
            });

            showToast(`Table booked successfully for ${name}!`, "success");
            form.reset();
        } catch (error) {
            console.error("Error booking reservation:", error);
            showToast("Failed to book table. Please check connection and try again.", "error");
        } finally {
            submitBtn.value = "book now";
            submitBtn.disabled = false;
        }
    });
}

// --- Submit Contact Form ---
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();

        if (!name || !email || !message) {
            showToast("Please fill in all contact fields.", "error");
            return;
        }

        const submitBtn = form.querySelector('input[type="submit"]');
        submitBtn.value = "sending...";
        submitBtn.disabled = true;

        try {
            await addDoc(collection(db, 'contactMessages'), {
                name,
                email,
                message,
                isRead: false,
                createdAt: serverTimestamp()
            });

            showToast("Message sent! We will contact you soon.", "success");
            form.reset();
        } catch (error) {
            console.error("Error sending contact message:", error);
            showToast("Failed to send message. Please check connection and try again.", "error");
        } finally {
            submitBtn.value = "contact now";
            submitBtn.disabled = false;
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    loadMenu();
    loadBlogs();
    initReservationForm();
    initContactForm();

    // Bind static product buttons
    document.querySelectorAll('.product-add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const name = btn.getAttribute('data-name');
            const price = parseInt(btn.getAttribute('data-price'));
            const img = btn.getAttribute('data-image');
            addToCart(name, price, img);
        });
    });

    // Add functionality for heart and eye buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (btn.classList.contains('fa-heart')) {
                // Toggle wishlist state
                btn.classList.toggle('active-heart');
                if (btn.classList.contains('active-heart')) {
                    btn.style.color = '#d3ad7f'; // Cafena theme color
                    showToast("Added to your wishlist!", "success");
                } else {
                    btn.style.color = '#fff';
                    showToast("Removed from wishlist.", "success");
                }
            } else if (btn.classList.contains('fa-eye')) {
                // Quick view (show details in toast)
                const cartBtn = btn.parentElement.querySelector('.product-add-to-cart');
                if (cartBtn) {
                    const name = cartBtn.getAttribute('data-name');
                    const price = cartBtn.getAttribute('data-price');
                    showToast(`Quick View: ${name} is available for ₹${price}.`, "success");
                }
            }
        });
    });

    // --- Scroll Animations Observer ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Only animate once per page load
            }
        });
    }, observerOptions);

    // Observe existing static elements
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        scrollObserver.observe(el);
    });

    // Automatically observe newly added elements (for dynamic Firestore menu/blogs)
    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    if (node.classList.contains('animate-on-scroll')) {
                        scrollObserver.observe(node);
                    }
                    node.querySelectorAll('.animate-on-scroll').forEach(child => {
                        scrollObserver.observe(child);
                    });
                }
            });
        });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
});