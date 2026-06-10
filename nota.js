
        // URL UNTUK LIST LAYANAN HARGA (Menu)
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbydTg6Qwgjbqhu95AW0IFd7uTRgJughZZgjnunHDjHTrA48vAYj22jYdvQ5RUC7AXG7ng/exec';
        
        // DUA URL CABANG UNTUK PENCARIAN NOTA
        const SCRIPT_URL_1 = "https://script.google.com/macros/s/AKfycbxJFC7tabDhR5cC2XiZuCJ5EMZN6jShxvAyVIsOmgilDhE4WEuUjC2r_V93_Jnd_GAs/exec";
        const SCRIPT_URL_2 = "https://script.google.com/macros/s/AKfycbwORvBmZ06otsQH_gbhFcPQKcy8GLSmk-1BmIVaFFKg2c7loRRhwDfVwF7qcxyJ5OC6/exec";

        // Toggle Mobile Menu
        function toggleMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            menu.classList.toggle('hidden');
        }

        const formatRupiah = (angka) => {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
        };

        // ==============================================
        // 1. RENDER LAYANAN KARTU GRID (Original)
        // ==============================================
        async function fetchServices() {
            try {
                const response = await fetch(`${SCRIPT_URL}?action=read`);
                const data = await response.json();
                renderServices(data.customServices);
            } catch (error) {
                document.getElementById('loadingLayanan').innerHTML = `
                    <div class="bg-red-50 text-red-500 px-6 py-4 rounded-xl border border-red-200 text-center max-w-sm mx-auto">
                        <i class="fas fa-exclamation-triangle mb-2 text-3xl"></i>
                        <p class="font-bold">Koneksi Gagal</p>
                        <p class="text-sm mt-1">Tidak dapat memuat data dari server kasir.</p>
                    </div>`;
            }
        }

        function renderServices(services) {
            const container = document.getElementById('services-container');
            document.getElementById('loadingLayanan').classList.add('hidden');
            container.classList.remove('hidden');

            if (!services || services.length === 0) {
                container.innerHTML = `<p class="col-span-full text-center font-medium text-slate-500 py-10">Belum ada layanan yang ditambahkan pada kasir.</p>`;
                return;
            }

            let html = '';
            services.forEach(service => {
                let typeColor = service.type.toLowerCase() === 'kiloan' ? 'text-amber-600 bg-amber-50 border-amber-200' : 
                                service.type.toLowerCase() === 'satuan' ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-tosca-600 bg-tosca-50 border-tosca-200';

                html += `
                    <div class="bg-white rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 p-6 border border-slate-100 flex flex-col h-full relative overflow-hidden group">
                        <div class="absolute -top-12 -right-12 w-32 h-32 bg-tosca-50 rounded-full opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-500 z-0"></div>
                        
                        <div class="relative z-10 flex flex-col h-full">
                            <div class="mb-4">
                                <span class="inline-block px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${typeColor} border rounded-lg">
                                    ${service.type}
                                </span>
                            </div>
                            
                            <h3 class="text-lg font-bold mb-6 text-slate-800 leading-snug group-hover:text-tosca-600 transition-colors">${service.name}</h3>
                            
                            <div class="mt-auto border-t border-slate-100/80 pt-5 flex justify-between items-center">
                                <div>
                                    <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Tarif</p>
                                    <span class="text-xl font-black text-slate-800">${formatRupiah(service.price)}</span>
                                </div>
                                <a href="https://wa.me/6281234567890?text=Halo%20Foresa,%20saya%20ingin%20pesan%20layanan%20${service.name}" target="_blank" class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-tosca-500 hover:bg-tosca-500 hover:text-white transition-all duration-300 border border-slate-200 hover:border-tosca-500 shadow-sm">
                                    <i class="fab fa-whatsapp text-lg"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        // ==============================================
        // 2. LOGIKA PELACAKAN (Dari nota.js)
        // ==============================================
        async function cekStatus() {
            const orderIdInput = document.getElementById('orderId').value.trim();
            const boxHasil = document.getElementById('hasilPencarian');
            const loader = document.getElementById('loadingStatus');

            if (!orderIdInput) {
                alert("Mohon masukkan ID Transaksi / Nota terlebih dahulu.");
                return;
            }

            // Sembunyikan hasil lama, tampilkan loading spinner
            boxHasil.classList.add('hidden');
            loader.classList.remove('hidden');

            // Set teks sementara (menjaga UI agar tidak kosong saat dimuat)
            document.getElementById('track-id').innerText = orderIdInput;
            document.getElementById('track-cust').innerText = "Mencari data...";

            // Lakukan pencarian ke 2 database
            await fetchStatusPelanggan(orderIdInput);

            // Sembunyikan loading, munculkan hasil
            loader.classList.add('hidden');
            boxHasil.classList.remove('hidden');
        }

        async function checkDatabase(url, orderId) {
            if (!url || url.includes("GANTI_DENGAN")) return null;
            try {
                const response = await fetch(`${url}?order=${encodeURIComponent(orderId)}`);
                const cloudData = await response.json();
                if (cloudData && cloudData.transactions && cloudData.transactions.length > 0) {
                    return cloudData.transactions[0]; 
                }
            } catch (err) {
                console.error(`Gagal menghubungi database:`, err);
            }
            return null; 
        }

        async function fetchStatusPelanggan(orderId) {
            // Coba cari di DB 1
            let orderData = await checkDatabase(SCRIPT_URL_1, orderId);

            // Jika tidak ketemu di DB 1, cari di DB 2
            if (!orderData) {
                console.log("Nota tidak ditemukan di DB 1, mencoba mencari di DB 2...");
                orderData = await checkDatabase(SCRIPT_URL_2, orderId);
            }

            // Tampilkan Hasil
            if (orderData) {
                updateUIData(orderData); 
            } else {
                showNotFound("TIDAK DITEMUKAN", "Maaf, nomor nota tersebut tidak terdaftar di sistem kami.");
            }
        }

        function showNotFound(title, message) {
            document.getElementById('track-id').innerText = title;
            document.getElementById('track-cust').innerText = message;
            
            document.getElementById('track-service').innerText = "-";
            document.getElementById('track-total').innerText = "-";
            document.getElementById('track-badge').innerText = "INVALID";
            document.getElementById('track-badge').className = "text-[10px] font-bold px-3 py-1 rounded-full shadow-xs bg-slate-400 text-white";
            
            const steps = document.querySelectorAll('.tracking-step');
            steps.forEach((step) => setStepActive(step, false, false));
        }

        function updateUIData(order) {
            document.getElementById('track-id').innerText = order.id;
            document.getElementById('track-cust').innerText = order.customer;
            document.getElementById('track-service').innerText = order.service;
            document.getElementById('track-total').innerText = `Rp ${Number(order.total).toLocaleString('id-ID')}`;
            
            let badgeColor = "bg-amber-500 text-white"; 
            if (order.status === 'Selesai') badgeColor = "bg-tosca-500 text-white";
            if (order.status === 'Diambil') badgeColor = "bg-emerald-500 text-white";
            document.getElementById('track-badge').className = `text-[10px] font-bold px-3 py-1 rounded-full shadow-xs ${badgeColor}`;
            document.getElementById('track-badge').innerText = order.status.toUpperCase();
            
            if(document.getElementById('track-date-in')) document.getElementById('track-date-in').innerText = formatTanggalIndo(order.date);
            if(document.getElementById('track-date-out')) document.getElementById('track-date-out').innerText = order.estimatedPickup ? formatTanggalIndo(order.estimatedPickup) : "-";

            const trackPaymentEl = document.getElementById('track-payment-status');
            if (trackPaymentEl) {
                const isBelumBayar = order.paymentStatus === 'Belum Bayar';
                trackPaymentEl.innerText = isBelumBayar ? '🔴 Belum Bayar' : '🟢 Lunas';
                trackPaymentEl.className = isBelumBayar
                    ? 'inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-xl text-[11px] bg-rose-50 border border-rose-200 text-rose-600 mt-0.5'
                    : 'inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-xl text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-600 mt-0.5';
            }

            const steps = document.querySelectorAll('.tracking-step');
            steps.forEach((step) => setStepActive(step, false, false));

            if (order.status === "Diproses") {
                setStepActive(steps[0], true, false); 
                setStepActive(steps[1], true, true);  
            } else if (order.status === "Selesai") {
                setStepActive(steps[0], true, false); 
                setStepActive(steps[1], true, false); 
                setStepActive(steps[2], true, true);  
            } else if (order.status === "Diambil") {
                setStepActive(steps[0], true, false); 
                setStepActive(steps[1], true, false); 
                setStepActive(steps[2], true, false); 
                setStepActive(steps[3], true, false); 
            }
        }

        function setStepActive(stepElement, isActive, isPulse) {
            if(!stepElement) return;
            const dot = stepElement.querySelector('.step-dot');
            const ping = stepElement.querySelector('.animate-ping');
            const title = stepElement.querySelector('.step-title');

            if(isActive) {
                if(dot) dot.className = "absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-tosca-500 border-2 border-white shadow-sm z-10 step-dot";
                if(title) title.className = "text-xs font-bold text-slate-700 step-title";
            } else {
                if(dot) dot.className = "absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-200 border-2 border-white z-10 step-dot";
                if(title) title.className = "text-xs font-semibold text-slate-400 step-title";
            }

            if (ping) {
                if (isPulse) {
                    ping.className = "absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-tosca-500 opacity-75 animate-ping";
                    ping.classList.remove('hidden');
                } else {
                    ping.classList.add('hidden');
                }
            }
        }

        function formatTanggalIndo(dateStr) {
            if (!dateStr) return "-";
            const d = new Date(dateStr);
            const pad = (n) => n.toString().padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

// ==============================================
// 3. AUTO RUN KETIKA HALAMAN DIBUKA
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Muat daftar layanan (katalog)
    fetchServices();

    // 2. Cek apakah ada parameter '?order=' di URL link
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get('order');
    
    if (orderParam) {
        // Isi kolom input otomatis
        document.getElementById('orderId').value = orderParam;
        
        // Arahkan layar / scroll otomatis ke bagian pelacakan
        setTimeout(() => {
            document.getElementById('lacak').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500); // jeda sedikit agar efek scroll terlihat mulus

        // Jalankan pelacakan otomatis
        cekStatus();
        
        // (Opsional) Ulangi pembaruan data setiap 10 detik agar realtime
        setInterval(() => {
            // Pastikan tidak mereset UI jika user sedang mengetik nota lain
            const currentInput = document.getElementById('orderId').value.trim();
            if(currentInput === orderParam) {
                fetchStatusPelanggan(orderParam);
            }
        }, 10000);
    }
});
   