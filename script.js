
// ============================================================
// KONFIGURASI
// ============================================================
const CORRECT_PASSWORD = '000000';
const LOADING_DURATION_MS = 3000;
 
// ============================================================
// REFERENSI ELEMEN
// ============================================================
const loadingScreen = document.getElementById('loading-screen');
const passwordPage  = document.getElementById('password-page');
const mainPage      = document.getElementById('main-page');
 
const passwordForm  = document.getElementById('password-form');
const passwordCard  = document.getElementById('password-card');
const passwordError = document.getElementById('password-error');
 
// ============================================================
// UTIL: pindah antar sesi (SPA manual via display none)
// ============================================================
const sceneTransitionEl = document.getElementById('scene-transition');
 
function showSection(section) {
  section.classList.remove('hidden-section');
  section.classList.add('scene-reveal');
}
 
function hideSection(section) {
  section.classList.add('hidden-section');
  section.classList.remove('scene-reveal', 'fade-in');
}
 
// ============================================================
// FLOWER CURTAIN TRANSITION (JATUH & BERPUTAR KELUAR)
// ============================================================
const FLOWER_TRANSITION_CONFIG = {
  flowerCount: 75, // 75 bunga untuk tirai SANGAT padat (memenuhi layar) 🌻
  flowerSrc: 'bunga.png', // File PNG bunga utama
  fallDurationMs: 1800, // Fase jatuh: 1.8 detik
  holdDurationMs: 250,  // Hold: 250ms (pause sebelum scatter)
  scatterDurationMs: 100, // Fase terbang keluar: 1.9 detik (diperlambat, lebih anggun & romantis)
  scatterStaggerMaxMs: 550 // Delay tambahan MAKSIMUM untuk bunga terjauh dari pusat (radial ripple 'membuka dari tengah')
};
 
// Fallback visual SVG bunga pastel
const RAW_FLOWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFF0ED"/><stop offset="55%" stop-color="#D6A6A0"/><stop offset="100%" stop-color="#C9A66B"/></radialGradient><radialGradient id="c" cx="40%" cy="40%" r="50%"><stop offset="0%" stop-color="#FFF5D6"/><stop offset="100%" stop-color="#C9A66B"/></radialGradient></defs><g fill="url(#g)"><path d="M50 12 C58 2, 76 8, 75 24 C74 38, 58 45, 50 50 C42 45, 26 38, 25 24 C24 8, 42 2, 50 12 Z"/><path d="M50 88 C58 98, 76 92, 75 76 C74 62, 58 55, 50 50 C42 55, 26 62, 25 76 C24 92, 42 98, 50 88 Z"/><path d="M12 50 C2 42, 8 24, 24 25 C38 26, 45 42, 50 50 C45 58, 38 74, 24 75 C8 76, 2 58, 12 50 Z"/><path d="M88 50 C98 42, 92 24, 76 25 C62 26, 55 42, 50 50 C55 58, 62 74, 76 75 C92 76, 98 58, 88 50 Z"/><path d="M23 23 C16 14, 30 4, 40 16 C48 27, 48 42, 50 50 C42 48, 27 48, 16 40 C4 30, 14 16, 23 23 Z"/><path d="M77 23 C86 14, 96 28, 84 38 C73 46, 58 48, 50 50 C52 42, 54 27, 62 16 C70 4, 84 14, 77 23 Z"/><path d="M23 77 C14 86, 4 72, 16 62 C27 54, 42 52, 50 50 C48 58, 48 73, 40 84 C30 96, 16 86, 23 77 Z"/><path d="M77 77 C86 86, 72 96, 62 84 C54 73, 52 58, 50 50 C58 52, 73 52, 84 60 C96 70, 86 84, 77 77 Z"/></g><circle cx="50" cy="50" r="13" fill="url(#c)" stroke="#D6A6A0" stroke-width="1.5"/></svg>`;
const DEFAULT_FLOWER_SVG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(RAW_FLOWER_SVG);
 
// Preload asset bunga ke memory browser
const _flowerImgPreload = new Image();
_flowerImgPreload.src = FLOWER_TRANSITION_CONFIG.flowerSrc;
 
let isFlowerTransitioning = false;

// ------------------------------------------------------------
// ANTRIAN TRANSISI (fix bug utama: stuck di section-blown)
// ------------------------------------------------------------
// Sebelumnya, flowerTransition() punya guard:
//   if (isFlowerTransitioning) return;
// Guard ini langsung `return` TANPA pernah memanggil callback-nya kalau ada
// pemanggilan kedua yang datang saat siklus bunga sebelumnya masih berjalan.
// Itu persis yang terjadi di holdSuccess(): transisi cake->blown (dipicu di
// t+500ms) butuh ±5.6 detik total (fase jatuh + hold + scatter + cleanup),
// sedangkan transisi blown->wish dijadwalkan menyusul di t+3200ms — masih di
// tengah siklus pertama. Panggilan kedua pun didiamkan begitu saja, sehingga
// hideSection(blownSection)/showSection(wishSection) TIDAK PERNAH dieksekusi
// dan halaman terlihat "stuck" di section-blown. Bukan soal argumen (500, 600)
// yang tidak dipakai — argumen ekstra ke fungsi JS memang diabaikan begitu
// saja dan tidak menyebabkan error atau hang.
// Perbaikan: panggilan yang datang saat sibuk di-queue, lalu otomatis
// dijalankan begitu siklus yang sedang berjalan benar-benar selesai
// (termasuk fase scatter-nya, bukan cuma sampai callback-nya dipanggil) —
// supaya urutan section-swap tetap terjamin benar dan tidak ada dua tirai
// bunga yang saling tumpang tindih di DOM.
let flowerTransitionQueue = [];
let flowerCycleTimers = [];

/**
 * FLOWER CURTAIN TRANSITION (GPU Accelerated):
 * 
 * Fase 1 (JATUH): Bunga jatuh dari luar batas atas (Y < 0) ke posisi grid
 *                 (berbasis rasio layar) untuk menutupi layar secara padat
 * Fase 2 (SCATTER): Bunga terbang menjauh dari TITIK TENGAH layar (radial
 *                   center-out), rotasi berlawanan arah jarum jam, dengan
 *                   stagger berbasis jarak — efek "membuka dari tengah"
 * Fase 3 (CLEANUP): Bersihkan DOM & reset overlay, lalu jalankan transisi
 *                   berikutnya di antrian (jika ada)
 */
function flowerTransition(callback) {
  if (isFlowerTransitioning) {
    flowerTransitionQueue.push(callback);
    return;
  }
  runFlowerCycle(callback);
}

function runFlowerCycle(callback) {
  isFlowerTransitioning = true;
  // Bersihkan timer sisa dari siklus sebelumnya (safety net, seharusnya sudah
  // habis sendiri di titik ini karena kita hanya start siklus baru setelah
  // yang lama selesai — tapi tetap dijaga agar tidak ada timer nyasar).
  flowerCycleTimers.forEach(id => clearTimeout(id));
  flowerCycleTimers = [];

  const overlay = document.getElementById('flower-transition-overlay');
  const stage = document.getElementById('flower-transition-stage');

  if (!overlay || !stage) {
    console.error("CRITICAL ERROR: Elemen id='flower-transition-overlay' atau id='flower-transition-stage' TIDAK DITEMUKAN di HTML!");
    try {
      if (callback) callback();
    } catch (error) {
      console.error("FATAL ERROR pada eksekusi navigasi section (callback):", error);
    }
    isFlowerTransitioning = false;
    advanceFlowerQueue();
    return;
  }

  stage.innerHTML = '';
  overlay.classList.add('active');

  const count = FLOWER_TRANSITION_CONFIG.flowerCount;
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const centerX = vw / 2;
  const centerY = vh / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY) || 1;
  const flowers = [];

  // ========== GRID BERBASIS ASPECT RATIO LAYAR ==========
  // Grid 12-kolom tetap (versi lama) menyisakan baris terakhir nyaris kosong
  // saat count tidak habis dibagi 12 (75/12 = 6.25 → baris ke-7 cuma terisi
  // 3 dari 12 sel = ada strip kosong lebar di bagian bawah layar). Di sini
  // kolom & baris dihitung mengikuti rasio vw/vh, lalu sel yang "kebagian"
  // bunga diacak urutannya (Fisher–Yates) supaya sel yang TIDAK kebagian
  // bunga (saat totalCells > count) tersebar merata ke seluruh grid, bukan
  // menumpuk selalu di baris/kolom terakhir.
  const aspect = vw / (vh || 1);
  const cols = Math.max(4, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const totalCells = cols * rows;
  const cellOrder = Array.from({ length: totalCells }, (_, idx) => idx);
  for (let i = cellOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cellOrder[i], cellOrder[j]] = [cellOrder[j], cellOrder[i]];
  }
  const cellWidth = vw / cols;
  const cellHeight = vh / rows;

  for (let i = 0; i < count; i++) {
    const img = document.createElement('img');
    img.className = 'flower-curtain';
    img.alt = 'flower';

    const cell = cellOrder[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);

    // ========== FASE 1: JATUH DARI ATAS (DENSE COVERAGE) ==========
    // Ukuran EKSTREM 30px–180px (bukan 50–100px seperti sebelumnya): bunga
    // besar menutup celah antar bunga kecil, sehingga tirai benar-benar
    // 100% padat menutupi layar saat jatuh.
    const size = 30 + Math.random() * 400;
    const halfSize = size / 2;

    const endX = col * cellWidth + Math.random() * cellWidth;
    const endY = row * cellHeight + Math.random() * cellHeight;
    // Titik jatuh dimulai kira-kira di atas titik pendaratannya sendiri
    // (bukan dari grid 12-kolom terpisah seperti kode lama) + sedikit
    // goyangan horizontal acak supaya tetap terlihat natural.
    const startX = endX + (Math.random() * 120 - 60);
    const startY = -100 - Math.random() * 200;

    // ========== FASE 2: RADIAL CENTER-OUT DISPERSION ==========
    // Arah lempar TIDAK LAGI acak (Math.random() * Math.PI * 2 dihapus).
    // Dihitung dari vektor (titik tengah layar → posisi akhir bunga) pakai
    // Math.atan2, sehingga setiap bunga terbang tepat menjauh dari pusat.
    const dx = endX - centerX;
    const dy = endY - centerY;
    const scatterAngle = Math.atan2(dy, dx);
    const radius = Math.sqrt(dx * dx + dy * dy);
    const scatterDist = Math.max(vw, vh) * 1.3;
    const scatterX = Math.round(Math.cos(scatterAngle) * scatterDist);
    const scatterY = Math.round(Math.sin(scatterAngle) * scatterDist);

    // Rotasi DIPAKSA hanya berlawanan arah jarum jam (nilai negatif):
    // -180deg sampai -360deg.
    const scatterRot = -(180 + Math.random() * 180);

    // Staggered delay BERBASIS JARAK dari pusat: radius kecil (dekat pusat)
    // → scatterDelay kecil (terbang duluan). Radius besar (di pinggir) →
    // scatterDelay besar (terbang belakangan). Hasilnya: layar terlihat
    // "membuka dari tengah" secara radial, bukan serempak/acak.
    const scatterDelay = ((radius / maxRadius) * FLOWER_TRANSITION_CONFIG.scatterStaggerMaxMs / 1000).toFixed(3);

    const fallDelay = (i * 0.015).toFixed(3);

    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.marginLeft = `-${halfSize}px`;
    img.style.marginTop = `-${halfSize}px`;

    // FASE 1 (Jatuh)
    img.style.setProperty('--start-x', `${startX}px`);
    img.style.setProperty('--start-y', `${startY}px`);
    img.style.setProperty('--end-x', `${endX}px`);
    img.style.setProperty('--end-y', `${endY}px`);

    // FASE 2 (Scatter radial)
    img.style.setProperty('--scatter-x', `${scatterX}px`);
    img.style.setProperty('--scatter-y', `${scatterY}px`);
    img.style.setProperty('--rot', `${scatterRot}deg`);

    // Delay untuk cascade effect
    img.style.setProperty('--fall-delay', `${fallDelay}s`);
    img.style.setProperty('--scatter-delay', `${scatterDelay}s`);

    img.onerror = function() {
      this.onerror = null;
      this.src = DEFAULT_FLOWER_SVG;
    };
    img.src = FLOWER_TRANSITION_CONFIG.flowerSrc;

    stage.appendChild(img);
    flowers.push(img);
  }

  // ========== TRIGGER FASE 1: JATUH ==========
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flowers.forEach(f => f.classList.add('is-falling'));
    });
  });

  const maxFallDelayMs = (count - 1) * 15;
  const totalFallTimeMs = FLOWER_TRANSITION_CONFIG.fallDurationMs + maxFallDelayMs;

  // ========== TRIGGER FASE 2: SCATTER ==========
  const revealTimer = setTimeout(() => {
    // PROTEKSI FATAL ERROR: Mencegah sistem freeze apabila terjadi kegagalan di logic navigasi luar
    try {
      if (callback) callback();
    } catch (error) {
      console.error("FATAL ERROR pada eksekusi navigasi section (callback):", error);
    }

    flowers.forEach(f => {
      f.classList.remove('is-falling');
      f.classList.add('is-scattering');
    });

    // ========== FASE 3: CLEANUP ==========
    const totalScatterTimeMs = FLOWER_TRANSITION_CONFIG.scatterDurationMs + FLOWER_TRANSITION_CONFIG.scatterStaggerMaxMs;

    const cleanupTimer = setTimeout(() => {
      overlay.classList.remove('active');
      stage.innerHTML = '';
      isFlowerTransitioning = false;
      // Kalau ada sceneTransition() lain yang di-queue saat siklus ini
      // berjalan, jalankan sekarang — inilah yang menggantikan guard lama
      // yang diam-diam membuang callback kedua.
      advanceFlowerQueue();
    }, totalScatterTimeMs + 100);
    flowerCycleTimers.push(cleanupTimer);

  }, totalFallTimeMs + FLOWER_TRANSITION_CONFIG.holdDurationMs);
  flowerCycleTimers.push(revealTimer);
}

function advanceFlowerQueue() {
  if (flowerTransitionQueue.length === 0) return;
  const nextCallback = flowerTransitionQueue.shift();
  runFlowerCycle(nextCallback);
}

// Wrapper transisi SPA yang dipanggil di seluruh aksi navigasi.
// Catatan: fungsi ini sengaja hanya menerima 1 parameter (callback). Kalau
// ada pemanggil yang mengirim argumen tambahan (mis. sceneTransition(fn, 280,
// 420)), argumen itu diabaikan oleh JS dan TIDAK menyebabkan error — argumen
// itu sudah dibersihkan dari semua titik pemanggilan di file ini karena
// memang tidak pernah terpakai (lihat catatan di chat).
function sceneTransition(callback) {
  flowerTransition(callback);
}
 
// ============================================================
// 1. LOADING SCREEN -> PASSWORD PAGE
// ============================================================
window.addEventListener('load', () => {
  setTimeout(() => {
    sceneTransition(() => {
      hideSection(loadingScreen);
      showSection(passwordPage);
      const firstPin = document.querySelector('.pin-input');
      if (firstPin) firstPin.focus();
    });
  }, LOADING_DURATION_MS);
});

// ============================================================
// 2. VALIDASI PASSWORD -> MAIN PAGE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const pinDots = document.querySelectorAll('.pin-dot');
  const numpadBtns = document.querySelectorAll('.numpad-btn[data-val]');
  const backspaceBtn = document.getElementById('btn-backspace');
  const passwordFormEl = document.getElementById('password-form');
  
  let currentPin = '';
  const MAX_PIN_LENGTH = 6;

  // Update visual indikator lingkaran
  function updatePinDisplay() {
    pinDots.forEach((dot, index) => {
      if (index < currentPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  // Logika saat tombol angka ditekan
  numpadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentPin.length < MAX_PIN_LENGTH) {
        currentPin += btn.getAttribute('data-val');
        updatePinDisplay();
        
        // Auto-submit saat mencapai batas maksimal
        if (currentPin.length === MAX_PIN_LENGTH) {
          validatePin();
        }
      }
    });
  });

  // Logika saat tombol backspace ditekan
  backspaceBtn.addEventListener('click', () => {
    if (currentPin.length > 0) {
      currentPin = currentPin.slice(0, -1);
      updatePinDisplay();
    }
  });

  // Logika saat form disubmit (tombol "Buka Kado")
  if (passwordFormEl) {
    passwordFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      validatePin();
    });
  }

  // Fungsi Validasi Utama
  function validatePin() {
    setTimeout(() => {
      if (currentPin === CORRECT_PASSWORD) {
        sceneTransition(() => {
          hideSection(passwordPage);
          showSection(mainPage);
        });
      } else {
        triggerPasswordError();
      }
    }, 150);
  }

  // Modifikasi fungsi error agar mengosongkan state currentPin
  window.triggerPasswordError = function() {
    passwordError.classList.add('show');

    passwordCard.classList.remove('shake', 'shake-error');
    void passwordCard.offsetWidth;
    passwordCard.classList.add('shake', 'shake-error');

    setTimeout(() => {
      passwordCard.classList.remove('shake');
    }, 420);
    setTimeout(() => {
      passwordCard.classList.remove('shake-error');
    }, 1400);

    // Reset state & UI
    currentPin = '';
    updatePinDisplay();
  };
});

function triggerPasswordError() {
  passwordError.classList.add('show');

  // Remove both classes to allow re-trigger on repeated wrong attempts
  passwordCard.classList.remove('shake', 'shake-error');

  // force reflow supaya animasi shake bisa di-retrigger
  void passwordCard.offsetWidth;

  passwordCard.classList.add('shake', 'shake-error');

  // Strip shake class after animation (400ms) so it can re-trigger next time
  // Leave shake-error a bit longer so the glow ring is visible with the error text
  setTimeout(() => {
    passwordCard.classList.remove('shake');
  }, 420);
  setTimeout(() => {
    passwordCard.classList.remove('shake-error');
  }, 1400);

  passwordInput.value = '';
  passwordInput.focus();
}

// ============================================================
// 3. MAIN MENU — ikon Kalender, Galeri, Pesan
// (listener dipasang di bagian bawah bersama logika galeri)
// ============================================================

// ============================================================
// 4. SECTION CAKE — KUE, LILIN (TEKAN & TAHAN), WISHES
// ============================================================

const HOLD_DURATION_MS   = 2500; // lama tekan-tahan sampai lilin padam
const IGNITE_DELAY_MS    = 700;  // jeda sebelum lilin otomatis menyala
const RING_CIRCUMFERENCE = 169.6; // 2 * PI * r(27), harus sinkron dengan style.css

// Konten wishes disimpan sebagai satu sumber data, bukan hardcode di HTML,
// supaya gampang diedit tanpa nyentuh markup.
// CATATAN: ganti ke kalimat yang spesifik ke orangnya, ini masih placeholder.
const WISHES = [
  'Makin Bahagia',
  'Makin Sukses',
  'Makin Banyak Rezeki',
  'Makin Jarang Menghilang'
];

const cakeSection      = document.getElementById('section-cake');
const cakeDimOverlay   = document.getElementById('cake-dim-overlay');
const cakeImg          = document.getElementById('cake-img');
const cakeFallback     = document.getElementById('cake-fallback');
const holdTarget       = document.getElementById('hold-target');
const candleFlame      = document.getElementById('candle-flame');
const candleStick      = document.getElementById('candle-stick');
const matchStick       = document.getElementById('match-stick');
const holdRingProgress = document.getElementById('hold-ring-progress');
const holdHint         = document.getElementById('hold-hint');
const holdFailPopup    = document.getElementById('hold-fail-popup');
const holdFailText     = document.getElementById('hold-fail-text');
const petalsLayer      = document.getElementById('petals-layer');
const backToMenuBtn    = document.getElementById('back-to-menu-btn');

// Variasi pesan saat hold dilepas kepagian / lepas-lepas — dipilih acak tiap kali
const HOLD_FAIL_MESSAGES = [
  'Yah, nafasnya kurang panjang 😢',
  'Belum padam, ayo coba lagi 😮\u200d💨',
  'Dikit lagi tuh, tahan terus ya 🕯️',
  'Hampir! Jangan keburu dilepas 😅',
  'Wah keburu lepas, ulangi yuk 🎂',
];

// Cegah menu konteks (long-press) muncul di atas panggung kue pada browser
// yang masih memunculkannya walau pointer-events gambar sudah dimatikan.
holdTarget.addEventListener('contextmenu', (e) => e.preventDefault());

// Section blown & wish terpisah
const blownSection     = document.getElementById('section-blown');
const wishSection      = document.getElementById('section-wish');
const wishesContainer  = document.getElementById('wishes-container');
const wishPopup        = document.getElementById('wish-popup');
const wishBackBtn      = document.getElementById('wish-back-btn');

// Referensi timer/RAF/state — semua wajib direset lewat resetCakeSection()
let igniteTimer      = null;
let holdWarningTimer = null;
let holdFailTimer    = null;
let blownTextTimer   = null;
let extinguishTimer  = null; // setTimeout 500ms (padam -> blackout -> section-blown) di holdSuccess() — sebelumnya tidak disimpan di variabel apa pun, jadi tidak bisa dibatalkan resetCakeSection() kalau user re-entry ke section cake sebelum timer ini sempat jalan
let holdRAF          = null;
let holdStartTime    = null;
let candleIsLit          = false;
let candleIsExtinguished = false;
let wishAlreadyPicked    = false;

// Fallback: kalau kue.png gagal dimuat, tampilkan versi CSS/emoji
// supaya section ini gak pernah keliatan "rusak" ke penerima.
cakeImg.addEventListener('error', () => {
  cakeImg.classList.add('hidden-section');
  cakeFallback.classList.remove('hidden-section');
});

// ---- Ignite otomatis (menggantikan tombol "Nyalakan Lilin") ----
// Urutan barunya: batang lilin muncul & diam dulu di kue -> korek muncul & "menyentuh" sumbu -> api menyala.
function startIgniteSequence() {
  igniteTimer = setTimeout(showCandleStick, IGNITE_DELAY_MS);
}

function showCandleStick() {
  if (candleStick) candleStick.classList.add('visible');

  // Kasih jeda supaya lilin kelihatan sudah "ada" dulu sebelum koreknya muncul,
  // biar kesannya korek datang buat menyalakan lilin — bukan memunculkannya.
  igniteTimer = setTimeout(startMatchStrike, 500);
}

function startMatchStrike() {
  if (matchStick) {
    matchStick.classList.remove('striking');
    void matchStick.offsetWidth; // reflow supaya animasi bisa retrigger
    matchStick.classList.add('striking');
  }

  // Api menyala tepat saat korek "menyentuh" sumbu (~55% dari animasi 650ms)
  igniteTimer = setTimeout(igniteCandle, 358);
}

function igniteCandle() {
  cakeSection.classList.add('lit');
  candleFlame.classList.add('visible');
  candleIsLit = true;

  holdHint.textContent = '👆 Tekan & tahan lilinnya sampai padam';
  holdHint.classList.remove('warning');
  holdHint.classList.remove('hidden-section');
}

// ---- Tekan & tahan untuk memadamkan lilin ----
function setRingProgress(fraction) {
  holdRingProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
}

// Spawns percikan api kecil dari posisi lilin, intensitas makin tinggi sesuai progress
let sparkInterval = null;

function startSparkEffect() {
  if (sparkInterval) return;
  // Spawn secara berkala; makin sering saat progress naik
  sparkInterval = setInterval(() => {
    if (!candleIsLit || candleIsExtinguished) return;
    spawnFireSparks(2);
  }, 90);
}

function stopSparkEffect() {
  clearInterval(sparkInterval);
  sparkInterval = null;
}

function spawnFireSparks(count) {
  const candleWrap = document.querySelector('.candle-wrap');
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    spark.className = 'fire-spark';

    // Warna api: kuning, oranye, atau merah-oranye
    const colors = ['#FFE566', '#F3A93E', '#FF6B2B', '#FFD700'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 3 + Math.random() * 5;

    // Arah tiupan: dominan ke kanan-atas, sedikit acak
    const tx = 15 + Math.random() * 35;            // ke kanan
    const ty = -(10 + Math.random() * 30);          // ke atas

    const dur = (0.35 + Math.random() * 0.35).toFixed(2);

    spark.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      top: 50%;
      left: 50%;
      margin-top: -${size / 2}px;
      margin-left: -${size / 2}px;
      --tx: ${tx}px;
      --ty: ${ty}px;
      --dur: ${dur}s;
      box-shadow: 0 0 4px 1px ${color}88;
    `;

    candleWrap.appendChild(spark);
    // Hapus setelah animasi selesai
    spark.addEventListener('animationend', () => spark.remove());
  }
}

function spawnSmokePuffs() {
  const candleWrap = document.querySelector('.candle-wrap');
  for (let i = 0; i < 4; i++) {
    const smoke = document.createElement('span');
    smoke.className = 'smoke-puff';
    const size = 8 + Math.random() * 10;
    const dx = (Math.random() * 20 - 10).toFixed(1);
    const dur = (0.9 + Math.random() * 0.6).toFixed(2);
    const delay = (i * 0.1).toFixed(2);

    smoke.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      bottom: 60%;
      --dx: ${dx}px;
      --dur: ${dur}s;
      animation-delay: ${delay}s;
    `;
    candleWrap.appendChild(smoke);
    smoke.addEventListener('animationend', () => smoke.remove());
  }
}

function startHold() {
  if (!candleIsLit || candleIsExtinguished) return;

  clearTimeout(holdWarningTimer);
  holdHint.classList.remove('warning');
  holdHint.textContent = 'Terus... tahan...';

  // Mulai efek tiupan pada api
  candleFlame.classList.remove('blowing');
  void candleFlame.offsetWidth; // reflow
  candleFlame.classList.add('blowing');
  startSparkEffect();

  holdStartTime = performance.now();
  holdRAF = requestAnimationFrame(updateHold);
}

function updateHold(now) {
  const progress = Math.min((now - holdStartTime) / HOLD_DURATION_MS, 1);
  setRingProgress(progress);

  holdTarget.style.setProperty('--hold-progress', progress.toFixed(3));

  // Kue membesar perlahan: dari skala 1 → 1.15 seiring progress
  const scale = 1 + progress * 0.15;
  holdTarget.style.setProperty('--cake-scale', scale.toFixed(4));

  // Layar makin gelap: opacity 0 → 0.72 (tidak sampai hitam penuh, itu saat padam)
  const dim = progress * 0.72;
  cakeSection.style.setProperty('--dim-opacity', dim.toFixed(4));

  // Spawn lebih banyak percikan saat progress > 60%
  if (progress > 0.6 && Math.random() < 0.4) {
    spawnFireSparks(1);
  }

  if (progress >= 1) {
    holdSuccess();
  } else {
    holdRAF = requestAnimationFrame(updateHold);
  }
}

// Dipanggil saat tekanan dilepas (pointerup/leave/cancel), baik sebelum
// maupun sesudah selesai. Kalau dilepas kepagian, tampilkan pesan gagal.
function cancelHold() {
  if (holdStartTime === null || candleIsExtinguished) return;

  const elapsed = performance.now() - holdStartTime;
  cancelAnimationFrame(holdRAF);
  holdRAF = null;
  holdStartTime = null;
  setRingProgress(0);

  holdTarget.style.setProperty('--hold-progress', '0');

  // Reset skala kue dan overlay dim
  holdTarget.style.setProperty('--cake-scale', '1');
  cakeSection.style.setProperty('--dim-opacity', '0');

  // Hentikan efek tiupan, kembalikan api ke animasi flicker
  stopSparkEffect();
  candleFlame.classList.remove('blowing', 'extinguishing');
  void candleFlame.offsetWidth;
  if (!candleIsExtinguished) {
    candleFlame.classList.add('visible');
  }

  // Kembalikan teks hint ke instruksi normal (sempat diganti "Terus... tahan..."
  // saat startHold() dipicu) — status gagal/berhasil ditampilkan lewat popup terpisah
  holdHint.textContent = '👆 Tekan & tahan lilinnya sampai padam';

  if (elapsed < HOLD_DURATION_MS) {
    showHoldFailPopup();
  }
}

// Popup terpisah untuk hold yang kurang sempurna — tidak menimpa hold-hint,
// teksnya dipilih acak tiap kali, dan hilang otomatis setelah ~2.2 detik.
function showHoldFailPopup() {
  const msg = HOLD_FAIL_MESSAGES[Math.floor(Math.random() * HOLD_FAIL_MESSAGES.length)];
  holdFailText.textContent = msg;
  holdFailPopup.classList.add('show');

  clearTimeout(holdFailTimer);
  holdFailTimer = setTimeout(() => {
    holdFailPopup.classList.remove('show');
  }, 2200);
}

function holdSuccess() {
  candleIsExtinguished = true;
  holdStartTime = null;
  cancelAnimationFrame(holdRAF);
  holdRAF = null;
  stopSparkEffect();

  // Animasi padam api + asap
  candleFlame.classList.remove('blowing');
  candleFlame.classList.add('extinguishing');
  spawnSmokePuffs();

  // Setelah asap selesai, mulai blackout penuh lalu pindah scene
  extinguishTimer = setTimeout(() => {
    candleFlame.classList.remove('visible', 'extinguishing');
    holdTarget.style.setProperty('--cake-scale', '1');

    // Stop ambient petals before transition
    if (stopCakeAmbient) { stopCakeAmbient(); stopCakeAmbient = null; }

    // Fade ke hitam penuh (overlay dim sudah ~0.72, scene-transition menutup sisanya)
    // durIn 500ms → hitam penuh → tampilkan blown section → fade out 600ms
    sceneTransition(() => {
      // Reset dim overlay setelah blackout sudah penuh
      cakeSection.style.setProperty('--dim-opacity', '0');
      hideSection(cakeSection);
      showSection(blownSection);
    });
  }, 500);

  // Setelah blown text cukup terbaca, fade ke wish section
  blownTextTimer = setTimeout(() => {
    sceneTransition(() => {
      hideSection(blownSection);
      renderWishes();
      showSection(wishSection);
      wishSection.scrollTop = 0;
    });
  }, 3200); // 500ms extinguish + 600ms fadeToBlack + 700ms fadeIn + 1400ms baca teks
}

// Pointer Events menyatukan mouse & touch dalam satu API
holdTarget.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  startHold();
});
holdTarget.addEventListener('pointerup', cancelHold);
holdTarget.addEventListener('pointerleave', cancelHold);
holdTarget.addEventListener('pointercancel', cancelHold);

// ---- Wishes: SATU PERMOHONAN SAJA — tag label vintage ----
function makePetalFlower() {
  // Buat elemen bunga cherry blossom CSS murni
  const wrap = document.createElement('div');
  wrap.className = 'wish-tag-flower';
  wrap.setAttribute('aria-hidden', 'true');

  // 5 kelopak
  for (let p = 0; p < 5; p++) {
    const petal = document.createElement('span');
    petal.className = 'wish-tag-petal';
    wrap.appendChild(petal);
  }
  // Pusat bunga
  const center = document.createElement('span');
  center.className = 'wish-tag-center';
  wrap.appendChild(center);
  // 2 daun
  for (let l = 0; l < 2; l++) {
    const leaf = document.createElement('span');
    leaf.className = 'wish-tag-leaf';
    wrap.appendChild(leaf);
  }
  return wrap;
}

function renderWishes() {
  wishesContainer.innerHTML = '';
  wishAlreadyPicked = false;
  if (wishPopup) wishPopup.classList.add('hidden-section');

  WISHES.forEach((label, index) => {
    // Wrapper tombol
    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = 'wish-tag';
    tag.dataset.index = index;
    tag.setAttribute('aria-label', `Pilih wish: ${label}`);

    // Pita di atas
    const ribbon = document.createElement('div');
    ribbon.className = 'wish-tag-ribbon';
    tag.appendChild(ribbon);

    // Kartu tag
    const card = document.createElement('div');
    card.className = 'wish-tag-card';

    // Lubang cincin
    const hole = document.createElement('div');
    hole.className = 'wish-tag-hole';
    card.appendChild(hole);

    // Label teks
    const lbl = document.createElement('span');
    lbl.className = 'wish-tag-label';
    lbl.textContent = label;
    card.appendChild(lbl);

    // Hiasan bunga
    card.appendChild(makePetalFlower());
    tag.appendChild(card);

    // Pasang event listener ke fungsi terpisah agar kode tetap bersih
    tag.addEventListener('click', () => handleWishClick(tag));

    // WAJIB: Masukkan tag ke dalam container agar muncul di layar
    wishesContainer.appendChild(tag);

    // Grid stagger delay
    const col = index % 2;
    const row = Math.floor(index / 2);
    const delay = 80 + (row * 120) + (col * 80);
    setTimeout(() => tag.classList.add('tag-revealed'), delay);
  });

  // Start ambient petals in wish section
  if (stopWishAmbient) stopWishAmbient();
  stopWishAmbient = startAmbientPetals(wishSection, 5);
}

function handleWishClick(selectedTag) {
  if (wishAlreadyPicked) return;
  wishAlreadyPicked = true;

  // 1. Isolasi fokus ke tag yang dipilih
  document.querySelectorAll('.wish-tag').forEach((tag) => {
    if (tag === selectedTag) {
      tag.classList.add('selected-float');
    } else {
      tag.classList.add('dimmed');
      tag.style.pointerEvents = 'none'; // Mencegah interaksi tidak disengaja
    }
  });

  // 2. Munculkan popup konfirmasi & jalankan efek visual
  spawnPetals(24);
  if (wishPopup) wishPopup.classList.remove('hidden-section');

  // 3. Transisi otomatis ke Gallery setelah jeda membaca (~3 detik)
  setTimeout(() => {
    sceneTransition(() => {
      // Hentikan efek background dari Wish Section
      if (stopWishAmbient) { 
        stopWishAmbient(); 
        stopWishAmbient = null; 
      }
      
      // Sembunyikan Wish Section sepenuhnya
      hideSection(wishSection);
      if (wishPopup) wishPopup.classList.add('hidden-section');
      
      // Persiapkan dan tampilkan Gallery Section
      const gallerySection = document.getElementById('section-gallery');
      resetGallery();
      showSection(gallerySection);
      
      // Render layout galeri
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          buildGallery();
          if (stopGalleryAmbient) stopGalleryAmbient();
          stopGalleryAmbient = startAmbientPetals(gallerySection, 6);
        });
      });
    });
  }, 3000); 
}

// Kelopak bunga berjatuhan — dirender ke dalam section wish
function spawnPetals(count) {
  // Buat layer petal sementara di dalam wish section
  let layer = wishSection.querySelector('.petals-layer-wish');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'petals-layer petals-layer-wish';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;';
    wishSection.appendChild(layer);
  }
  layer.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const petal = document.createElement('span');
    petal.className = 'petal-fall';
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.setProperty('--drift', `${(Math.random() * 80 - 40).toFixed(0)}px`);
    petal.style.animationDuration = `${(3 + Math.random() * 2.5).toFixed(2)}s`;
    petal.style.animationDelay = `${(Math.random() * 1.2).toFixed(2)}s`;
    layer.appendChild(petal);
  }
}

/**
 * Ambient continuous petals — petals drift through a container indefinitely.
 * Returns a stop function to clean up.
 */
function startAmbientPetals(container, intensity = 8) {
  let stopped = false;
  let ambientLayer = container.querySelector('.petals-ambient-layer');
  if (!ambientLayer) {
    ambientLayer = document.createElement('div');
    ambientLayer.className = 'petals-ambient-layer';
    ambientLayer.setAttribute('aria-hidden', 'true');
    ambientLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;';
    container.appendChild(ambientLayer);
  }

  function spawnOne() {
    if (stopped) return;
    const petal = document.createElement('span');
    petal.className = 'petal-fall ambient';
    petal.style.left = `${Math.random() * 110 - 5}%`;
    petal.style.top = '-8%';
    petal.style.setProperty('--drift', `${(Math.random() * 70 - 35).toFixed(0)}px`);
    const dur = (4 + Math.random() * 4).toFixed(2);
    petal.style.animationDuration = dur + 's';
    petal.style.animationDelay = '0s';
    // Vary size slightly
    const size = 8 + Math.random() * 8;
    petal.style.width = size + 'px';
    petal.style.height = size + 'px';
    petal.style.opacity = (0.5 + Math.random() * 0.4).toFixed(2);
    ambientLayer.appendChild(petal);
    // Remove after animation
    setTimeout(() => petal.remove(), parseFloat(dur) * 1000 + 500);
    // Schedule next petal — rate based on intensity
    const interval = (600 + Math.random() * (2400 / intensity));
    setTimeout(spawnOne, interval);
  }

  // Seed initial petals
  for (let i = 0; i < intensity; i++) {
    setTimeout(() => spawnOne(), Math.random() * 3000);
  }

  return function stop() {
    stopped = true;
    if (ambientLayer) ambientLayer.remove();
  };
}

// Track ambient stop functions
let stopCakeAmbient = null;
let stopWishAmbient = null;
let stopGalleryAmbient = null;
let stopMessageAmbient = null;

// Reset total section-cake — wajib dipanggil tiap kali section ini dibuka,
// biar gak kebawa state (lilin nyala, wish kepilih, dll) dari sesi sebelumnya.
function resetCakeSection() {
  clearTimeout(igniteTimer);
  clearTimeout(blownTextTimer);
  clearTimeout(holdWarningTimer);
  clearTimeout(holdFailTimer);
  clearTimeout(extinguishTimer);
  cancelAnimationFrame(holdRAF);
  stopSparkEffect();

  holdRAF = null;
  holdStartTime = null;
  candleIsLit = false;
  candleIsExtinguished = false;
  wishAlreadyPicked = false;

  cakeSection.classList.remove('lit');
  candleFlame.classList.remove('visible', 'blowing', 'extinguishing');
  if (candleStick) candleStick.classList.remove('visible');
  if (matchStick) matchStick.classList.remove('striking');
  setRingProgress(0);

  // Reset efek hold
  holdTarget.style.setProperty('--cake-scale', '1');
  cakeSection.style.setProperty('--dim-opacity', '0');

  holdTarget.style.setProperty('--hold-progress', '0');

  holdHint.classList.add('hidden-section');
  holdHint.classList.remove('warning');
  if (holdFailPopup) holdFailPopup.classList.remove('show');

  hideSection(blownSection);
  hideSection(wishSection);
  if (wishPopup) wishPopup.classList.add('hidden-section');
  if (petalsLayer) petalsLayer.innerHTML = '';

  // Stop ambient petals
  if (stopCakeAmbient) { stopCakeAmbient(); stopCakeAmbient = null; }
  if (stopWishAmbient) { stopWishAmbient(); stopWishAmbient = null; }
}

backToMenuBtn.addEventListener('click', () => {
  sceneTransition(() => {
    resetCakeSection();
    hideSection(cakeSection);
    showSection(mainPage);
  });
});

wishBackBtn.addEventListener('click', () => {
  sceneTransition(() => {
    if (stopWishAmbient) { stopWishAmbient(); stopWishAmbient = null; }
    hideSection(wishSection);
    showSection(mainPage);
  });
});

// ============================================================
// 5. SECTION GALLERY — GALERI LOVE (FASE 3)
// ============================================================

// 15 placeholder foto — ganti src dengan path foto asli
const GALLERY_PHOTOS = [
  'foto1.jpg','foto2.jpg','foto3.jpg','foto4.jpg','foto5.jpg',
  'foto6.jpg','foto7.jpg','foto8.jpg','foto9.jpg','foto10.jpg',
  'foto11.jpg','foto12.jpg','foto13.jpg','foto14.jpg','foto15.jpg',
];

const gallerySection   = document.getElementById('section-gallery');
const galleryArena     = document.getElementById('gallery-heart-arena');
const galleryCaption   = document.getElementById('gallery-caption');
const galleryLetterBtn = document.getElementById('gallery-letter-btn');
const galleryBackBtn   = document.getElementById('gallery-back-btn');

// Lightbox
const lightbox         = document.getElementById('lightbox');
const lightboxImg      = document.getElementById('lightbox-img');
const lightboxClose    = document.getElementById('lightbox-close');
const lightboxBackdrop = document.getElementById('lightbox-backdrop');

// ── 16 tile membentuk hati sempurna, grid 5 kolom × 5 baris ─
//
//   0  1  2  3  4
//   .  X  .  X  .   row 0 — dua puncak bukit
//   X  X  X  X  X   row 1 — bahu penuh
//   X  X  X  X  X   row 2 — badan
//   .  X  X  X  .   row 3 — menyempit
//   .  .  X  .  .   row 4 — ujung lancip
//
//   Jumlah: 2+5+5+3+1 = 16
//   (GALLERY_PHOTOS bisa 15 — tile ke-16 mengulang foto pertama)
const HEART_MASK = null;

const HEART_CELLS = [
  { row: 0, col: 1 }, { row: 0, col: 3 },
  { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 },
  { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 },
  { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
  { row: 4, col: 2 },
];

// Kumpulkan semua posisi grid yang aktif
function getHeartCells() {
  return HEART_CELLS;
}

// ── Buat & animasikan tile hati ─────────────────────────────
function buildGallery() {
  galleryArena.innerHTML = '';

  const COLS = 5;
  const ROWS = 5;

  const arenaW = galleryArena.offsetWidth;
  const arenaH = galleryArena.offsetHeight;

  const cellW = arenaW / COLS;
  const cellH = arenaH / ROWS;

  // Tile sedikit lebih besar dari cell untuk efek overlap
  const OVERLAP_FACTOR = 1.08;
  const tileW = Math.round(cellW * OVERLAP_FACTOR);
  const tileH = Math.round(cellH * OVERLAP_FACTOR);

  const allCells = getHeartCells();  // tepat 15 sel

  // Indeks sel yang mendapat sparkle (~30%)
  const sparkleSet = new Set();
  while (sparkleSet.size < Math.round(allCells.length * 0.3)) {
    sparkleSet.add(Math.floor(Math.random() * allCells.length));
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const arenaRect = galleryArena.getBoundingClientRect();

  allCells.forEach(({ row, col }, i) => {
    const photoSrc = GALLERY_PHOTOS[i % GALLERY_PHOTOS.length];

    // Center tile di dalam cell-nya
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;
    const finalLeft = cx - tileW / 2;
    const finalTop  = cy - tileH / 2;

    // Wrapper tile
    const tile = document.createElement('div');
    tile.className = 'heart-tile';
    tile.style.width  = `${tileW}px`;
    tile.style.height = `${tileH}px`;
    tile.style.left   = `${finalLeft}px`;
    tile.style.top    = `${finalTop}px`;

    // Rotasi kecil acak per tile (±3°)
    const rot = (Math.random() * 6 - 3).toFixed(2);
    tile.style.setProperty('--rot', `${rot}deg`);

    // Posisi awal: dari luar layar
    const absX = arenaRect.left + cx;
    const absY = arenaRect.top  + cy;
    const origins = [
      { ox: -(absX + tileW),             oy: (Math.random() - 0.5) * vh * 0.5 },
      { ox: vw - absX + tileW,           oy: (Math.random() - 0.5) * vh * 0.5 },
      { ox: (Math.random() - 0.5) * vw * 0.5, oy: -(absY + tileH) },
      { ox: (Math.random() - 0.5) * vw * 0.5, oy: vh - absY + tileH },
    ];
    const { ox, oy } = origins[i % 4];
    tile.style.setProperty('--ox', `${ox.toFixed(1)}px`);
    tile.style.setProperty('--oy', `${oy.toFixed(1)}px`);

    // Gambar
    const img = document.createElement('img');
    img.src   = photoSrc;
    img.alt   = `Foto ${i + 1}`;
    img.className = 'heart-tile-img';
    tile.appendChild(img);

    // Overlay rose frosted
    const overlay = document.createElement('div');
    overlay.className = 'heart-tile-overlay';
    tile.appendChild(overlay);

    // Sparkle ✦
    if (sparkleSet.has(i)) {
      const sp = document.createElement('span');
      sp.className = 'heart-tile-sparkle';
      sp.setAttribute('aria-hidden', 'true');
      sp.textContent = '✦';
      sp.style.top  = `${30 + Math.random() * 40}%`;
      sp.style.left = `${25 + Math.random() * 50}%`;
      sp.style.setProperty('--sp-delay', `${(Math.random() * 2).toFixed(2)}s`);
      tile.appendChild(sp);
    }

    // Klik → lightbox
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', `Buka foto ${i + 1}`);
    tile.addEventListener('click', () => openLightbox(photoSrc, i + 1));
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(photoSrc, i + 1); }
    });

    galleryArena.appendChild(tile);

    // Stagger animasi masuk — spring overshoot
    setTimeout(() => {
      tile.classList.add('in-place');
      // Give each tile its own idle drift params
      tile.style.setProperty('--idle-dur', `${(3.5 + Math.random() * 2.5).toFixed(2)}s`);
      tile.style.setProperty('--idle-delay', `${(Math.random() * 2).toFixed(2)}s`);
      tile.style.setProperty('--idle-amp', `${(-(2 + Math.random() * 4)).toFixed(1)}px`);
    }, 80 + i * 70);
  });

  // Caption & tombol surat muncul setelah semua tile masuk — staggered per child
  const totalDelay = 80 + allCells.length * 70 + 600;
  setTimeout(() => {
    galleryCaption.classList.remove('hidden-section');
    revealCaptionStagger(galleryCaption);
    // Letter button comes in after caption
    setTimeout(() => {
      galleryLetterBtn.classList.remove('hidden-section');
      galleryLetterBtn.classList.add('revealed');
    }, 400);
  }, totalDelay);
}

function resetGallery() {
  galleryArena.innerHTML = '';
  galleryCaption.classList.add('hidden-section');
  galleryLetterBtn.classList.add('hidden-section');
  galleryLetterBtn.classList.remove('revealed');
  closeLightbox();
  if (stopGalleryAmbient) { stopGalleryAmbient(); stopGalleryAmbient = null; }
}

/**
 * Staggered reveal for gallery caption children (eyebrow, heading, sub).
 * Wraps each text node in a .caption-word span for per-element control.
 */
function revealCaptionStagger(captionEl) {
  const children = Array.from(captionEl.children);
  children.forEach((child, i) => {
    child.classList.add('caption-word');
    setTimeout(() => child.classList.add('revealed'), i * 120);
  });
}

// ── Lightbox ────────────────────────────────────────────────
function openLightbox(src, index) {
  lightboxImg.src = src;
  lightboxImg.alt = `Foto ${index}`;
  lightbox.classList.remove('hidden-section');
  lightboxClose.focus();
  document.addEventListener('keydown', onLightboxKey);
}

function closeLightbox() {
  lightbox.classList.add('hidden-section');
  lightboxImg.src = '';
  document.removeEventListener('keydown', onLightboxKey);
}

function onLightboxKey(e) {
  if (e.key === 'Escape') closeLightbox();
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxBackdrop.addEventListener('click', closeLightbox);

// ── Navigasi ke/dari galeri ──────────────────────────────────
function openGallery() {
  sceneTransition(() => {
    hideSection(mainPage);
    resetGallery();
    showSection(gallerySection);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        buildGallery();
        // Start ambient petals
        if (stopGalleryAmbient) stopGalleryAmbient();
        stopGalleryAmbient = startAmbientPetals(gallerySection, 6);
      });
    });
  });
}

galleryBackBtn.addEventListener('click', () => {
  sceneTransition(() => {
    resetGallery();
    hideSection(gallerySection);
    showSection(mainPage);
  });
});

galleryLetterBtn.addEventListener('click', () => {
  sceneTransition(() => {
    resetGallery();
    hideSection(gallerySection);
    openMessageSection();
  });
});

function openMessageSection() {
  showSection(msgSection);
  // Scroll ke atas setiap kali section dibuka
  msgSection.scrollTop = 0;

  // Staggered letter lines reveal
  const lines = msgSection.querySelectorAll('.letter-line, .letter-sign');
  lines.forEach((line, i) => {
    line.classList.remove('line-revealed');
    setTimeout(() => line.classList.add('line-revealed'), 200 + i * 100);
  });

  // Closing card + buttons stagger after letter finishes
  const closingCard = msgSection.querySelector('.closing-card');
  const openBtn = document.getElementById('open-flower-btn');
  const letterDelay = 200 + lines.length * 100 + 200;

  if (closingCard) {
    closingCard.classList.remove('card-revealed');
    setTimeout(() => closingCard.classList.add('card-revealed'), letterDelay);
  }
  if (openBtn) {
    openBtn.classList.remove('btn-revealed');
    setTimeout(() => openBtn.classList.add('btn-revealed'), letterDelay + 180);
  }

  // Start ambient petals
  if (stopMessageAmbient) stopMessageAmbient();
  stopMessageAmbient = startAmbientPetals(msgSection, 5);
}

// ── Sambungkan ke menu utama ─────────────────────────────────
document.querySelectorAll('.menu-icon').forEach((btn) => {
  btn.addEventListener('click', () => {
    const menu = btn.dataset.menu;
    if (menu === 'kalender') {
      sceneTransition(() => {
        hideSection(mainPage);
        resetCakeSection();
        showSection(cakeSection);
        // Start ambient petals on cake stage
        stopCakeAmbient = startAmbientPetals(cakeSection, 4);
        startIgniteSequence();
      });
    } else if (menu === 'galeri') {
      openGallery();
    } else if (menu === 'pesan') {
      sceneTransition(() => {
        hideSection(mainPage);
        openMessageSection();
      });
    } else {
      console.log(`Menu "${menu}" diklik`);
    }
  });
});

// ============================================================
// 6. SECTION MESSAGE — SURAT & PENUTUP (FASE 4)
// ============================================================

const msgSection      = document.getElementById('section-message');
const msgBackBtn      = document.getElementById('msg-back-btn');
const openFlowerBtn   = document.getElementById('open-flower-btn');

// ── Modal buket bunga ────────────────────────────────────────
const flowerModal        = document.getElementById('flower-modal');
const flowerModalBackdrop= document.getElementById('flower-modal-backdrop');
const flowerBackBtn      = document.getElementById('flower-back-btn');
const flowerBouquetWrap  = document.querySelector('.flower-bouquet-wrap');

function openFlowerModal() {
  flowerModal.classList.remove('hidden-section');
  flowerBackBtn.focus();
  document.addEventListener('keydown', onFlowerModalKey);
}

function closeFlowerModal() {
  flowerModal.classList.add('hidden-section');
  document.removeEventListener('keydown', onFlowerModalKey);
}

function onFlowerModalKey(e) {
  if (e.key === 'Escape') closeFlowerModal();
}

openFlowerBtn.addEventListener('click', openFlowerModal);

// Klik backdrop modal menutup modal
flowerModalBackdrop.addEventListener('click', closeFlowerModal);

// Kembali ke surat dari modal
flowerBackBtn.addEventListener('click', closeFlowerModal);

// Ulangi dari awal — reload halaman

// Tap buket → efek kecil (goyangan lebih kuat sementara)
if (flowerBouquetWrap) {
  flowerBouquetWrap.addEventListener('click', () => {
    flowerBouquetWrap.style.transition = 'transform 0.15s ease';
    flowerBouquetWrap.style.transform  = 'scale(1.1) translateY(-12px) rotate(3deg)';
    setTimeout(() => {
      flowerBouquetWrap.style.transform = '';
    }, 300);
  });
}

// Kembali ke menu dari section message
msgBackBtn.addEventListener('click', () => {
  closeFlowerModal();
  sceneTransition(() => {
    if (stopMessageAmbient) { stopMessageAmbient(); stopMessageAmbient = null; }
    hideSection(msgSection);
    showSection(mainPage);
  });
});

function triggerMessageSectionSequence() {
  const msgSection = document.getElementById('section-message'); // Pastikan ID sesuai dengan HTML
  if (!msgSection) return;

  // 1. Bersihkan state animasi lama jika ada penayangan ulang
  msgSection.classList.remove('section-message-active');

  // 2. Kalkulasi stagger delay secara dinamis untuk tiap paragraf
  const lines = msgSection.querySelectorAll('.letter-line');
  const staggerDelay = 180; // Delay antar paragraf dalam milidetik

  lines.forEach((line, index) => {
    line.style.animationDelay = `${index * staggerDelay}ms`;
  });

  // 3. Set delay .closing-card agar muncul setelah paragraf terakhir selesai beranimasi
  const closingCard = msgSection.querySelector('.closing-card');
  if (closingCard) {
    const cardDelay = (lines.length * staggerDelay) + 100;
    closingCard.style.animationDelay = `${cardDelay}ms`;
  }

  // 4. Tampilkan section menggunakan sistem transisi bawaanmu
  showSection(msgSection);

  // 5. Suntikkan kelas trigger menggunakan double requestAnimationFrame 
  // untuk memastikan perubahan display ter-render penuh oleh browser sebelum animasi dimulai
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      msgSection.classList.add('section-message-active');
    });
  });
}

// ============================================================
// ALAT BANTU KALIBRASI POSISI LILIN (dev tool, tidak aktif untuk pengunjung biasa)
// ============================================================
// Kenapa ada ini: posisi lilin (--candle-base) dihitung sebagai persentase
// dari tinggi kue.png. Angka yang pas beda-beda tergantung proporsi gambar
// kue masing-masing orang, jadi tidak bisa ditebak dari luar tanpa melihat
// gambar aslinya secara langsung.
//
// Cara pakai: buka halaman dengan ?calibrate=1 di belakang URL
// (contoh: index.html?calibrate=1). Halaman akan langsung loncat ke
// section kue & menyalakan lilin. Pakai tombol panah ATAS/BAWAH untuk
// menggeser lilin sampai pas duduk di permukaan kue. Angka akhirnya
// muncul di layar — salin angka itu ke variabel --candle-base di
// style.css (cari komentar "SATU ANGKA INI" di bagian .cake-stage),
// lalu hapus ?calibrate=1 dari URL untuk kembali ke alur normal.
if (new URLSearchParams(window.location.search).get('calibrate') === '1') {
  window.addEventListener('DOMContentLoaded', () => {
    const stage = document.querySelector('.cake-stage');
    const cakeSectionEl = document.getElementById('section-cake');
    const loadingEl = document.getElementById('loading-screen');
    const passwordEl = document.getElementById('password-page');

    // Loncat langsung ke section kue, lewati loading & password
    loadingEl.classList.add('hidden-section');
    passwordEl.classList.add('hidden-section');
    cakeSectionEl.classList.remove('hidden-section');
    cakeSectionEl.classList.add('lit');

    // Nyalakan lilin langsung tanpa animasi korek, biar cepat kelihatan
    const stick = document.getElementById('candle-stick');
    const flame = document.getElementById('candle-flame');
    if (stick) stick.classList.add('visible');
    if (flame) flame.classList.add('visible');

    let base = parseFloat(getComputedStyle(stage).getPropertyValue('--candle-base')) || 34;

    const readout = document.createElement('div');
    readout.style.cssText = `
      position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
      z-index: 999; background: #000; color: #fff; padding: 8px 16px;
      border-radius: 10px; font: 14px/1.4 monospace; text-align: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5); pointer-events: none;
    `;
    document.body.appendChild(readout);

    function updateReadout() {
      stage.style.setProperty('--candle-base', base.toFixed(1) + '%');
      readout.innerHTML = `--candle-base: <strong>${base.toFixed(1)}%</strong><br><span style="opacity:.7">↑/↓ geser · salin angka ini ke style.css</span>`;
    }
    updateReadout();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp')   { base = Math.min(base + 0.5, 100); updateReadout(); }
      if (e.key === 'ArrowDown') { base = Math.max(base - 0.5, 0);   updateReadout(); }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('main-audio');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const progressBar = document.getElementById('audio-progress');
  const currentTimeEl = document.getElementById('audio-current-time');
  const durationEl = document.getElementById('audio-duration');
  const trackTitleEl = document.getElementById('current-track-title');
  const statusDot = document.getElementById('player-status-dot');
  const reelLeft = document.getElementById('reel-left');
  const reelRight = document.getElementById('reel-right');
  const trackBtns = document.querySelectorAll('.track-btn');

  // Format Detik ke MM:SS
  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Set Animasi Reel Kaset saat Audio Memutar/Berhenti
  function setReelAnimation(isPlaying) {
    if (isPlaying) {
      reelLeft.classList.add('animate-spin');
      reelRight.classList.add('animate-spin');
      reelLeft.style.animationDuration = '12s';
      reelRight.style.animationDuration = '12s';
      statusDot.classList.replace('bg-[#B89B86]', 'bg-[#A66E68]');
      statusDot.classList.add('animate-pulse');
    } else {
      reelLeft.classList.remove('animate-spin');
      reelRight.classList.remove('animate-spin');
      statusDot.classList.replace('bg-[#A66E68]', 'bg-[#B89B86]');
      statusDot.classList.remove('animate-pulse');
    }
  }

  // Toggle Play / Pause
  function togglePlay() {
    if (audio.paused) {
      audio.play().then(() => {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
        setReelAnimation(true);
      }).catch(err => console.error("Playback error:", err));
    } else {
      audio.pause();
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
      setReelAnimation(false);
    }
  }

  playPauseBtn.addEventListener('click', togglePlay);

  // Update Metadata & Durasi
  audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
  });

  // Update Progress Bar & Waktu Berjalan
  audio.addEventListener('timeupdate', () => {
    if (!isNaN(audio.duration) && audio.duration > 0) {
      const progressPercent = (audio.currentTime / audio.duration) * 100;
      progressBar.value = progressPercent;
      currentTimeEl.textContent = formatTime(audio.currentTime);
    }
  });

  // Scrubbing / Seeking Musik melalui Progress Bar
  progressBar.addEventListener('input', () => {
    if (!isNaN(audio.duration)) {
      audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
  });

  // Ketika Lagu Selesai
  audio.addEventListener('ended', () => {
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    progressBar.value = 0;
    currentTimeEl.textContent = '0:00';
    setReelAnimation(false);
  });

  // --- LOGIKA TOAST MODAL ---
  const nextActionModal = document.getElementById('next-action-modal');
  const btnLanjutKue = document.getElementById('btn-lanjut-kue');
  const btnPilihLagu = document.getElementById('btn-pilih-lagu');
  const mainMenuContainer = document.querySelector('#main-page > div');
  let currentSelectedMenu = 'kalender';

  function showNextActionModal() {
    nextActionModal.classList.remove('hidden-section');
    mainMenuContainer.style.transition = 'filter 0.4s ease';
    
    requestAnimationFrame(() => {
      nextActionModal.classList.add('modal-enter-active');
      mainMenuContainer.classList.add('menu-blur');
    });
  }

  function hideNextActionModal() {
    nextActionModal.classList.remove('modal-enter-active');
    mainMenuContainer.classList.remove('menu-blur');
    
    setTimeout(() => {
      nextActionModal.classList.add('hidden-section');
    }, 300);
  }

  // Tutup modal jika user memilih "Pilih Lagu Lain"
  btnPilihLagu.addEventListener('click', hideNextActionModal);

  // Transisi ke Section yang sesuai saat user klik Lanjut
  btnLanjutKue.addEventListener('click', () => {
    hideNextActionModal();
    if (currentSelectedMenu === 'galeri') {
      openGallery();
    } else if (currentSelectedMenu === 'pesan') {
      sceneTransition(() => {
        hideSection(mainPage);
        openMessageSection();
      });
    } else {
      // Default: Kalender / Kue & Lilin
      sceneTransition(() => {
        hideSection(mainPage);
        resetCakeSection();
        showSection(cakeSection);
        if (stopCakeAmbient) stopCakeAmbient();
        stopCakeAmbient = startAmbientPetals(cakeSection, 4);
        startIgniteSequence();
      });
    }
  });

  // Track buttons event listener
  trackBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentSelectedMenu = btn.getAttribute('data-menu') || 'kalender';
      const newSrc = btn.getAttribute('data-src');
      const newTitle = btn.getAttribute('data-title');

      if (newSrc && audio.src !== window.location.origin + '/' + newSrc && !audio.src.includes(newSrc)) {
        audio.src = newSrc;
        trackTitleEl.textContent = newTitle;
        progressBar.value = 0;
        audio.play().then(() => {
          iconPlay.classList.add('hidden');
          iconPause.classList.remove('hidden');
          setReelAnimation(true);
          
          // Munculkan toast setelah delay 600ms
          setTimeout(showNextActionModal, 600);
        }).catch(err => console.error("Audio src error:", err));
      } else {
        // Jika lagu yang sama diklik lagi
        if (audio.paused) togglePlay();
        showNextActionModal();
      }
    });
  });
});

