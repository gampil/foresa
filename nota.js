        // URL MASTER DB (Untuk Info Kontak)
        const MASTER_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwidT5jhAd4vtRpOiqRf0C5yc8quxuzTioutoYdF9d2NufVCbtS0moyvH6GCrhOxkgx/exec";
        
        // URL CABANG 1 (Untuk Layanan & Harga)
        const SCRIPT_URL_1 = "https://script.google.com/macros/s/AKfycbxJFC7tabDhR5cC2XiZuCJ5EMZN6jShxvAyVIsOmgilDhE4WEuUjC2r_V93_Jnd_GAs/exec";
        
        // URL CABANG 2 (Untuk Pelacakan)
        const SCRIPT_URL_2 = "https://script.google.com/macros/s/AKfycbwORvBmZ06otsQH_gbhFcPQKcy8GLSmk-1BmIVaFFKg2c7loRRhwDfVwF7qcxyJ5OC6/exec";

        let allPublicServices = [];
        let activePublicCategory = 'Semua';
        let globalPublicPhone = "6281234567890"; // Fallback jika gagal muat

        // Toggle Mobile Menu
        function toggleMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            menu.classList.toggle('hidden');
        }

        const formatRupiah = (angka) => {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
        };

        // ==============================================
        // 1. RENDER LAYANAN & INFO DARI MASTER (DUAL FETCH)
        // ==============================================
        async function fetchServices() {
            // A. Trik Info Dari Master DB (Memuat SEMUA Cabang)
            try {
                const masterRes = await fetch(`${MASTER_SCRIPT_URL}?action=getMasterData&t=${Date.now()}`);
                const masterData = await masterRes.json();
                
                if (masterData && masterData.branches) {
                    // Cetak semua cabang ke Footer
                    renderAllBranches(masterData.branches);
                    
                    // Tetapkan Cabang 1 sebagai nomor default untuk tombol WA hijau yang melayang di pojok
                    const targetBranch = masterData.branches.find(b => b.url === SCRIPT_URL_1) || masterData.branches[0];
                    if (targetBranch && targetBranch.phone) {
                        globalPublicPhone = targetBranch.phone.replace(/[-+ _]/g, "");
                        if (globalPublicPhone.startsWith("0")) globalPublicPhone = "62" + globalPublicPhone.slice(1);
                        
                        const waBtn = document.getElementById('floating-wa');
                        if (waBtn) waBtn.href = `https://wa.me/${globalPublicPhone}`;
                    }
                }
            } catch (e) {
                console.log("Gagal sinkron Master DB info kontak:", e);
                const container = document.getElementById('branch-list-container');
                if (container) container.innerHTML = '<p class="text-sm text-rose-400 italic">Gagal memuat lokasi cabang.</p>';
            }

            // B. Tarik Daftar Layanan dari Cabang 1
            try {
                const response = await fetch(`${SCRIPT_URL_1}?action=read`);
                const data = await response.json();
                allPublicServices = data.customServices || [];
                
                renderPublicCategories();
                renderServices();
            } catch (error) {
                document.getElementById('loadingLayanan').innerHTML = `
                    <div class="bg-red-50 text-red-500 px-6 py-4 rounded-xl border border-red-200 text-center max-w-sm mx-auto">
                        <i class="fas fa-exclamation-triangle mb-2 text-3xl"></i>
                        <p class="font-bold">Koneksi Gagal</p>
                        <p class="text-sm mt-1">Tidak dapat memuat layanan dari server Cabang 1.</p>
                    </div>`;
            }
        }

        // FUNGSI BARU: Mencetak semua list cabang ke HTML
        function renderAllBranches(branches) {
            const container = document.getElementById('branch-list-container');
            if (!container) return;
            
            if (!branches || branches.length === 0) {
                container.innerHTML = '<p class="text-sm text-slate-400 italic">Belum ada cabang terdaftar di Master.</p>';
                return;
            }
            
            // Looping semua cabang yang ada di Master DB
            container.innerHTML = branches.map(b => {
                let phoneClean = b.phone ? b.phone.replace(/[-+ _]/g, "") : "";
                if (phoneClean.startsWith("0")) phoneClean = "62" + phoneClean.slice(1);
                
                return `
                <div class="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 text-sm hover:bg-slate-700/50 transition-all">
                    <h4 class="font-bold text-tosca-400 mb-1 flex items-center gap-2">
                        <i class="fas fa-store text-xs"></i> ${b.name.toUpperCase()}
                    </h4>
                    <div class="space-y-1.5 mt-2">
                        <p class="text-slate-300 text-[11px] leading-relaxed flex items-start">
                            <i class="fas fa-map-marker-alt text-tosca-500/70 mr-2 mt-0.5"></i> 
                            <span class="flex-1">${b.address || 'Alamat belum diatur'}</span>
                        </p>
                        <p class="text-slate-300 text-[11px] flex items-center">
                            <i class="fab fa-whatsapp text-tosca-500/70 mr-2 text-sm"></i> 
                            <a href="https://wa.me/${phoneClean}" target="_blank" class="hover:text-white hover:underline transition-all font-medium">
                                +${phoneClean || '-'}
                            </a>
                        </p>
                    </div>
                </div>
                `;
            }).join('');
        }


        // ==============================================
        // 1.5 FITUR FILTER KATEGORI LAYANAN PUBLIC
        // ==============================================
        function renderPublicCategories() {
            const catContainer = document.getElementById('service-categories-public');
            if (!catContainer) return;
            
            catContainer.classList.remove('hidden');
            
            // Ambil nama kategori unik dari data
            const uniqueCategories = ['Semua', ...new Set(allPublicServices.map(s => s.type))];
            
            catContainer.innerHTML = uniqueCategories.map(cat => {
                const isActive = activePublicCategory === cat;
                // Hilangkan whitespace-nowrap agar bisa membungkus ke baris bawah saat layar sempit
                const baseClass = "px-4 py-1.5 sm:px-6 sm:py-2 rounded-full text-[11px] sm:text-sm font-semibold transition-all duration-300 border shadow-sm cursor-pointer";
                const activeClass = isActive 
                    ? "bg-tosca-500 text-white border-tosca-500 scale-105" 
                    : "bg-white text-slate-500 border-slate-200 hover:bg-tosca-50 hover:border-tosca-300 hover:text-tosca-600";
                    
                return `<button onclick="setPublicCategory('${cat}')" class="${baseClass} ${activeClass}">${cat}</button>`;
            }).join('');
        }

        function setPublicCategory(cat) {
            activePublicCategory = cat;
            renderPublicCategories(); // Ubah warna tombol
            renderServices();         // Tampilkan ulang sesuai filter
        }

        function renderServices() {
            const container = document.getElementById('services-container');
            document.getElementById('loadingLayanan').classList.add('hidden');
            container.classList.remove('hidden');

            // Filter data sesuai tombol yang diklik
            let displayServices = activePublicCategory === 'Semua' 
                ? allPublicServices 
                : allPublicServices.filter(s => s.type === activePublicCategory);

            if (!displayServices || displayServices.length === 0) {
                container.innerHTML = `<p class="col-span-full text-center font-medium text-slate-500 py-10 w-full">Belum ada layanan yang ditambahkan pada kategori ini.</p>`;
                return;
            }

            let html = '';
            displayServices.forEach(service => {
                // Desain Baru: 2 Kolom, Compact, Elegan Full Tosca
                html += `
                    <div class="bg-gradient-to-br from-white to-tosca-50/50 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-3 sm:p-5 border border-tosca-200 flex flex-col h-full relative overflow-hidden group">
                        
                        <div class="absolute -top-10 -right-10 w-24 h-24 bg-tosca-100 rounded-full opacity-50 group-hover:scale-150 transition-all duration-500 z-0"></div>
                        
                        <div class="relative z-10 flex flex-col h-full">
                            <div class="mb-2.5">
                                <span class="inline-block px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-tosca-700 bg-tosca-100/70 border border-tosca-200 rounded-md">
                                    ${service.type}
                                </span>
                            </div>
                            
                            <h3 class="text-xs sm:text-base font-bold mb-3 sm:mb-4 text-slate-800 leading-snug group-hover:text-tosca-600 transition-colors line-clamp-2">${service.name}</h3>
                            
                            <div class="mt-auto border-t border-tosca-100 pt-2.5 sm:pt-3 flex justify-between items-end gap-1">
                                <div>
                                    <p class="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-0.5 sm:mb-1">Tarif</p>
                                    <span class="text-[12px] sm:text-lg font-black text-tosca-600">${formatRupiah(service.price)}</span>
                                </div>
                                <a href="https://wa.me/${globalPublicPhone}?text=Halo%20Foresa,%20saya%20ingin%20pesan%20layanan%20${encodeURIComponent(service.name)}" target="_blank" class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-tosca-500 flex items-center justify-center text-white hover:bg-tosca-600 transition-all shadow-sm shrink-0" title="Pesan via WhatsApp">
                                    <i class="fab fa-whatsapp text-sm sm:text-base"></i>
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
   
