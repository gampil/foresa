// ==========================================
// KONFIGURASI DATABASE MASTER (DAFTAR CABANG)
// ==========================================
// Tanam URL App Script Spreadsheet Master Anda di sini
const MASTER_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXyzTBYU0kq_UH-CV4iJZNSeZkIOHgk0lLJB8bid003X0ghnZ_nrVIoAFe0JQClp0/exec";

// ==========================================
// KONFIGURASI DATABASE CABANG (ANALITIK AKTIF)
// ==========================================
let SCRIPT_URL = localStorage.getItem('tenant_script_url') || "";
let tenantName = localStorage.getItem('tenant_name') || "Forresa Laundry";

// State Data Global
let orders = [];
let expenses = [];
let branches = []; // Diisi dari Master Spreadsheet
let cashflowChartInstance = null;
let isLoading = true;

window.addEventListener('DOMContentLoaded', () => {
    updateTenantUI();
    document.getElementById('owner-setting-url').value = SCRIPT_URL;

    const isOwnerLoggedIn = localStorage.getItem('owner_logged_in');
    if (isOwnerLoggedIn === "true") {
        showMainApp();
    }
});

function submitOwnerLogin() {
    const pin = document.getElementById('input-owner-pin').value;
    if (pin === "12345") {
        localStorage.setItem('owner_logged_in', "true");
        showMainApp();
    } else {
        alert("❌ PIN Owner Salah!");
    }
}

function logoutOwner() {
    localStorage.removeItem('owner_logged_in');
    location.reload();
}

function showMainApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    // Muat data cabang dari Master, dan data analitik dari URL aktif
    loadBranchesFromMaster();
    loadDataFromCloud();
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('theme-bg-light', 'text-[#40E0D0]');
        btn.classList.add('text-slate-500');
    });
    
    const clickedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('onclick').includes(viewId));
    if(clickedBtn) {
        clickedBtn.classList.add('theme-bg-light', 'text-[#40E0D0]');
        clickedBtn.classList.remove('text-slate-500');
    }
}

function updateTenantUI() {
    document.querySelectorAll('.tenant-name-display').forEach(el => {
        el.innerText = tenantName;
    });
}

function saveOwnerSettings() {
    const newUrl = document.getElementById('owner-setting-url').value.trim();
    if(!newUrl) return alert("❌ URL Database tidak boleh kosong!");

    SCRIPT_URL = newUrl;
    localStorage.setItem('tenant_script_url', SCRIPT_URL);
    triggerNotification("Koneksi Database Cabang diperbarui.");
    loadDataFromCloud();
}

// ==========================================
// CORE DATA FETCHING (CABANG AKTIF)
// ==========================================
function loadDataFromCloud() {
    if (!SCRIPT_URL) {
        renderEmptyStates();
        return;
    }

    isLoading = true;
    renderShimmerUI();

    fetch(`${SCRIPT_URL}?action=read`)
        .then(response => response.json())
        .then(data => {
            isLoading = false;
            if (data.transactions) orders = data.transactions;
            if (data.expenses) expenses = data.expenses;

            applyAnalyticsFilter(); 
            renderExpensesTable();
            triggerNotification("Data analitik sukses disinkronkan.");
        })
        .catch(err => {
            isLoading = false;
            renderEmptyStates();
            console.log("Gagal mengambil data cabang:", err);
        });
}

// ==========================================
// KELOLA DAFTAR CABANG (VIA MASTER SPREADSHEET)
// ==========================================
function loadBranchesFromMaster() {
    if (!MASTER_SCRIPT_URL || MASTER_SCRIPT_URL === "MASUKKAN_URL_APPSCRIPT_MASTER_DISINI") {
        document.getElementById('branch-list-container').innerHTML = `<p class="text-center italic text-slate-400 py-4 text-xs border border-dashed border-slate-200 rounded-xl">URL Master Spreadsheet belum diatur di file JS.</p>`;
        return;
    }

    document.getElementById('branch-list-container').innerHTML = `<p class="text-center italic text-slate-400 py-4 text-xs">Memuat daftar cabang dari server master...</p>`;

    fetch(`${MASTER_SCRIPT_URL}?action=read`)
        .then(response => response.json())
        .then(data => {
            if (data.branches) {
                branches = data.branches.reverse(); // Urutkan cabang terbaru di atas
                renderBranchesList();
            }
        })
        .catch(err => {
            console.log("Gagal memuat cabang master:", err);
            document.getElementById('branch-list-container').innerHTML = `<p class="text-center italic text-rose-400 py-4 text-xs">Gagal terhubung ke Database Master.</p>`;
        });
}

function renderBranchesList() {
    const container = document.getElementById('branch-list-container');
    
    if(branches.length === 0) {
        container.innerHTML = `<p class="text-center italic text-slate-400 py-4 text-xs border border-dashed border-slate-200 rounded-xl">Belum ada cabang terdaftar di Master.</p>`;
        return;
    }

    container.innerHTML = branches.map(b => `
        <div class="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-3 shadow-xs mb-2">
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-700 text-xs truncate">${b.name}</p>
                <p class="text-[10px] text-slate-400 font-mono truncate">${b.url}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="copyBranchUrl('${b.url}')" class="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-all" title="Copy URL ke Konfigurasi">
                    <i class="fa-solid fa-copy text-[10px]"></i>
                </button>
                <button onclick="deleteBranch('${b.id}')" class="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-all" title="Hapus Permanen">
                    <i class="fa-solid fa-trash text-[10px]"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function addBranch() {
    const name = document.getElementById('branch-name').value.trim();
    const url = document.getElementById('branch-url').value.trim();

    if(!name || !url) return alert('Nama Cabang dan URL wajib diisi!');

    const newBranch = {
        id: `BR-${Date.now()}`,
        name: name,
        url: url
    };

    // Update UI instan
    branches.unshift(newBranch);
    renderBranchesList();
    
    document.getElementById('branch-name').value = '';
    document.getElementById('branch-url').value = '';

    // Kirim POST langsung ke Master Spreadsheet
    if (MASTER_SCRIPT_URL) {
        fetch(MASTER_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: "addBranch", ...newBranch })
        }).catch(err => console.log("Gagal tambah cabang ke master:", err));
    }
    
    triggerNotification(`Cabang ${name} disimpan ke Database Master.`);
}

function deleteBranch(id) {
    if(!confirm("Hapus URL cabang ini secara permanen dari Database Master?")) return;
    
    branches = branches.filter(b => b.id !== id);
    renderBranchesList();

    if (MASTER_SCRIPT_URL) {
        fetch(MASTER_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: "deleteBranch", id: id })
        });
    }
    triggerNotification("Perintah hapus cabang ke Master telah dikirim.");
}

function copyBranchUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        // Otomatis menempelkan URL yang dicopy ke input konfigurasi
        document.getElementById('owner-setting-url').value = url;
        triggerNotification("URL disalin dan ditempel ke form Konfigurasi!");
    });
}

// ==========================================
// ANALITIK: FILTER & GRAFIK (OVERVIEW)
// ==========================================
function applyAnalyticsFilter() {
    const mode = document.getElementById('analytics-filter').value;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let filteredOrders = [];
    let filteredExpenses = [];
    let filterLabelText = "";
    let chartLabel = "";

    if (mode === 'today') {
        filteredOrders = orders.filter(o => o.date && o.date.startsWith(todayStr));
        filteredExpenses = expenses.filter(e => e.tanggal && e.tanggal.startsWith(todayStr));
        filterLabelText = "(Hari Ini)"; chartLabel = "Arus Kas (Hari Ini)";
    } else if (mode === 'week') {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        filteredOrders = orders.filter(o => o.date && new Date(o.date) >= weekAgo);
        filteredExpenses = expenses.filter(e => e.tanggal && new Date(e.tanggal) >= weekAgo);
        filterLabelText = "(7 Hari)"; chartLabel = "Arus Kas (7 Hari Terakhir)";
    } else if (mode === 'month') {
        filteredOrders = orders.filter(o => o.date && o.date.startsWith(currentMonthStr));
        filteredExpenses = expenses.filter(e => e.tanggal && e.tanggal.startsWith(currentMonthStr));
        filterLabelText = "(Bulan Ini)"; chartLabel = "Arus Kas (Bulan Ini)";
    } else {
        filteredOrders = [...orders]; filteredExpenses = [...expenses];
        filterLabelText = "(Semua)"; chartLabel = "Arus Kas (Semua Waktu)";
    }

    document.querySelectorAll('.filter-label').forEach(el => el.innerText = filterLabelText);
    document.getElementById('chart-title').innerHTML = `<i class="fa-solid fa-chart-bar theme-color"></i> ${chartLabel}`;

    let totalIncome = 0; let validOrdersCount = 0; let totalExpense = 0;
    filteredOrders.forEach(o => {
        if (o.paymentStatus !== 'Belum Bayar') { totalIncome += Number(o.total || 0); validOrdersCount++; }
    });
    filteredExpenses.forEach(e => { totalExpense += Number(e.nominal || 0); });

    const profit = totalIncome - totalExpense;

    document.getElementById('stat-income').innerText = `Rp ${totalIncome.toLocaleString('id-ID')}`;
    document.getElementById('stat-expense').innerText = `Rp ${totalExpense.toLocaleString('id-ID')}`;
    document.getElementById('stat-profit').innerText = `Rp ${profit.toLocaleString('id-ID')}`;
    document.getElementById('stat-orders').innerText = `${validOrdersCount} Nota`;

    renderChart(mode, filteredOrders, filteredExpenses);
}

function renderChart(mode, fOrders, fExpenses) {
    const ctx = document.getElementById('cashflowChart').getContext('2d');
    let labels = []; let dataIncome = []; let dataExpense = [];

    if (mode === 'today') {
        labels = ['Pagi', 'Siang', 'Sore', 'Malam'];
        dataIncome = [0, 0, 0, 0]; dataExpense = [0, 0, 0, 0];
        const assignToTimeSlot = (dateString, val, arr) => {
            const h = new Date(dateString).getHours();
            if(h < 12) arr[0] += val; else if(h < 15) arr[1] += val; else if(h < 18) arr[2] += val; else arr[3] += val;
        };
        fOrders.forEach(o => { if (o.paymentStatus !== 'Belum Bayar') assignToTimeSlot(o.date, Number(o.total), dataIncome); });
        fExpenses.forEach(e => assignToTimeSlot(e.tanggal, Number(e.nominal), dataExpense));
    } 
    else if (mode === 'month' || mode === 'all') {
        const dateMapIncome = {}; const dateMapExpense = {};
        fOrders.forEach(o => { 
            if(o.paymentStatus !== 'Belum Bayar') {
                const d = o.date.split('T')[0]; dateMapIncome[d] = (dateMapIncome[d] || 0) + Number(o.total);
            }
        });
        fExpenses.forEach(e => { 
            const d = e.tanggal.split('T')[0]; dateMapExpense[d] = (dateMapExpense[d] || 0) + Number(e.nominal);
        });

        const allDates = [...new Set([...Object.keys(dateMapIncome), ...Object.keys(dateMapExpense)])].sort();
        const recentDates = allDates.slice(-7); 

        recentDates.forEach(d => {
            labels.push(d.split('-').slice(1).join('/')); 
            dataIncome.push(dateMapIncome[d] || 0); dataExpense.push(dateMapExpense[d] || 0);
        });
    }
    else {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
            dataIncome.push(0); dataExpense.push(0);
        }
        const today = new Date(); today.setHours(0,0,0,0);
        fOrders.forEach(o => {
            if (!o.date || o.paymentStatus === 'Belum Bayar') return;
            const diffDays = Math.floor(Math.abs(today - new Date(o.date).setHours(0,0,0,0)) / 86400000);
            if (diffDays <= 6) dataIncome[6 - diffDays] += Number(o.total);
        });
        fExpenses.forEach(e => {
            if (!e.tanggal) return;
            const diffDays = Math.floor(Math.abs(today - new Date(e.tanggal).setHours(0,0,0,0)) / 86400000);
            if (diffDays <= 6) dataExpense[6 - diffDays] += Number(e.nominal);
        });
    }

    if (cashflowChartInstance) cashflowChartInstance.destroy();

    cashflowChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Pemasukan (Rp)', data: dataIncome, backgroundColor: '#40E0D0', borderRadius: 4, barPercentage: 0.6 },
                { label: 'Pengeluaran (Rp)', data: dataExpense, backgroundColor: '#f43f5e', borderRadius: 4, barPercentage: 0.6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { borderDash: [4, 4], color: '#f1f5f9' } }, x: { grid: { display: false } } },
            plugins: { legend: { position: 'top', labels: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } } } }
        }
    });
}

// ==========================================
// RENDER & LOGIC: KELOLA PENGELUARAN (CRUD)
// ==========================================
function renderExpensesTable() {
    const tbody = document.getElementById('expenses-table-body');
    if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 italic text-slate-400 bg-slate-50/50">Data pengeluaran masih kosong.</td></tr>`;
        return;
    }
    tbody.innerHTML = expenses.map(exp => {
        const dStr = exp.tanggal ? new Date(exp.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3">${dStr}</td>
                <td class="px-4 py-3 font-mono text-[10px] text-slate-400">${exp.id || '-'}</td>
                <td class="px-4 py-3 font-bold text-slate-700">${exp.keterangan}</td>
                <td class="px-4 py-3"><span class="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md text-[10px]">${exp.sumber_dana}</span></td>
                <td class="px-4 py-3 text-right font-bold text-rose-500">Rp ${Number(exp.nominal).toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="deleteExpense('${exp.id}')" class="text-rose-500 bg-rose-50 w-7 h-7 rounded-lg hover:bg-rose-100 transition-all" title="Hapus"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function openExpenseModal() {
    const now = new Date(); const tzOffset = now.getTimezoneOffset() * 60000;
    const localNow = (new Date(now - tzOffset)).toISOString().split('T')[0];
    document.getElementById('form-exp-date').value = localNow;
    document.getElementById('form-exp-name').value = '';
    document.getElementById('form-exp-amount').value = '';
    document.getElementById('expenseModal').classList.remove('hidden');
}

function saveExpense() {
    const dateInput = document.getElementById('form-exp-date').value;
    const name = document.getElementById('form-exp-name').value.trim();
    const amount = parseFloat(document.getElementById('form-exp-amount').value);
    const source = document.getElementById('form-exp-source').value;

    if (!name || isNaN(amount)) return alert('Keterangan dan nominal wajib diisi!');

    const newExpense = {
        id: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
        tanggal: dateInput ? new Date(dateInput).toISOString() : new Date().toISOString(),
        keterangan: name, nominal: amount, sumber_dana: source
    };

    expenses.unshift(newExpense); 
    renderExpensesTable();
    applyAnalyticsFilter();
    document.getElementById('expenseModal').classList.add('hidden');

    if (SCRIPT_URL) {
        fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: "addExpense", ...newExpense })
        });
    }
    triggerNotification(`Pengeluaran dicatat: Rp ${amount.toLocaleString('id-ID')}`);
}

function deleteExpense(expId) {
    if(!confirm("Yakin ingin menghapus catatan pengeluaran ini?")) return;
    expenses = expenses.filter(e => e.id !== expId);
    renderExpensesTable();
    applyAnalyticsFilter();

    if (SCRIPT_URL) {
        fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: "deleteExpense", id: expId })
        });
    }
    triggerNotification("Data pengeluaran berhasil dihapus.");
}

// ==========================================
// UTILS & UI HELPERS
// ==========================================
function renderShimmerUI() {
    document.getElementById('stat-income').innerHTML = `<div class="w-1/2 h-6 bg-slate-200 rounded animate-pulse"></div>`;
    document.getElementById('stat-expense').innerHTML = `<div class="w-1/2 h-6 bg-slate-200 rounded animate-pulse"></div>`;
    document.getElementById('stat-profit').innerHTML = `<div class="w-1/2 h-6 bg-slate-200 rounded animate-pulse"></div>`;
    document.getElementById('stat-orders').innerHTML = `<div class="w-1/2 h-6 bg-slate-200 rounded animate-pulse"></div>`;
    
    document.getElementById('expenses-table-body').innerHTML = `
        <tr><td colspan="6" class="p-3"><div class="w-full h-8 bg-slate-200 rounded animate-pulse"></div></td></tr>
        <tr><td colspan="6" class="p-3"><div class="w-full h-8 bg-slate-200 rounded animate-pulse"></div></td></tr>
    `;
}

function renderEmptyStates() {
    document.getElementById('stat-income').innerText = "Rp 0";
    document.getElementById('stat-expense').innerText = "Rp 0";
    document.getElementById('stat-profit').innerText = "Rp 0";
    document.getElementById('stat-orders').innerText = "0 Nota";
    document.getElementById('expenses-table-body').innerHTML = `<tr><td colspan="6" class="text-center py-8 italic text-slate-400">Silakan isi URL konfigurasi untuk memuat data cabang.</td></tr>`;
}

function triggerNotification(msg) {
    const banner = document.getElementById('liveAlert');
    if(!banner) return;
    document.getElementById('alertMessage').innerText = msg;
    banner.classList.remove('hidden');
    banner.classList.add('animate-bounce');
    setTimeout(() => {
        banner.classList.remove('animate-bounce');
        banner.classList.add('hidden');
    }, 4000);
}