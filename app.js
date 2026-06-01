// BACKEND CONFIGURATION: Tempel tautan URL Google Apps Script Web App Anda di sini untuk sinkronisasi cloud
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwcOGKVW_HwH-DQP6RTttFNNbqeYCDI-sxeWKTfJUQwlZ8J_W2uukHWfzcWUx60R0M9YA/exec";

// STATE VARIABEL & DATABASE LOCAL MEMORY
let currentCashier = "";
let selectedServiceId = null;
let isNewCustomerMode = false;

let services = [
    { id: 'S1', name: 'Cuci Kering + Setrika', price: 8000, type: 'Kiloan', icon: 'fa-soap' },
    { id: 'S2', name: 'Setrika Saja Express', price: 5000, type: 'Kiloan', icon: 'fa-iron' },
    { id: 'S3', name: 'Bed Cover Large', price: 35000, type: 'Satuan', icon: 'fa-mattress-pillow' }
];

let customers = [
    { id: 'C1', name: 'Budi Santoso', phone: '628123456789' },
    { id: 'C2', name: 'Siti Rahma', phone: '628987654321' }
];

let paymentMethods = ['Tunai / Cash', 'QRIS', 'Transfer Bank'];

// PASTI KAN STRUKTUR BAWAAN DI ATAS FILE app.js SUDAH LENGKAP SEPERTI INI
let orders = [
    { 
        id: 'FRS-4821', 
        customer: 'Budi Santoso', 
        phone: '628123456789', 
        service: 'Cuci Kering + Setrika (2 Kg)', 
        total: 16000, 
        cashier: 'Sistem', 
        status: 'Diproses', 
        method: 'Tunai / Cash', 
        paymentStatus: 'Lunas', // 💡 Pastikan baris ini ada di data dummy
        date: new Date().toISOString() 
    }
];


// SESSION CONTROL LOGIC (SEKARANG SUDAH MENDETEKSI JALUR PELANGGAN SEJAK AWAL DIMUAT)
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get('order');
    
    // Jika ada parameter order, JANGAN jalankan fungsi login admin/kasir
    if (orderParam) {
        console.log("Aplikasi dibuka oleh pelanggan, bypass gerbang login admin.");
        return; 
    }

    // Jika TIDAK ADA parameter order, jalankan pengecekan sesi kasir seperti biasa
    const savedCashier = localStorage.getItem('active_cashier');
    if (savedCashier) {
        currentCashier = savedCashier;
        showMainApp();
    }
});

// 1. DAFTAR PIN KASIR AKUN RESMI (Kamu bisa ubah nama & PIN di bawah ini sesuai kebutuhan)
const CASHIER_ACCOUNTS = {
    "owner": "1234",
    "admin": "1234",
    "kasir1": "1234"
};

function submitLogin() {
    const nameInput = document.getElementById('input-cashier-name').value.trim();
    const pinInput = document.getElementById('input-input-pin') ? document.getElementById('input-input-pin').value : (document.getElementById('input-cashier-pin') ? document.getElementById('input-cashier-pin').value.trim() : "");
    
    if(!nameInput) return alert('Nama kasir wajib dimasukkan!');
    if(!pinInput) return alert('PIN keamanan wajib dimasukkan!');

    // 2. PROSES VALIDASI PIN SECARA LOKAL
    // Cari apakah nama kasir terdaftar di database akun kita
    const correctPin = CASHIER_ACCOUNTS[nameInput];

    if (correctPin && pinInput === correctPin) {
        // JIKA PIN COCOK: Izinkan masuk ke aplikasi
        currentCashier = nameInput;
        localStorage.setItem('active_cashier', currentCashier);
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('display-cashier').innerText = currentCashier;
        
        // Bersihkan form login agar aman
        document.getElementById('input-cashier-name').value = '';
        if(document.getElementById('input-cashier-pin')) document.getElementById('input-cashier-pin').value = '';
        
        renderServicesGrid();
        populateDropdowns();
        renderOrders();
        calculateFinance();
        
        setTimeout(function() { loadDataFromCloud(); }, 1000);
        triggerNotification(`Selamat bertugas, ${currentCashier}! 👋`);
    } else {
        // JIKA PIN SALAH ATAU USER TIDAK ADA
        alert('❌ Kombinasi Nama Kasir atau PIN Rahasia Salah! Akses ditolak.');
    }
}

function showMainApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('display-cashier').innerText = currentCashier;
    
    renderServicesGrid();
    populateDropdowns();
    renderOrders();
    calculateFinance();

    // Beri jeda aman sebelum sinkronisasi cloud dimulai jika auto-login aktif
    setTimeout(function() {
        loadDataFromCloud();
    }, 1000);
}

function logoutCashier() {
    localStorage.removeItem('active_cashier');
    location.reload();
}

// AMBIL DATA DARI GOOGLE SPREADSHEET (ANTI-HILANG SETELAH LOGOUT / REFRESH)
function loadDataFromCloud() {
    if (SCRIPT_URL === "" || SCRIPT_URL.includes("TEMPEL_URL")) return;
    
    console.log("Sedang menyelaraskan data dengan Google Sheets...");

    fetch(`${SCRIPT_URL}?action=read`)
        .then(response => response.json())
        .then(cloudData => {
            if (!cloudData || cloudData.error) return;

            // 1. SINKRONISASI DAFTAR LAYANAN CUSTOM
            if (cloudData.customServices && cloudData.customServices.length > 0) {
                const defaultIds = ['S1', 'S2', 'S3'];
                const filteredCustom = cloudData.customServices.filter(s => !defaultIds.includes(s.id));
                services = [
                    { id: 'S1', name: 'Cuci Kering + Setrika', price: 8000, type: 'Kiloan', icon: 'fa-soap' },
                    { id: 'S2', name: 'Setrika Saja Express', price: 5000, type: 'Kiloan', icon: 'fa-iron' },
                    { id: 'S3', name: 'Bed Cover Large', price: 35000, type: 'Satuan', icon: 'fa-mattress-pillow' },
                    ...filteredCustom
                ];
            }

            // 2. SINKRONISASI DAFTAR TRANSAKSI & EKSTRAK NAMA PELANGGAN
if (cloudData.transactions && cloudData.transactions.length > 0) {
    orders = cloudData.transactions.map(t => {
        return {
            id: t.id,
            customer: t.customer,
            phone: t.phone,
            service: t.service,
            total: Number(t.total),
            cashier: t.cashier,
            method: t.method,
            status: t.status,
            // 💡 PASTIKAN BARIS INI MEMBACA VARIABEL 't.paymentStatus' DARI GOOGLE SHEETS
            paymentStatus: t.paymentStatus ? t.paymentStatus : 'Lunas', 
            date: t.date ? t.date : new Date().toISOString() 
        };
    });
                // ========================================================
                // OTOMATISASI: Ambil daftar nama pelanggan dari database Cloud
                // ========================================================
                const uniqueCustomerNames = new Set();
                const tempCustomers = [];

                // Masukkan pelanggan default bawaan script terlebih dahulu
                const defaultCustomers = [
                    { id: 'C1', name: 'Budi Santoso', phone: '628123456789' },
                    { id: 'C2', name: 'Siti Rahma', phone: '628987654321' }
                ];
                
                defaultCustomers.forEach(c => {
                    uniqueCustomerNames.add(c.name.trim().toLowerCase());
                    tempCustomers.push(c);
                });

                // Scan semua nota transaksi dari cloud, ambil nama pelanggan baru jika belum terdaftar
                orders.forEach(order => {
                    if (order.customer && order.customer.trim() !== "") {
                        const normalName = order.customer.trim();
                        const lowerName = normalName.toLowerCase();
                        
                        if (!uniqueCustomerNames.has(lowerName)) {
                            uniqueCustomerNames.add(lowerName);
                            tempCustomers.push({
                                id: `C${tempCustomers.length + 1}`,
                                name: normalName,
                                phone: order.phone || '628123456789'
                            });
                        }
                    }
                });

                // Perbarui database array pelanggan lokal dengan data terkini
                customers = tempCustomers;
            }

            // 3. RE-RENDER INTERFACE SECARA MENYELURUH
            renderServicesGrid();
            populateDropdowns(); // <-- PENTING: Mengisi kembali dropdown pelanggan dengan data terbaru
            renderOrders();
            calculateFinance();
            console.log("Sinkronisasi database sukses!");
        })
        .catch(err => {
            console.error("Gagal sinkron data cloud:", err);
            renderServicesGrid();
            populateDropdowns(); 
            renderOrders();
            calculateFinance();
        });
}


// VIEW VIEWPORT CONTROL
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('theme-color'));
    
    const clickedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('onclick').includes(viewId));
    if(clickedBtn) clickedBtn.classList.add('theme-color');
}

// SERVICE MANAGEMENT BUSINESS LOGIC
function openNewServiceModal() {
    document.getElementById('serviceModal').classList.remove('hidden');
}

function saveNewService() {
    const name = document.getElementById('new-service-name').value.trim();
    const price = parseFloat(document.getElementById('new-service-price').value);
    const type = document.getElementById('new-service-type').value;

    if(!name || !price) return alert('Data input menu belum lengkap!');

    const newId = `S${services.length + 1}`;
    const newServicePayload = { id: newId, name, price, type, icon: 'fa-box-tissue' };
    
    services.push(newServicePayload);
    renderServicesGrid();
    document.getElementById('serviceModal').classList.add('hidden');
    
    // KONEKSI PUSH CLOUD: Kirim menu layanan baru langsung ke Google Sheets
    if(SCRIPT_URL !== "" && !SCRIPT_URL.includes("SCRIPT_URL")) {
        const payloadToSend = {
            action: "addService",
            id: newServicePayload.id,
            name: newServicePayload.name,
            price: newServicePayload.price,
            type: newServicePayload.type
        };

        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payloadToSend)
        }).catch(err => console.log("Gagal sinkron menu baru ke cloud:", err));
    }
    
    document.getElementById('new-service-name').value = '';
    document.getElementById('new-service-price').value = '';
    triggerNotification(`Menu layanan "${name}" sukses ditambahkan ke daftar kasir & database cloud!`);
}

function renderServicesGrid() {
    const grid = document.getElementById('services-grid');
    if(!grid) return;
    grid.innerHTML = '';
    services.forEach(item => {
        const isActive = item.id === selectedServiceId;
        const activeClasses = isActive ? 'border-2 border-[#40E0D0] bg-cyan-50/50 scale-[0.99]' : 'border-slate-100 bg-white hover:border-cyan-200';
        
        // Cek apakah ini menu custom dari database (selain S1, S2, S3)
        const isCustomMenu = !['S1', 'S2', 'S3'].includes(item.id);

        grid.innerHTML += `
            <div onclick="selectServiceToCart('${item.id}')" class="bg-white p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-36 relative ${activeClasses}">
                ${isActive ? '<span class="absolute top-3 right-3 text-xs theme-color"><i class="fa-solid fa-circle-check"></i></span>' : ''}
                
                ${isCustomMenu && !isActive ? `
                    <div class="absolute top-3 right-3 flex gap-2 z-20">
                        <button onclick="event.stopPropagation(); openEditServiceModal('${item.id}')" class="text-[10px] text-amber-500 bg-amber-50 w-6 h-6 rounded-full hover:bg-amber-100 flex items-center justify-center" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="event.stopPropagation(); deleteServiceFromPOS('${item.id}')" class="text-[10px] text-rose-500 bg-rose-50 w-6 h-6 rounded-full hover:bg-rose-100 flex items-center justify-center" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                    </div>
                ` : ''}

                <div class="flex justify-between items-start">
                    <span class="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">${item.type}</span>
                    ${!isActive && !isCustomMenu ? `<i class="fa-solid ${item.icon} text-slate-300 text-base"></i>` : '<div class="w-2"></div>'}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-xs mb-0.5 line-clamp-1">${item.name}</h4>
                    <p class="text-sm font-bold theme-color">Rp ${item.price.toLocaleString('id-ID')}</p>
                </div>
            </div>`;
    });
}

// FUNGSI CONTROL MODAL EDIT LAYANAN
function openEditServiceModal(id) {
    const match = services.find(s => s.id === id);
    if (!match) return;

    document.getElementById('edit-service-id').value = match.id;
    document.getElementById('edit-service-name').value = match.name;
    document.getElementById('edit-service-price').value = match.price;
    document.getElementById('edit-service-type').value = match.type;

    document.getElementById('editServiceModal').classList.remove('hidden');
}

function closeEditServiceModal() {
    document.getElementById('editServiceModal').classList.add('hidden');
}

// EKSEKUSI PROSES UPDATE LAYANAN (DARI WEB KE GOOGLE SHEETS)
function submitEditService() {
    const id = document.getElementById('edit-service-id').value;
    const name = document.getElementById('edit-service-name').value.trim();
    const price = parseFloat(document.getElementById('edit-service-price').value);
    const type = document.getElementById('edit-service-type').value;

    if (!name || isNaN(price)) return alert('Data pengubahan belum lengkap!');

    const idx = services.findIndex(s => s.id === id);
    if (idx !== -1) {
        // 1. Ganti data lokal di web kasir
        services[idx].name = name;
        services[idx].price = price;
        services[idx].type = type;
        renderServicesGrid();
        closeEditServiceModal();

        // 2. Kirim update ke Google Sheets
        if (SCRIPT_URL !== "" && !SCRIPT_URL.includes("TEMPEL_URL")) {
            const editPayload = { action: "editService", id, name, price, type };
            fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(editPayload)
            }).catch(err => console.log(err));
        }
        triggerNotification(`Layanan "${name}" berhasil diperbarui!`);
    }
}

// EKSEKUSI PROSES HAPUS LAYANAN (MUTLAK DUA ARAH)
function deleteServiceFromPOS(id) {
    const match = services.find(s => s.id === id);
    if (!match) return;

    if (confirm(`Apakah Anda yakin ingin menghapus layanan "${match.name}" dari daftar kasir dan database cloud secara permanen?`)) {
        // 1. Hapus secara lokal dari array
        services = services.filter(s => s.id !== id);
        renderServicesGrid();

        // 2. Kirim perintah hapus ke Google Sheets
        if (SCRIPT_URL !== "" && !SCRIPT_URL.includes("TEMPEL_URL")) {
            const deletePayload = { action: "deleteService", id };
            fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(deletePayload)
            }).catch(err => console.log(err));
        }
        triggerNotification(`Layanan "${match.name}" telah dihapus.`);
    }
}

function populateDropdowns() {
    const custDropdown = document.getElementById('cart-customer');
    const payDropdown = document.getElementById('cart-payment');
    
    if(custDropdown && customers) {
        custDropdown.innerHTML = customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }
    if(payDropdown && paymentMethods) {
        payDropdown.innerHTML = paymentMethods.map(p => `<option value="${p}">${p}</option>`).join('');
    }
}

// HITUNG INPUT BERAT TIMBANGAN KILOAN / PCS SECARA DESIMAL & DINAMIS
function selectServiceToCart(id) {
    selectedServiceId = id;
    renderServicesGrid(); 
    
    const selected = services.find(s => s.id === id);
    
    document.getElementById('cart-items').innerHTML = `
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center w-full">
            <div>
                <p class="font-bold text-slate-700 text-xs">${selected.name}</p>
                <p class="text-[10px] text-slate-400">Harga: Rp ${selected.price.toLocaleString('id-ID')} / ${selected.type === 'Kiloan' ? 'Kg' : 'Pcs'}</p>
            </div>
            <span class="font-bold text-slate-400 text-xs">${selected.type}</span>
        </div>
    `;

    const isKiloan = selected.type === 'Kiloan';
    document.getElementById('cart-qty-wrapper').innerHTML = `
        <div class="mt-3 bg-cyan-50/40 p-3 rounded-xl border border-cyan-100/50 flex items-center justify-between gap-4">
            <label class="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                ${isKiloan ? '⚖️ Berat Timbangan (Kg)' : '🔢 Jumlah Barang (Pcs)'}
            </label>
            <input type="number" id="cart-input-qty" value="1" min="0.1" step="${isKiloan ? '0.1' : '1'}" 
                oninput="updateCartTotal()" 
                class="w-24 bg-white border border-slate-200 rounded-lg p-2 text-center text-xs font-bold text-slate-800 outline-none focus:border-cyan-400">
        </div>
    `;

    updateCartTotal();
}

function updateCartTotal() {
    if (!selectedServiceId) return 0;
    
    const selected = services.find(s => s.id === selectedServiceId);
    const qtyInput = document.getElementById('cart-input-qty');
    const qty = qtyInput ? parseFloat(qtyInput.value) : 1;
    
    if (isNaN(qty) || qty <= 0) {
        document.getElementById('cart-total').innerText = "Rp 0";
        return 0;
    }

    const totalHarga = selected.price * qty;
    document.getElementById('cart-total').innerText = `Rp ${totalHarga.toLocaleString('id-ID')}`;
    return totalHarga;
}

// TOGGLE INPUT PENDAFTARAN PELANGGAN BARU (VERSI TOMBOL BESAR)
function toggleNewCustomerInput() {
    const wrapperExisting = document.getElementById('wrapper-existing-cust');
    const wrapperNew = document.getElementById('wrapper-new-cust');
    const btnToggle = document.getElementById('btn-toggle-cust');

    isNewCustomerMode = !isNewCustomerMode;

    if (isNewCustomerMode) {
        wrapperExisting.classList.add('hidden');
        wrapperNew.classList.remove('hidden');
        btnToggle.innerHTML = '<i class="fa-solid fa-user-check"></i> Gunakan Member Lama';
        btnToggle.className = "w-full bg-rose-50 border border-rose-100 text-rose-500 text-xs font-bold py-3.5 px-4 rounded-xl shadow-xs hover:bg-rose-100/60 transition-all flex justify-center items-center gap-2";
    } else {
        wrapperExisting.classList.remove('hidden');
        wrapperNew.classList.add('hidden');
        btnToggle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Tambah Pelanggan Baru';
        btnToggle.className = "w-full bg-cyan-50 border border-cyan-100 theme-color text-xs font-bold py-3.5 px-4 rounded-xl shadow-xs hover:bg-cyan-100/60 transition-all flex justify-center items-center gap-2";
    }
}

// PROSES EKSEKUSI TRANSAKSI CHECKOUT NOTA KASIR
function processCheckout() {
    if(!selectedServiceId) return triggerNotification('Pilih salah satu kartu layanan terlebih dahulu!');
    
    const selected = services.find(s => s.id === selectedServiceId);
    const payMethod = document.getElementById('cart-payment').value;
    const qtyInput = document.getElementById('cart-input-qty');
    const qty = qtyInput ? parseFloat(qtyInput.value) : 1;

    if (isNaN(qty) || qty <= 0) return alert('Berat atau Jumlah item tidak valid!');
    
    const totalHargaAkhir = selected.price * qty;
    const generatedOrderId = `FRS-${Math.floor(1000 + Math.random() * 9000)}`;
    
    let customerName = "";
    let customerPhone = "";

    if (isNewCustomerMode) {
        const inputName = document.getElementById('new-cust-name').value.trim();
        const inputPhone = document.getElementById('new-cust-phone').value.trim();

        if (!inputName || !inputPhone) return alert('Nama dan No. WhatsApp pelanggan baru wajib diisi!');
        
        customerName = inputName;
        customerPhone = inputPhone.startsWith('0') ? '62' + inputPhone.slice(1) : inputPhone;

        customers.push({ id: `C${customers.length + 1}`, name: customerName, phone: customerPhone });
        populateDropdowns();
    } else {
        customerName = document.getElementById('cart-customer').value;
        const targetCust = customers.find(c => c.name === customerName);
        customerPhone = targetCust ? targetCust.phone : "628123456789";
    }

    const serviceDetailLabel = `${selected.name} (${qty} ${selected.type === 'Kiloan' ? 'Kg' : 'Pcs'})`;

    // 💡 PENGAMAN AMAN: Jika elemen dropdown tidak ditemukan di HTML, otomatis set 'Lunas'
    let selectedPaymentStatus = "Lunas";
    const statusDropdown = document.getElementById('cart-payment-status');
    if (statusDropdown) {
        selectedPaymentStatus = statusDropdown.value;
    }

    const checkoutPayload = {
        id: generatedOrderId,
        customer: customerName,
        phone: customerPhone,
        service: serviceDetailLabel, 
        total: totalHargaAkhir,
        cashier: currentCashier || "Kasir",
        method: payMethod,
        status: 'Diproses',
        paymentStatus: selectedPaymentStatus, // Menggunakan hasil seleksi dropdown aman
        date: new Date().toISOString()
    };

    orders.unshift(checkoutPayload);
    renderOrders();
    calculateFinance();
    openReceiptModal(checkoutPayload);

    if(SCRIPT_URL !== "" && !SCRIPT_URL.includes("SCRIPT_URL")) {
        fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(checkoutPayload) 
        }).catch(err => console.log("Gagal sinkronisasi cloud:", err));
    }

    selectedServiceId = null;
    if (isNewCustomerMode) toggleNewCustomerInput();
    document.getElementById('new-cust-name').value = '';
    document.getElementById('new-cust-phone').value = '';
    renderServicesGrid();
    document.getElementById('cart-items').innerHTML = '<span class="text-center italic text-slate-400 py-2 text-xs">Silahkan pilih produk di atas...</span>';
    if(document.getElementById('cart-qty-wrapper')) document.getElementById('cart-qty-wrapper').innerHTML = ''; 
    document.getElementById('cart-total').innerText = "Rp 0";
    
    triggerNotification(`Nota ${generatedOrderId} berhasil diproses!`);
}

// PREVIEW STRUK NOTA KASIR & QR BARCODE SVG GENERATOR
// =========================================================================
// SINKRONISASI TAMPILAN PREVIEW STRUK DI LAYAR WEBSITE (ANTI-STRIP)
// =========================================================================
function openReceiptModal(order) {
    document.getElementById('nota-date').innerText = new Date(order.date).toLocaleString('id-ID');
    document.getElementById('nota-id').innerText = order.id;
    document.getElementById('nota-cashier').innerText = order.cashier;
    document.getElementById('nota-customer').innerText = order.customer;
    document.getElementById('nota-service').innerText = order.service;
    document.getElementById('nota-price').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    
    // 💡 FIX METODE PEMBAYARAN DI LAYAR: Cek semua variasi ID elemen (nota-paymethod atau nota-payMethod)
    const elementPay = document.getElementById('nota-paymethod') || document.getElementById('nota-payMethod');
    if (elementPay) {
        elementPay.innerText = order.method || "Tunai / Cash";
    }

    // 💡 FIX STATUS PEMBAYARAN DI LAYAR: Tembak data status dari transaksi aktif
    if(document.getElementById('nota-payment-status')) {
        document.getElementById('nota-payment-status').innerText = order.paymentStatus || 'Lunas';
    }

    document.getElementById('nota-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    
 


    document.getElementById('track-id').innerText = order.id;
    document.getElementById('track-cust').innerText = order.customer;
    document.getElementById('track-service').innerText = order.service;
    document.getElementById('track-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    document.getElementById('track-badge').innerText = order.status.toUpperCase();

    // Menggunakan link GitHub Pages asli untuk QR Code pelacakan konsumen
    const generatedTrackingUrl = `https://gampil.github.io/foresa?order=${order.id}`;
    
    // GENERATOR FORMAT SVG MURNI
    document.getElementById("qrcode").innerHTML = "";
    const qrcodeSvg = new QRCode({
        content: generatedTrackingUrl,
        padding: 0,
        width: 80,
        height: 80,
        color: "#000000",
        background: "#ffffff",
        ecl: "L"
    }).svg();
    
    document.getElementById("qrcode").innerHTML = qrcodeSvg;
    document.getElementById('receiptModal').classList.remove('hidden');
}

function openReceiptModalById(id) {
    const match = orders.find(o => o.id === id);
    if(match) openReceiptModal(match);
}

function sendWhatsAppReceipt() {
    const id = document.getElementById('nota-id').innerText;
    const customer = document.getElementById('nota-customer').innerText;
    const total = document.getElementById('nota-total').innerText;
    
    // 💡 1. CARI DATA NOTA AKTIF DI DATABASE UNTUK MENGAMBIL NOMOR HP-NYA
    let customerPhone = "";
    const currentOrderData = orders.find(o => o.id === id);
    if (currentOrderData && currentOrderData.phone) {
        customerPhone = currentOrderData.phone.trim();
        
        // Bersihkan nomor jika pelanggan ngetik pake tanda '+', Spasi, atau Strip
        customerPhone = customerPhone.replace(/[-+ _]/g, "");
        
        // Otomatis ubah angka '0' di depan menjadi kode Indonesia '62'
        if (customerPhone.startsWith("0")) {
            customerPhone = "62" + customerPhone.slice(1);
        }
    }
    
    const trackingUrl = `https://gampil.github.io/foresa?order=${id}`;
    const messageText = `Halo, Terima kasih telah mencuci di *Forresa Laundry*.\n\nBerikut rincian Nota Transaksi digital Anda:\n🆔 No Nota: *${id}*\n👤 Konsumen: *${customer}*\n💰 Total Bill: *${total}*\n\n🌿 Pantau status proses pengerjaan laundry pakaian Anda secara realtime melalui link tautan resmi di bawah ini:\n🔗 ${trackingUrl}`;
    
    // 💡 2. LINK YANG SUDAH DIPERBAIKI (Ditutup dengan kurung ')' yang benar di akhir)
    if (customerPhone !== "") {
        window.open(`https://api.whatsapp.com/send?phone=${customerPhone}&text=${encodeURIComponent(messageText)}`, '_blank');
    } else {
        // Fallback cadangan jika nomor pelanggan kosong atau tidak diisi kasir
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`, '_blank');
    }
}


// FILTER SEARCHING DATA
function searchByQR(val) {
    let q = val.toUpperCase();
    document.querySelectorAll('#orders-list > div').forEach(c => {
        c.innerText.toUpperCase().includes(q) ? c.classList.remove('hidden') : c.classList.add('hidden');
    });
}

function renderOrders() {
    const ordersList = document.getElementById('orders-list');
    if(!ordersList) return;
    
    ordersList.innerHTML = orders.map(o => {
        let badgeColor = "bg-amber-50 text-amber-600";
        if (o.status === 'Selesai') badgeColor = "bg-cyan-50 text-cyan-600";
        if (o.status === 'Diambil') badgeColor = "bg-green-50 text-green-600";

        return `
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-xs font-mono font-bold text-slate-400">${o.id}</span>
                    <span class="text-[10px] px-2.5 py-0.5 font-bold rounded-full ${badgeColor}">${o.status.toUpperCase()}</span>
                </div>
                <div>
                    <// CARI BLOK INI DI DALAM renderOrders() PADA FILE app.js
<div>
    <h4 class="font-bold text-slate-800 text-sm">${o.customer}</h4>
    <p class="text-[11px] text-slate-400">${o.service}</p>
    <p class="text-[10px] text-slate-400 italic">WA: +${o.phone}</p>
    
    <p class="text-[10px] font-bold mt-0.5 ${o.paymentStatus === 'Belum Bayar' ? 'text-rose-600' : 'text-emerald-600'}">
    <i class="${o.paymentStatus === 'Belum Bayar' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check'}"></i> 
    Status: ${o.paymentStatus || 'Lunas'}
</p>
</div>

                
                <div class="space-y-2 pt-2 border-t border-slate-50">
                    <label class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Update Status Operasional:</label>
                    <select onchange="updateOrderStatus('${o.id}', this.value)" class="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 outline-none focus:border-cyan-400">
                        <option value="Diproses" ${o.status === 'Diproses' ? 'selected' : ''}>⏳ Sedang Diproses</option>
                        <option value="Selesai" ${o.status === 'Selesai' ? 'selected' : ''}>✨ Selesai (Siap Ambil)</option>
                        <option value="Diambil" ${o.status === 'Diambil' ? 'selected' : ''}>✅ Sudah Diambil Pelanggan</option>
                    </select>
                    <select onchange="updatePaymentStatus('${o.id}', this.value)" class="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 outline-none focus:border-cyan-400 mt-1.5">
        <option value="Lunas" ${o.paymentStatus === 'Lunas' ? 'selected' : ''}>✔️Lunas</option>
        <option value="Belum Bayar" ${o.paymentStatus === 'Belum Bayar' ? 'selected' : ''}>🔴 Belum Bayar</option>
    </select>
                </div>

                <div class="flex justify-between items-center pt-2">
                    <span class="text-xs font-bold theme-color">Rp ${o.total.toLocaleString('id-ID')}</span>
                    <div class="flex gap-1">
                        <button onclick="openLiveTrackingPreview('${o.id}')" class="text-[10px] font-bold bg-cyan-50 text-[#40E0D0] px-2.5 py-1.5 rounded-lg hover:bg-cyan-100/50" title="Cek Tampilan Live"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="openReceiptModalById('${o.id}')" class="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200">Buka Struk</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateOrderStatus(orderId, newStatus) {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
        orders[orderIndex].status = newStatus;
        renderOrders();
        
        // 🚀 TAMBAHKAN BLOK KODE INI AGAR TERKIRIM KE GOOGLE SHEETS
        if (SCRIPT_URL !== "" && !SCRIPT_URL.includes("SCRIPT_URL")) {
            fetch(SCRIPT_URL, { 
                method: 'POST', 
                mode: 'no-cors', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ 
                    action: "updateStatus", // Mencocokkan dengan aksi di Google Apps Script kita sebelumnya
                    id: orderId, 
                    status: newStatus 
                }) 
            })
            .then(() => console.log(`Berhasil sinkron status ${orderId} ke cloud.`))
            .catch(err => console.log("Gagal sinkron cloud:", err));
        }
        
        triggerNotification(`Status pesanan nota ${orderId} diubah menjadi: ${newStatus}`);
    }
}



function openLiveTrackingPreview(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Update teks informasi di atas timeline pelacakan
    document.getElementById('track-id').innerText = order.id;
    document.getElementById('track-cust').innerText = order.customer;
    document.getElementById('track-service').innerText = order.service;
    document.getElementById('track-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    document.getElementById('track-badge').innerText = order.status.toUpperCase();

    // Mengambil 4 elemen kotak pembungkus langkah (step) di HTML
    const steps = document.querySelectorAll('#view-tracking .relative.pl-6 > div');
    
    // RESET TOTAL: Buat semua titik kembali menjadi abu-abu redup terlebih dahulu
    steps.forEach((step) => {
        setStepActive(step, false, false);
    });

    // EKSEKUSI PERGESERAN: Nyalakan titik hijau sesuai status asli dari Google Sheets
    if (order.status === "Diproses") {
        setStepActive(steps[0], true, false); // Langkah 1 Hijau diam
        setStepActive(steps[1], true, true);  // Langkah 2 Hijau berdenyut (sedang dicuci)
    } 
    else if (order.status === "Selesai") {
        setStepActive(steps[0], true, false); // Langkah 1 Hijau diam
        setStepActive(steps[1], true, false); // Langkah 2 Hijau diam
        setStepActive(steps[2], true, true);  // Langkah 3 Hijau berdenyut (siap diambil)
    } 
    else if (order.status === "Diambil") {
        setStepActive(steps[0], true, false); // Langkah 1 Hijau diam
        setStepActive(steps[1], true, false); // Langkah 2 Hijau diam
        setStepActive(steps[2], true, false); // Langkah 3 Hijau diam
        setStepActive(steps[3], true, false); // Langkah 4 Hijau diam (selesai mutlak)
    }

    switchView('tracking');
}

function setStepActive(stepElement, isActive, isPulse) {
    if(!stepElement) return;
    const dot = stepElement.querySelector('span:not(.animate-ping)');
    const ping = stepElement.querySelector('.animate-ping');
    const title = stepElement.querySelector('p:nth-of-type(1)');

    if(isActive) {
        // AKTIF: Titik diberi warna tema (hijau toska), border putih tipis, dan efek bayangan
        if(dot) {
            dot.className = "absolute -left-[31px] top-1 w-4 h-4 rounded-full theme-bg border-2 border-white shadow-sm z-10";
        }
        if(title) title.className = "text-xs font-bold text-slate-700";
    } else {
        // TIDAK AKTIF (DEFAULT/RESET): Titik kembali abu-abu redup
        if(dot) {
            dot.className = "absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-200 border-2 border-white z-10";
        }
        if(title) title.className = "text-xs font-semibold text-slate-400";
    }

    // Mengatur denyut animasi (pulse) jika status sedang berjalan
    if (ping) {
        if (isPulse) {
            ping.classList.remove('hidden');
            ping.className = "absolute -left-[31px] top-1 w-4 h-4 rounded-full theme-bg opacity-75 animate-ping";
        } else {
            ping.classList.add('hidden');
        }
    }
}

// FINANSIAL REPORT REKAP MANAGEMENT
function calculateFinance() {
    const total = orders.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('rep-income').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('rep-profit').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}
// FUNGSI UNTUK MEMUNCULKAN INPUT DATE / MONTH SESUAI MODE YANG DIPILIH KASIR
function toggleFinanceFilterInputs() {
    const mode = document.getElementById('finance-filter-mode').value;
    const wrapDate = document.getElementById('wrapper-filter-date');
    const wrapMonth = document.getElementById('wrapper-filter-month');

    wrapDate.classList.add('hidden');
    wrapMonth.classList.add('hidden');

    const now = new Date();
    const jktTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));

    if (mode === 'date') {
        wrapDate.classList.remove('hidden');
        if(!document.getElementById('finance-input-date').value) {
            document.getElementById('finance-input-date').value = jktTime.toISOString().split('T')[0];
        }
    } else if (mode === 'month') {
        wrapMonth.classList.remove('hidden');
        if(!document.getElementById('finance-input-month').value) {
            const year = jktTime.getFullYear();
            const month = String(jktTime.getMonth() + 1).padStart(2, '0');
            document.getElementById('finance-input-month').value = `${year}-${month}`;
        }
    }
    calculateFinance();
}

// FUNGSI INTI: MENGHITUNG DAN MENYARING OMZET KEUANGAN LAUNDRY DENGAN AKURASI FORMAT TANGGAL
function calculateFinance() {
    const mode = document.getElementById('finance-filter-mode') ? document.getElementById('finance-filter-mode').value : 'all';
    const logList = document.getElementById('finance-log-list');
    
    let filteredOrders = [...orders];
    let labelInfo = "Semua transaksi terpantau";

    // Ambil tanggal hari ini berdasarkan zona waktu lokal kasir (Format: YYYY-MM-DD)
    const now = new Date();
    const jktTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
    const todayStr = jktTime.toISOString().split('T')[0]; 

    // PROSES PENYARINGAN DATA BERDASARKAN SELEKSI WAKTU
    if (mode === 'today') {
        filteredOrders = orders.filter(o => {
            if (!o.date) return false; // Proteksi jika kolom waktu kosong
            // Konversi tanggal nota dari cloud ke format YYYY-MM-DD
            const orderDateStr = new Date(o.date).toISOString().split('T')[0];
            return orderDateStr === todayStr;
        });
        labelInfo = `Rekapitulasi omzet Hari Ini`;
        
    } else if (mode === 'date') {
        const pickerDate = document.getElementById('finance-input-date').value; // Hasil: YYYY-MM-DD
        if (pickerDate) {
            filteredOrders = orders.filter(o => {
                if (!o.date) return false;
                const orderDateStr = new Date(o.date).toISOString().split('T')[0];
                return orderDateStr === pickerDate;
            });
            const d = new Date(pickerDate);
            labelInfo = `Tanggal: ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        }
    } else if (mode === 'month') {
        const pickerMonth = document.getElementById('finance-input-month').value; // Hasil: YYYY-MM
        if (pickerMonth) {
            filteredOrders = orders.filter(o => {
                if (!o.date) return false;
                const orderDateObj = new Date(o.date);
                const orderYear = orderDateObj.getFullYear();
                const orderMonth = String(orderDateObj.getMonth() + 1).padStart(2, '0');
                const orderMonthStr = `${orderYear}-${orderMonth}`; // Hasil konversi: YYYY-MM
                return orderMonthStr === pickerMonth;
            });
            const [year, month] = pickerMonth.split('-');
            const d = new Date(year, month - 1);
            labelInfo = `Bulan: ${d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
        }
    }

    // HITUNG TOTAL OMZET DAN JUMLAH NOTA YANG LOLOS FILTER
    const totalIncome = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const totalNotes = filteredOrders.length;

    // INJEKSI NILAI KE ELEMENT DASHBOARD UI KEUANGAN
    if(document.getElementById('rep-income')) document.getElementById('rep-income').innerText = `Rp ${totalIncome.toLocaleString('id-ID')}`;
    if(document.getElementById('rep-orders-count')) document.getElementById('rep-orders-count').innerText = `${totalNotes} Nota`;
    if(document.getElementById('finance-summary-label')) document.getElementById('finance-summary-label').innerText = labelInfo;

    // RENDER SUB-LIST DAFTAR ALIRAN DANA KECIL DI BAWAHNYA
    if (logList) {
        if(filteredOrders.length === 0) {
            logList.innerHTML = `<p class="text-center italic text-slate-400 py-4">Tidak ada riwayat transaksi pada periode ini.</p>`;
            return;
        }

        logList.innerHTML = filteredOrders.map(o => `
            <div class="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div class="space-y-0.5">
                    <p class="font-bold text-slate-700 text-xs">${o.customer} <span class="font-mono text-[10px] text-slate-400 font-normal">(${o.id})</span></p>
                    <p class="text-[10px] text-slate-400 line-clamp-1">${o.service}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-emerald-600 text-xs">+Rp ${o.total.toLocaleString('id-ID')}</p>
                    <p class="text-[9px] text-slate-400 uppercase font-medium">${o.method ? o.method.split(' ')[0] : 'KAS'}</p>
                </div>
            </div>
        `).join('');
    }
}

function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(orders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Penjualan");
    XLSX.writeFile(wb, "Forresa_Laundry_Report.xlsx");
}

function triggerNotification(msg) {
    const banner = document.getElementById('liveAlert');
    if(!banner) return;
    document.getElementById('alertMessage').innerText = msg;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 5000);
}

// FUNGSI OTOMATIS: JALUR BYPASS PELANGGAN BELUM LOGIN + AUTO REFRESH REAL-TIME
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get('order');
    
    if (orderParam) {
        console.log("Mendeteksi Pelanggan melakukan pelacakan nota:", orderParam);
        
        // 1. Amankan Tampilan: Sembunyikan layar login dan tampilkan menu utama
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // 2. Sembunyikan Header Kasir & Navigasi Bawah secara mutlak dari mata konsumen
        const headerKasir = document.querySelector('header');
        if(headerKasir) headerKasir.style.display = 'none';
        
        const navBawah = document.querySelector('nav');
        if(navBawah) navBawah.style.display = 'none';
        
        // Hilangkan padding bawah pada bodi utama karena nav bawah disembunyikan
        const mainAppEl = document.getElementById('main-app');
        if(mainAppEl) mainAppEl.className = 'min-h-screen flex flex-col pb-0';

        // 3. Tampilkan teks loading awal agar konsumen tahu sistem sedang bekerja
        document.getElementById('track-id').innerText = "MENCARI DATA...";
        document.getElementById('track-cust').innerText = "Sedang mengunduh data dari server...";
        switchView('tracking');

        // Fungsi Pembantu internal untuk menarik data berulang kali
        function fetchStatusPelanggan() {
    if (SCRIPT_URL === "" || SCRIPT_URL.includes("SCRIPT_URL")) return;
    
    console.log("Menyelaraskan status nota konsumen secara real-time...");
    
    // Mengubah link fetch agar menembak parameter '?order=FRS-XXXX' secara spesifik
    fetch(`${SCRIPT_URL}?order=${orderParam}`)
        .then(response => response.json())
        .then(cloudData => {
            // ... sisa kode bawaan fungsi fetchStatusPelanggan ...

                    if (cloudData && cloudData.transactions) {
                        orders = cloudData.transactions;
                        
                        // Cari nota yang pas dengan parameter link WA
                        const match = orders.find(o => o.id.toUpperCase() === orderParam.toUpperCase());
                        if (match) {
                            // Tampilkan status asli timeline baju milik pelanggan secara dinamis
                            openLiveTrackingPreview(match.id);
                        } else {
                            document.getElementById('track-id').innerText = "TIDAK DITEMUKAN";
                            document.getElementById('track-cust').innerText = "Maaf, nomor nota tersebut tidak terdaftar.";
                        }
                    }
                })
                .catch(err => console.log("Gagal auto-update status (Masalah jaringan):", err));
        }

        // 4. EKSEKUSI PERTAMA: Jalankan pencarian data langsung saat halaman dibuka
        fetchStatusPelanggan();

        // 5. FITUR AUTO-REFRESH REAL-TIME: Paksa halaman mengecek Google Sheets setiap 10 detik sekali
        // Pelanggan tidak perlu refresh halaman, linimasa akan bergeser sendiri jika kasir mengubah statusnya!
        setInterval(fetchStatusPelanggan, 10000); 
    }
});

// ===============================
// BLUETOOTH THERMAL PRINT ESC/POS
// ===============================
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

function bluetoothTextEncoder(text) {
    return new TextEncoder().encode(text);
}

// =========================================================================
// INTEGRASI BLUETOOTH THERMAL PRINT ESC/POS + NATIVE QR CODE GENERATOR
// =========================================================================
async function printBluetoothReceipt() {
    try {
        // 1. Ambil data dasar dari layar pratinjau
        const notaId = document.getElementById('nota-id').innerText;
        const notaDate = document.getElementById('nota-date').innerText;
        const notaCashier = document.getElementById('nota-cashier').innerText;
        const notaCustomer = document.getElementById('nota-customer').innerText;
        const notaService = document.getElementById('nota-service').innerText;
        const notaPrice = document.getElementById('nota-price').innerText;
        const notaTotal = document.getElementById('nota-total').innerText;

        // 💡 TRICK BYPASS ANTI-STRIP: Cari langsung datanya dari database 'orders' lokal kasir
        let notaPaymethod = "Tunai / Cash"; // Nilai cadangan standar jika tidak ketemu
        let notaPaymentStatus = "Lunas";

        const currentOrderData = orders.find(o => o.id === notaId);
        if (currentOrderData) {
            // Jika data nota ditemukan di sistem kasir, ambil metodenya langsung dari sumber asli
            notaPaymethod = currentOrderData.method || "Tunai / Cash";
            notaPaymentStatus = currentOrderData.paymentStatus || "Lunas";
        } else {
            // Jika tidak ditemukan (misal nota lama), gunakan pembacaan HTML cadangan
            const backupPayElement = document.getElementById('nota-paymethod') || document.getElementById('nota-payMethod');
            if (backupPayElement && backupPayElement.innerText !== "-") {
                notaPaymethod = backupPayElement.innerText;
            }
            const backupStatusElement = document.getElementById('nota-payment-status');
            if (backupStatusElement) {
                notaPaymentStatus = backupStatusElement.innerText;
            }
        }

        // ... Sisa kode array biner bluetooth printer (printPayload.push) ke bawah tidak perlu diubah ...


        // 2. Setup Tautan QR Code Pelacakan Konsumen secara Dinamis
        const trackingUrl = `https://gampil.github.io/foresa?order=${notaId}`;

        // 3. Request koneksi ke perangkat Bluetooth Printer Thermal
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'MTP' },
                { namePrefix: 'RPP' },
                { namePrefix: 'POS' },
                { namePrefix: 'EPPOS' },
                { services: [PRINTER_SERVICE_UUID] }
            ],
            optionalServices: [PRINTER_SERVICE_UUID]
        });

        console.log('Menghubungkan ke GATT Server Printer...');
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID);

        // 4. Encoder Teks dan Konstanta Perintah Kontrol ESC/POS Biner
        const encoder = new TextEncoder();
        const ESC = 0x1B;
        const GS = 0x1D;

        const CMD_INIT = new Uint8Array([ESC, 0x40]); // Reset printer
        const CMD_CENTER = new Uint8Array([ESC, 0x61, 1]); // Rata tengah
        const CMD_LEFT = new Uint8Array([ESC, 0x61, 0]); // Rata kiri
        const CMD_RIGHT = new Uint8Array([ESC, 0x61, 2]); // Rata kanan
        const CMD_BOLD_ON = new Uint8Array([ESC, 0x45, 1]); // Tebal aktif
        const CMD_BOLD_OFF = new Uint8Array([ESC, 0x45, 0]); // Tebal mati
        const CMD_FEED = new Uint8Array([ESC, 0x64, 4]); // Dorong kertas keluar (4 baris)

        const text = (str) => encoder.encode(str + "\n");

        // 5. Formula Kompilasi Perintah QR Code Native Printer (GS ( k)
        const qrData = encoder.encode(trackingUrl);
        const qrLength = qrData.length + 3; // Menghitung pL & pH secara otomatis
        const pL = qrLength & 0xFF;
        const pH = (qrLength >> 8) & 0xFF;

        const CMD_QR_MODEL = new Uint8Array([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]); // Model 2
        const CMD_QR_SIZE = new Uint8Array([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]); // Ukuran Modul 6 (Sedang)
        const CMD_QR_ERROR = new Uint8Array([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x44, 0x30]); // Error Correction Level L
        const CMD_QR_STORE = new Uint8Array([GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...qrData]); // Simpan ke buffer
        const CMD_QR_PRINT = new Uint8Array([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]); // Eksekusi Cetak QR

        // 6. Menyusun Aliran Data Array Struktur Struk Laundry (Lebar Standar 58mm / 32 Karakter)
        let printPayload = [];

        printPayload.push(CMD_INIT);
        printPayload.push(CMD_CENTER, CMD_BOLD_ON, text("====== FORRESA LAUNDRY ======"), CMD_BOLD_OFF);
        printPayload.push(text("Laundry Management System"));
        printPayload.push(text("================================")); // 32 Karakter

        printPayload.push(CMD_LEFT);
        printPayload.push(text(`Tanggal : ${notaDate}`));
        printPayload.push(text(`Invoice : ${notaId}`));
        printPayload.push(text(`Kasir   : ${notaCashier}`));
        printPayload.push(text(`Customer: ${notaCustomer}`));
        printPayload.push(text("--------------------------------"));

        printPayload.push(text(notaService));
        printPayload.push(CMD_RIGHT, text(notaPrice));
        printPayload.push(CMD_LEFT, text("--------------------------------"));
        // 🛠️ SESUAIKAN BARIS INI SECARA TELITI (Jangan sampai ada typo nama variabel):
printPayload.push(text(`Pembayaran : ${notaPaymethod}`));
printPayload.push(text(`Status     : ${notaPaymentStatus}`));

printPayload.push(CMD_BOLD_ON, CMD_RIGHT);
printPayload.push(text(`TOTAL : ${notaTotal}`));

        printPayload.push(CMD_BOLD_OFF);
        printPayload.push(CMD_CENTER, text("================================"));

        // Area Injeksi Cetak Matriks QR Code Pelacakan
        printPayload.push(text("Scan untuk cek status pesanan:"));
        printPayload.push(text("\n")); // Spasi aman atas QR
        printPayload.push(CMD_QR_MODEL);
        printPayload.push(CMD_QR_SIZE);
        printPayload.push(CMD_QR_ERROR);
        printPayload.push(CMD_QR_STORE);
        printPayload.push(CMD_QR_PRINT); // QR dicetak di sini
        printPayload.push(text("\n")); // Spasi aman bawah QR

        // Kaki Nota
        printPayload.push(text("Pakaian Bersih, Wangi & Rapi"));
        printPayload.push(text("Terima Kasih :)"));
        printPayload.push(CMD_FEED); // Dorong kertas keluar agar tidak terpotong printer

        // 7. Pengiriman Data Paket (Chunks) ke Printer Bluetooth
        console.log('Mengirim data struk ke printer...');
        for (const chunk of printPayload) {
            await characteristic.writeValue(chunk);
        }

        alert('✅ Struk & QR Code berhasil dicetak via Bluetooth');
        server.disconnect();

    } catch (error) {
        console.error("Gagal cetak bluetooth:", error);
        alert('❌ Gagal print Bluetooth: ' + error.message);
    }
}


// =========================================================================
// 💡 FUNGSI UPDATE STATUS PEMBAYARAN LANGSUNG DARI DAFTAR KARTU NOTA
// =========================================================================
function updatePaymentStatus(orderId, newPaymentStatus) {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
        orders[orderIndex].paymentStatus = newPaymentStatus;
        renderOrders();
        calculateFinance();
        
        if (SCRIPT_URL !== "" && !SCRIPT_URL.includes("SCRIPT_URL")) {
            fetch(SCRIPT_URL, { 
                method: 'POST', 
                mode: 'no-cors', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ 
                    action: "updatePaymentStatus", 
                    id: orderId, 
                    paymentStatus: newPaymentStatus 
                }) 
            }).catch(err => console.log("Gagal sinkron cloud:", err));
        }
        triggerNotification(`Status pembayaran nota ${orderId} diubah menjadi: ${newPaymentStatus}`);
    }
}
