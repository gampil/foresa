ko// BACKEND CONFIGURATION: Tempel tautan URL Google Apps Script Web App Anda di sini untuk sinkronisasi cloud
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwEiNj70R9hdGUByJBAwrQ-0bFkVjdOcdOvJ86qQcqVvk8NrfQRsUkYlNAD3WbY6ECi/exec";

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

let paymentMethods = ['Tunai / Cash', 'QRIS Mandiri', 'Transfer Bank'];

let orders = [
    { id: 'FRS-4821', customer: 'Budi Santoso', phone: '628123456789', service: 'Cuci Kering + Setrika (2 Kg)', total: 16000, cashier: 'Sistem', status: 'Diproses', method: 'Tunai / Cash' }
];

// SESSION CONTROL LOGIC
window.addEventListener('DOMContentLoaded', () => {
    const savedCashier = localStorage.getItem('active_cashier');
    if (savedCashier) {
        currentCashier = savedCashier;
        showMainApp();
    }
});

function submitLogin() {
    const nameInput = document.getElementById('input-cashier-name').value.trim();
    if(!nameInput) return alert('Nama kasir wajib dimasukkan!');
    
    currentCashier = nameInput;
    localStorage.setItem('active_cashier', currentCashier);
    
    // LANGKAH PENGAMANDAN LOGIN: Pindahkan halaman instan terlebih dahulu (Anti-Macet)
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('display-cashier').innerText = currentCashier;
    
    renderServicesGrid();
    populateDropdowns();
    renderOrders();
    calculateFinance();

    // Beri jeda 1 detik baru tarik data dari spreadsheet dengan tenang di latar belakang
    setTimeout(function() {
        loadDataFromCloud();
    }, 1000);
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
            if (!cloudData || cloudData.error) {
                return console.error("Gagal ambil data:", cloudData ? cloudData.error : "Data kosong");
            }

            // 1. Sinkronisasi daftar layanan menu baru dari spreadsheet
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

            // 2. Sinkronisasi data daftar transaksi nota dari spreadsheet
            if (cloudData.transactions && cloudData.transactions.length > 0) {
                orders = cloudData.transactions;
            }

            // 3. Render ulang seluruh tampilan setelah data sinkron
            renderServicesGrid();
            renderOrders();
            calculateFinance();
            console.log("Sinkronisasi database Google Sheets berhasil!");
        })
        .catch(err => {
            console.log("Gagal memuat data dari cloud (Aplikasi berjalan dalam Mode Offline):", err);
            // Pengaman bypass agar interface tetap bisa diklik jika internet terputus
            renderServicesGrid();
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
    if(SCRIPT_URL !== "" && !SCRIPT_URL.includes("TEMPEL_URL")) {
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
        
        grid.innerHTML += `
            <div onclick="selectServiceToCart('${item.id}')" class="bg-white p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-36 relative ${activeClasses}">
                ${isActive ? '<span class="absolute top-3 right-3 text-xs theme-color"><i class="fa-solid fa-circle-check"></i></span>' : ''}
                <div class="flex justify-between items-start">
                    <span class="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">${item.type}</span>
                    ${!isActive ? `<i class="fa-solid ${item.icon} text-slate-300 text-base"></i>` : '<div class="w-2"></div>'}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-xs mb-0.5 line-clamp-1">${item.name}</h4>
                    <p class="text-sm font-bold theme-color">Rp ${item.price.toLocaleString('id-ID')}</p>
                </div>
            </div>
        `;
    });
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

    const checkoutPayload = {
        id: generatedOrderId,
        customer: customerName,
        phone: customerPhone,
        service: serviceDetailLabel, 
        total: totalHargaAkhir,
        cashier: currentCashier,
        method: payMethod,
        status: 'Diproses'
    };

    orders.unshift(checkoutPayload);
    renderOrders();
    calculateFinance();
    openReceiptModal(checkoutPayload);

    // KONEKSI PUSH CLOUD DATABASE SPREADSHEET (MENYIMPAN DUA ARAH)
    if(SCRIPT_URL !== "" && !SCRIPT_URL.includes("TEMPEL_URL")) {
        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(checkoutPayload)
        }).catch(err => console.log("Cloud sync delayed or offline mode."));
    }

    // Reset States & Form Keranjang POS
    selectedServiceId = null;
    if (isNewCustomerMode) toggleNewCustomerInput();
    document.getElementById('new-cust-name').value = '';
    document.getElementById('new-cust-phone').value = '';
    renderServicesGrid();
    document.getElementById('cart-items').innerHTML = '<span class="text-center italic text-slate-400 py-2">Silahkan pilih produk di sebelah kiri...</span>';
    document.getElementById('cart-qty-wrapper').innerHTML = ''; 
    document.getElementById('cart-total').innerText = "Rp 0";
}

// PREVIEW STRUK NOTA KASIR & QR BARCODE SVG GENERATOR
function openReceiptModal(order) {
    document.getElementById('nota-date').innerText = new Date().toLocaleString('id-ID');
    document.getElementById('nota-id').innerText = order.id;
    document.getElementById('nota-cashier').innerText = order.cashier;
    document.getElementById('nota-customer').innerText = order.customer;
    document.getElementById('nota-service').innerText = order.service;
    document.getElementById('nota-price').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    document.getElementById('nota-paymethod').innerText = order.method;
    document.getElementById('nota-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;

    document.getElementById('track-id').innerText = order.id;
    document.getElementById('track-cust').innerText = order.customer;
    document.getElementById('track-service').innerText = order.service;
    document.getElementById('track-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    document.getElementById('track-badge').innerText = order.status.toUpperCase();

    const generatedTrackingUrl = `https://forresalaundry.id/track?order=${order.id}&phone=${order.phone}`;
    
    // GENERATOR FORMAT SVG MURNI (Menjamin QR Code selalu ter-print tajam di kertas kasir tanpa kotak ganda)
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

// 1. CARI FUNGSI INI DAN GANTI BAGIAN URL-NYA
function openReceiptModal(order) {
    document.getElementById('nota-date').innerText = new Date().toLocaleString('id-ID');
    document.getElementById('nota-id').innerText = order.id;
    document.getElementById('nota-cashier').innerText = order.cashier;
    document.getElementById('nota-customer').innerText = order.customer;
    document.getElementById('nota-service').innerText = order.service;
    document.getElementById('nota-price').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    document.getElementById('nota-paymethod').innerText = order.method;
    document.getElementById('nota-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;

    document.getElementById('track-id').innerText = order.id;
    document.getElementById('track-cust').innerText = order.customer;
    document.getElementById('track-service').innerText = order.service;
    document.getElementById('track-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    document.getElementById('track-badge').innerText = order.status.toUpperCase();

    // UBAH BARIS INI: Menggunakan link GitHub Pages kamu yang asli untuk QR Code
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

// 2. CARI FUNGSI INI DAN GANTI BAGIAN URL-NYA
function sendWhatsAppReceipt() {
    const id = document.getElementById('nota-id').innerText;
    const customer = document.getElementById('nota-customer').innerText;
    const total = document.getElementById('nota-total').innerText;
    
    // UBAH BARIS INI: Menggunakan link GitHub Pages kamu untuk teks yang dikirim ke WhatsApp
    const trackingUrl = `https://gampil.github.io/foresa?order=${id}`;
    
    const messageText = `Halo, Terima kasih telah mencuci di *Forresa Laundry*.\n\nBerikut rincian Nota Transaksi digital Anda:\n🆔 No Nota: *${id}*\n👤 Konsumen: *${customer}*\n💰 Total Bill: *${total}*\n\n🌿 Pantau status proses pengerjaan laundry pakaian Anda secara realtime melalui link tautan resmi di bawah ini:\n🔗 ${trackingUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`, '_blank');
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
                    <h4 class="font-bold text-slate-800 text-sm">${o.customer}</h4>
                    <p class="text-[11px] text-slate-400">${o.service}</p>
                    <p class="text-[10px] text-slate-400 italic">WA: +${o.phone}</p>
                </div>
                
                <div class="space-y-2 pt-2 border-t border-slate-50">
                    <label class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Update Status Operasional:</label>
                    <select onchange="updateOrderStatus('${o.id}', this.value)" class="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 outline-none focus:border-cyan-400">
                        <option value="Diproses" ${o.status === 'Diproses' ? 'selected' : ''}>⏳ Sedang Diproses</option>
                        <option value="Selesai" ${o.status === 'Selesai' ? 'selected' : ''}>✨ Selesai (Siap Ambil)</option>
                        <option value="Diambil" ${o.status === 'Diambil' ? 'selected' : ''}>✅ Sudah Diambil Pelanggan</option>
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

// LOGIKA PEMBARUAN STATUS & MOCK TRACKING TIMELINE LIVE VIEW
function updateOrderStatus(orderId, newStatus) {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
        orders[orderIndex].status = newStatus;
        renderOrders();
        
        const currentTrackId = document.getElementById('track-id').innerText;
        if (currentTrackId === orderId) {
            openLiveTrackingPreview(orderId);
        }
        
        triggerNotification(`Status pesanan ${orderId} berhasil diubah menjadi: ${newStatus}`);
    }
}

function openLiveTrackingPreview(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('track-id').innerText = order.id;
    document.getElementById('track-cust').innerText = order.customer;
    document.getElementById('track-service').innerText = order.service;
    document.getElementById('track-total').innerText = `Rp ${order.total.toLocaleString('id-ID')}`;
    document.getElementById('track-badge').innerText = order.status.toUpperCase();

    const steps = document.querySelectorAll('#view-tracking .relative.pl-6 > div');
    
    steps.forEach((step) => {
        const dot = step.querySelector('span:not(.animate-ping)');
        const ping = step.querySelector('.animate-ping');
        const title = step.querySelector('p:nth-of-type(1)');
        
        if(dot) { dot.className = "absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-200 border-4 border-white"; }
        if(ping) { ping.classList.add('hidden'); }
        if(title) { title.className = "text-xs font-semibold text-slate-400"; }
    });

    if (order.status === "Diproses") {
        setStepActive(steps[0], true, false);
        setStepActive(steps[1], true, true);
    } else if (order.status === "Selesai") {
        setStepActive(steps[0], true, false);
        setStepActive(steps[1], true, false);
        setStepActive(steps[2], true, false);
    } else if (order.status === "Diambil") {
        setStepActive(steps[0], true, false);
        setStepActive(steps[1], true, false);
        setStepActive(steps[2], true, false);
        setStepActive(steps[3], true, false);
    }

    switchView('tracking');
}

function setStepActive(stepElement, isActive, isPulse) {
    if(!stepElement) return;
    const dot = stepElement.querySelector('span:not(.animate-ping)');
    const ping = stepElement.querySelector('.animate-ping');
    const title = stepElement.querySelector('p:nth-of-type(1)');

    if(isActive) {
        if(dot) dot.className = "absolute -left-[31px] top-0 w-4 h-4 rounded-full theme-bg border-4 border-white shadow-xs";
        if(title) title.className = "text-xs font-bold text-slate-700";
    }
    if(isPulse && ping) {
        ping.classList.remove('hidden');
    }
}

// FINANSIAL REPORT REKAP MANAGEMENT
function calculateFinance() {
    const total = orders.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('rep-income').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('rep-profit').innerText = `Rp ${total.toLocaleString('id-ID')}`;
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
// FUNGSI OTOMATIS: JALUR BYPASS PELANGGAN BELUM LOGIN AGAR BISA LACAK NOTA
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get('order');
    
    if (orderParam) {
        console.log("Mendeteksi Pelanggan melakukan pelacakan nota:", orderParam);
        
        // 1. Amankan Tampilan: Sembunyikan layar login dan menu utama kasir
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // 2. Sembunyikan Header Kasir & Navigasi Bawah agar pelanggan tidak bisa otak-atik data POS
        const headerKasir = document.querySelector('header');
        if(headerKasir) headerKasir.classList.add('hidden');
        
        const navBawah = document.querySelector('nav');
        if(navBawah) navBawah.classList.add('hidden');
        
        // 3. Tampilkan teks loading sementara di area tracking agar estetik
        document.getElementById('track-id').innerText = "MENCARI DATA...";
        document.getElementById('track-cust').innerText = "Sedang mengunduh data dari server...";
        switchView('tracking');

        // 4. Jalankan fetch langsung ke Google Sheets tanpa nunggu aksi login kasir
        if (SCRIPT_URL !== "" && !SCRIPT_URL.includes("TEMPEL_URL")) {
            fetch(`${SCRIPT_URL}?action=read`)
                .then(response => response.json())
                .then(cloudData => {
                    if (cloudData && cloudData.transactions) {
                        orders = cloudData.transactions;
                        
                        // Cari nota yang pas
                        const match = orders.find(o => o.id.toUpperCase() === orderParam.toUpperCase());
                        if (match) {
                            // Tampilkan status asli timeline baju milik pelanggan
                            openLiveTrackingPreview(match.id);
                        } else {
                            document.getElementById('track-id').innerText = "TIDAK DITEMUKAN";
                            document.getElementById('track-cust').innerText = "Maaf, nomor nota tersebut tidak terdaftar.";
                        }
                    }
                })
                .catch(err => {
                    document.getElementById('track-id').innerText = "KONEKSI GAGAL";
                    document.getElementById('track-cust').innerText = "Gagal terhubung ke database. Coba segarkan halaman.";
                });
        }
    }
});
