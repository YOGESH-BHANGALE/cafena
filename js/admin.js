import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query, 
    orderBy,
    serverTimestamp
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// --- Authentication State Observer ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Logged in
        loginScreen.style.display = 'none';
        dashboardScreen.style.display = 'flex';
        loadDashboardData();
    } else {
        // Logged out
        loginScreen.style.display = 'flex';
        dashboardScreen.style.display = 'none';
    }
});

// --- Login Logic ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    
    btn.textContent = "Logging in...";
    btn.disabled = true;
    loginError.style.display = 'none';

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = error.message;
        loginError.style.display = 'block';
    } finally {
        btn.textContent = "Secure Login";
        btn.disabled = false;
    }
});

// --- Logout Logic ---
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- Tab Switching Logic ---
document.querySelectorAll('.nav-links li').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs
        document.querySelectorAll('.nav-links li').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
    });
});

// --- Dashboard Data Loading ---
function loadDashboardData() {
    loadOrders();
    loadMessages();
    loadMenu();
    loadBlogs();
    loadReservations();
}

// 1. Load Orders
async function loadOrders() {
    const tbody = document.getElementById('orders-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loader"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    
    try {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        let html = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'N/A';
            const statusClass = data.status === 'paid' ? 'paid' : 'pending';
            
            let itemsHtml = data.items.map(i => `${i.quantity}x ${i.name}`).join('<br>');
            
            html += `
                <tr>
                    <td>${date}</td>
                    <td>${data.customerName}</td>
                    <td>${data.phone}</td>
                    <td>${itemsHtml}</td>
                    <td>&#8377;${data.totalAmount}</td>
                    <td><span class="badge ${statusClass}">${data.status}</span></td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;">No orders found.</td></tr>';
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:#ff5733;">Error loading orders: ${error.message}</td></tr>`;
    }
}

// 2. Load Messages
async function loadMessages() {
    const tbody = document.getElementById('messages-table-body');
    tbody.innerHTML = '<tr><td colspan="4" class="loader"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    
    try {
        const q = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        let html = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'N/A';
            html += `
                <tr>
                    <td>${date}</td>
                    <td>${data.name}</td>
                    <td>${data.email}</td>
                    <td>${data.message}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center;">No messages found.</td></tr>';
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:#ff5733;">Error loading messages: ${error.message}</td></tr>`;
    }
}

// 3. Load Menu & Add New Menu Item
async function loadMenu() {
    const tbody = document.getElementById('menu-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loader"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'menu'));
        let html = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const statusStr = data.isAvailable ? '<span style="color:#28a745;">Available</span>' : '<span style="color:#ffc107;">Unavailable</span>';
            
            html += `
                <tr>
                    <td><img src="${data.imageUrl}" width="50" style="border-radius: 4px;" onerror="this.src='images/placeholder.png'"></td>
                    <td>${data.name}</td>
                    <td>${data.category}</td>
                    <td>&#8377;${data.price}</td>
                    <td>${statusStr}</td>
                    <td>
                        <button class="btn-primary toggle-menu-btn" data-id="${doc.id}" data-status="${data.isAvailable}">Toggle Stock</button>
                        <button class="btn-danger delete-menu-btn" data-id="${doc.id}">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;">No menu items found.</td></tr>';
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:#ff5733;">Error loading menu: ${error.message}</td></tr>`;
    }
}

// Menu Action Delegation
document.getElementById('menu-table-body').addEventListener('click', async (e) => {
    if (e.target.classList.contains('toggle-menu-btn')) {
        const id = e.target.getAttribute('data-id');
        const currentStatus = e.target.getAttribute('data-status') === 'true';
        e.target.disabled = true;
        try {
            await updateDoc(doc(db, 'menu', id), { isAvailable: !currentStatus });
            loadMenu();
        } catch (error) {
            alert("Error toggling stock: " + error.message);
            e.target.disabled = false;
        }
    } else if (e.target.classList.contains('delete-menu-btn')) {
        const id = e.target.getAttribute('data-id');
        if (confirm("Are you sure you want to permanently delete this menu item?")) {
            e.target.disabled = true;
            try {
                await deleteDoc(doc(db, 'menu', id));
                loadMenu();
            } catch (error) {
                alert("Error deleting item: " + error.message);
                e.target.disabled = false;
            }
        }
    }
});

document.getElementById('add-menu-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Adding...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, 'menu'), {
            name: document.getElementById('menu-name').value,
            category: document.getElementById('menu-category').value,
            price: parseInt(document.getElementById('menu-price').value),
            imageUrl: document.getElementById('menu-image').value,
            description: document.getElementById('menu-desc').value,
            isAvailable: true,
            isFeatured: false,
            createdAt: serverTimestamp()
        });
        alert("Menu item added successfully!");
        e.target.reset();
        loadMenu(); // Refresh table
    } catch (error) {
        alert("Error adding item: " + error.message);
    } finally {
        btn.textContent = "Add Item to Menu";
        btn.disabled = false;
    }
});

// 4. Load Blogs
async function loadBlogs() {
    const tbody = document.getElementById('blogs-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loader"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    
    try {
        const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        let html = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            const statusStr = data.isPublished ? '<span style="color:#28a745;">Published</span>' : '<span style="color:#ffc107;">Draft</span>';
            html += `
                <tr>
                    <td>${date}</td>
                    <td><img src="${data.imageUrl}" width="50" style="border-radius: 4px;"></td>
                    <td>${data.title}</td>
                    <td>${data.author}</td>
                    <td>${data.excerpt} <br> ${statusStr}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;">No blogs found.</td></tr>';
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#ff5733;">Error loading blogs: ${error.message}</td></tr>`;
    }
}

document.getElementById('add-blog-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, 'blogs'), {
            title: document.getElementById('blog-title').value,
            author: document.getElementById('blog-author').value,
            imageUrl: document.getElementById('blog-image').value,
            excerpt: document.getElementById('blog-excerpt').value,
            content: document.getElementById('blog-content').value,
            isPublished: document.getElementById('blog-status').value === 'published',
            createdAt: serverTimestamp()
        });
        alert("Blog saved successfully!");
        e.target.reset();
        loadBlogs();
    } catch (error) {
        alert("Error saving blog: " + error.message);
    } finally {
        btn.textContent = "Save Blog";
        btn.disabled = false;
    }
});

// 5. Load Reservations
async function loadReservations() {
    const tbody = document.getElementById('reservations-table-body');
    tbody.innerHTML = '<tr><td colspan="7" class="loader"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    
    try {
        const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        let html = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'N/A';
            let statusClass = 'pending';
            if (data.status === 'approved') statusClass = 'paid'; // green
            if (data.status === 'declined') statusClass = 'pending'; // red/orange
            
            html += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${data.date} at ${data.time}</td>
                    <td>${data.name}</td>
                    <td>${data.phone}</td>
                    <td>${data.guests}</td>
                    <td><span class="badge ${statusClass}">${data.status}</span></td>
                    <td>
                        <button class="btn-primary approve-res-btn" data-id="${doc.id}">Approve</button>
                        <button class="btn-danger decline-res-btn" data-id="${doc.id}">Decline</button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;">No reservations found.</td></tr>';
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#ff5733;">Error loading reservations: ${error.message}</td></tr>`;
    }
}

document.getElementById('reservations-table-body').addEventListener('click', async (e) => {
    if (e.target.classList.contains('approve-res-btn')) {
        const id = e.target.getAttribute('data-id');
        e.target.disabled = true;
        try {
            await updateDoc(doc(db, 'reservations', id), { status: 'approved' });
            loadReservations();
        } catch (error) {
            alert("Error updating status: " + error.message);
            e.target.disabled = false;
        }
    } else if (e.target.classList.contains('decline-res-btn')) {
        const id = e.target.getAttribute('data-id');
        e.target.disabled = true;
        try {
            await updateDoc(doc(db, 'reservations', id), { status: 'declined' });
            loadReservations();
        } catch (error) {
            alert("Error updating status: " + error.message);
            e.target.disabled = false;
        }
    }
});
