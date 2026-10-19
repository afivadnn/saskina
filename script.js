
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
          showSection(document.getElementById('section-intro'));
          startTypingStory(); // Panggil Typing Story
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

  candleFlame.classList.remove('blowing');
  candleFlame.classList.add('extinguishing');
  spawnSmokePuffs();

  extinguishTimer = setTimeout(() => {
    candleFlame.classList.remove('visible', 'extinguishing');
    holdTarget.style.setProperty('--cake-scale', '1');

    if (stopCakeAmbient) { stopCakeAmbient(); stopCakeAmbient = null; }

    // FADE TO BLACK MURNI (Tanpa transisi bunga)
    const blackout = document.getElementById('scene-transition');
    blackout.classList.add('fade-in-black'); 
    
    setTimeout(() => {
      cakeSection.style.setProperty('--dim-opacity', '0');
      hideSection(cakeSection);
      
      // Ubah teks Blown agar lebih emosional
      const blownText = document.getElementById('blown-text-screen');
      if(blownText) blownText.innerHTML = "Apinya padam...<br><span class='text-xl sm:text-2xl text-rose/80 mt-4 block'>Semoga semua harapanmu ikut terbang malam ini ✨</span>";
      
      showSection(blownSection);
      blackout.classList.remove('fade-in-black'); 
    }, 600); 

  }, 500);

  blownTextTimer = setTimeout(() => {
    // BARU panggil transisi bunga SETELAH momen hening selesai
    sceneTransition(() => {
      hideSection(blownSection);
      renderWishes();
      showSection(wishSection);
      wishSection.scrollTop = 0;
    });
  }, 4800); // Jeda hening yang dramatis
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

// ============================================================
// WISH SECTION REDESIGN: ZERO-LAYOUT-SHIFT MOTION
// ============================================================

function renderWishes() {
  const wishesContainer = document.getElementById('wishes-container');
  const wishHeader = document.getElementById('wish-header');
  const wishFooter = document.getElementById('wish-footer-hint');
  
  if (!wishesContainer) return;
  
  wishesContainer.innerHTML = '';
  wishAlreadyPicked = false;
  
  // Reset opacity elemen UI
  if (wishHeader) wishHeader.style.opacity = '1';
  if (wishFooter) wishFooter.style.opacity = '1';
  
  const wishPopup = document.getElementById('wish-popup');
  const popupBackdrop = document.getElementById('wish-popup-backdrop');
  const popupCard = document.getElementById('wish-popup-card');

  if (wishPopup) wishPopup.classList.add('hidden-section');
  if (popupBackdrop) popupBackdrop.classList.add('opacity-0');
  if (popupCard) {
    popupCard.classList.add('opacity-0', 'scale-90', 'translate-y-6');
    popupCard.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
  }

  // Koordinat Absolut terukur (% dari container)
  // Menjamin jarak visual seimbang di layar HP maupun Desktop tanpa pergeseran
  const absoluteCoordinates = [
    { top: '16%', left: '28%', delay: '0s' },
    { top: '38%', left: '72%', delay: '-1.2s' },
    { top: '62%', left: '28%', delay: '-2.4s' },
    { top: '84%', left: '72%', delay: '-3.6s' }
  ];

  WISHES.forEach((label, index) => {
    const card = document.createElement('div');
    card.className = 'wish-card-item is-idle';
    
    const coord = absoluteCoordinates[index % absoluteCoordinates.length];
    card.style.top = coord.top;
    card.style.left = coord.left;
    card.style.animationDelay = coord.delay;

    card.innerHTML = `
      <div class="wish-card-inner">
        <span class="text-gold/70 text-xs">✦</span>
        <span class="wish-card-text">${label}</span>
      </div>
    `;

    card.addEventListener('click', () => handleWishClick(card, wishesContainer));
    wishesContainer.appendChild(card);
  });

  if (stopWishAmbient) stopWishAmbient();
  stopWishAmbient = startAmbientPetals(wishSection, 4);
}

function handleWishClick(selectedCard, container) {
  if (wishAlreadyPicked) return;
  wishAlreadyPicked = true;

  const wishHeader = document.getElementById('wish-header');
  const wishFooter = document.getElementById('wish-footer-hint');

  // 1. Redupkan header & footer perlahan
  if (wishHeader) wishHeader.style.opacity = '0';
  if (wishFooter) wishFooter.style.opacity = '0';

  // 2. Tembakkan partikel cahaya pada titik kartu yang dipilih
  spawnWishSparkles(selectedCard, container);

  // 3. Eksekusi animasi terpisah untuk wish terpilih & wish lainnya
  const allCards = container.querySelectorAll('.wish-card-item');
  allCards.forEach((card) => {
    card.classList.remove('is-idle');
    if (card === selectedCard) {
      card.classList.add('is-selected');
    } else {
      // Memudar di tempat persis tanpa berpindah koordinat
      card.classList.add('is-fading');
    }
  });

  // 4. Munculkan Modal Konfirmasi setelah efek sublimasi selesai (~1.2s)
  setTimeout(() => {
    const wishPopup = document.getElementById('wish-popup');
    const popupBackdrop = document.getElementById('wish-popup-backdrop');
    const popupCard = document.getElementById('wish-popup-card');

    if (wishPopup) wishPopup.classList.remove('hidden-section');

    requestAnimationFrame(() => {
      if (popupBackdrop) popupBackdrop.classList.remove('opacity-0');
      if (popupCard) {
        popupCard.classList.remove('opacity-0', 'scale-90', 'translate-y-6');
        popupCard.classList.add('opacity-100', 'scale-100', 'translate-y-0');
      }
    });
  }, 1200);

  // 5. Transisi mulus ke Galeri setelah pesan dibaca (~4 detik)
  setTimeout(() => {
    sceneTransition(() => {
      if (stopWishAmbient) { stopWishAmbient(); stopWishAmbient = null; }
      hideSection(wishSection);
      
      const wishPopup = document.getElementById('wish-popup');
      if (wishPopup) wishPopup.classList.add('hidden-section');

      resetGallery();
      showSection(gallerySection);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          buildGallery();
          if (stopGalleryAmbient) stopGalleryAmbient();
          stopGalleryAmbient = startAmbientPetals(gallerySection, 6);
        });
      });
    });
  }, 4800);
}

// Sparkle Effect Generator
function spawnWishSparkles(targetCard, container) {
  const rect = targetCard.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Hitung pusat kartu terhadap container
  const centerX = rect.left + rect.width / 2 - containerRect.left;
  const centerY = rect.top + rect.height / 2 - containerRect.top;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'wish-sparkle-particle';

    const size = 4 + Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 80;

    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);
    particle.style.animationDelay = `${Math.random() * 0.2}s`;

    container.appendChild(particle);

    setTimeout(() => particle.remove(), 1400);
  }
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

// ============================================================
// MEMORY EXHIBITION GALLERY LOGIC
// ============================================================

// Data 15 Foto Pameran Kenangan
const EXHIBITION_DATA = [
  {
    id: 1,
    src: 'foto1.jpg',
    tag: 'EXHIBIT 01 — AWAL KISAH',
    title: 'Awal Pertemuan',
    desc: 'Hari di mana semuanya dimulai tanpa kita sadari.',
    type: 'feature-hero'
  },
  {
    id: 2,
    src: 'foto2.jpg',
    tag: 'EXHIBIT 02 — TAWA PERTAMA',
    title: 'Senyum yang Selalu Sama',
    desc: 'Tawa kecilmu yang selalu berhasil menenangkan hari.',
    type: 'portrait-single'
  },
  {
    id: 3,
    src: 'foto3.jpg',
    tag: 'EXHIBIT 03 — PERJALANAN',
    title: 'Jejak Langkah Bersama',
    desc: 'Menyusuri jalanan biasa yang terasa istimewa bersamamu.',
    type: 'landscape-wide'
  },
  {
    id: 4,
    src: 'foto4.jpg',
    tag: 'EXHIBIT 04 — KEBERSAMAAN I',
    title: 'Sore yang Tenang',
    desc: 'Tidak perlu banyak kata, cukup ada kamu di sampingku.',
    type: 'dual-1'
  },
  {
    id: 5,
    src: 'foto5.jpg',
    tag: 'EXHIBIT 05 — KEBERSAMAAN II',
    title: 'Sudut Favorit',
    desc: 'Tempat kecil yang menyimpan ribuan cerita kita.',
    type: 'dual-2'
  },
  {
    id: 6,
    src: 'foto6.jpg',
    tag: 'EXHIBIT 06 — SEMENTARA',
    title: 'Menatap Masa Depan',
    desc: 'Melihat jauh ke depan dengan menggenggam tanganmu.',
    type: 'portrait-single'
  },
  {
    id: 7,
    src: 'foto7.jpg',
    tag: 'EXHIBIT 07 — SEDERHANA',
    title: 'Momen Sederhana',
    desc: 'Hal biasa yang terasa sempurna karena kamu yang melakukan.',
    type: 'landscape-wide'
  },
  {
    id: 8,
    src: 'foto8.jpg',
    tag: 'EXHIBIT 08 — CATATAN KECIL',
    title: 'Cerita Tanpa Suara',
    desc: 'Tatapan mata yang selalu mengerti tanpa perlu dijelaskan.',
    type: 'feature-hero'
  },
  {
    id: 9,
    src: 'foto9.jpg',
    tag: 'EXHIBIT 09 — PELUKAN HANGAT',
    title: 'Rumah Terbaik',
    desc: 'Di mana pun kita berada, bersamamu adalah tempat pulang.',
    type: 'portrait-single'
  },
  {
    id: 10,
    src: 'foto10.jpg',
    tag: 'EXHIBIT 10 — HARI ITU',
    title: 'Hari yang Dikenang',
    desc: 'Satu dari sekian banyak hari yang ingin kuulang kembali.',
    type: 'landscape-wide'
  },
  {
    id: 11,
    src: 'foto11.jpg',
    tag: 'EXHIBIT 11 — HARAPAN',
    title: 'Doa dalam Diam',
    desc: 'Selalu mendoakan kebahagiaanmu di setiap langkah.',
    type: 'dual-1'
  },
  {
    id: 12,
    src: 'foto12.jpg',
    tag: 'EXHIBIT 12 — LANGKAH BARU',
    title: 'Tumbuh Bersama',
    desc: 'Belajar dan makin dewasa di setiap fase kehidupan.',
    type: 'dual-2'
  },
  {
    id: 13,
    src: 'foto13.jpg',
    tag: 'EXHIBIT 13 — CAHAYA',
    title: 'Binar Mata Itu',
    desc: 'Cahaya favorit yang tidak pernah pudar.',
    type: 'portrait-single'
  },
  {
    id: 14,
    src: 'foto14.jpg',
    tag: 'EXHIBIT 14 — BERSAMAMU',
    title: 'Hari-Hari Terbaik',
    desc: 'Setiap lembar waktu yang ditulis indah oleh kehadiranmu.',
    type: 'landscape-wide'
  },
  {
    id: 15,
    src: 'foto15.jpg',
    tag: 'EXHIBIT 15 — UNTUK SELAMANYA',
    title: 'Isma Saskina.',
    desc: 'Terima kasih sudah ada, tumbuh, dan menjadi bagian terindah dalam hidupku.',
    type: 'climax'
  }
];

let exhibitionObserver = null;

function buildGallery() {
  const container = document.getElementById('exhibition-container');
  if (!container) return;

  container.innerHTML = '';

  let currentDualGroup = null;

  EXHIBITION_DATA.forEach((item) => {
    // Handling Layout Dual Stagger
    if (item.type === 'dual-1') {
      currentDualGroup = document.createElement('div');
      currentDualGroup.className = 'exhibit-item layout-dual-stagger';
      
      const el1 = createExhibitElement(item, 'dual-item-1');
      currentDualGroup.appendChild(el1);
      return;
    }

    if (item.type === 'dual-2' && currentDualGroup) {
      const el2 = createExhibitElement(item, 'dual-item-2');
      currentDualGroup.appendChild(el2);
      container.appendChild(currentDualGroup);
      currentDualGroup = null;
      return;
    }

    // Standard Layout Items
    const wrapper = document.createElement('div');
    wrapper.className = `exhibit-item layout-${item.type}`;
    wrapper.appendChild(createExhibitElement(item));
    container.appendChild(wrapper);
  });

  // Inisialisasi Intersection Observer untuk Scroll Reveal
  initExhibitionObserver();
}

function createExhibitElement(data, extraClass = '') {
  const card = document.createElement('div');
  card.className = `exhibit-card-wrapper ${extraClass}`;

  card.innerHTML = `
    <div class="exhibit-frame" onclick="openLightbox('${data.src}', '${data.title}')">
      <img src="${data.src}" alt="${data.title}" class="exhibit-img" loading="lazy" />
    </div>
    <div class="exhibit-plaque">
      <span class="exhibit-tag">${data.tag}</span>
      <h3 class="exhibit-title">${data.title}</h3>
      <p class="exhibit-desc">${data.desc}</p>
    </div>
  `;

  return card;
}

function initExhibitionObserver() {
  if (exhibitionObserver) exhibitionObserver.disconnect();

  const items = document.querySelectorAll('.exhibit-item');
  const footer = document.getElementById('exhibition-footer');

  exhibitionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, {
    threshold: 0.15
  });

  items.forEach((item) => exhibitionObserver.observe(item));

  // Observer khusus untuk footer tombol lanjut
  if (footer) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          footer.style.opacity = '1';
        }
      });
    }, { threshold: 0.3 });
    footerObserver.observe(footer);
  }
}

function resetGallery() {
  const container = document.getElementById('exhibition-container');
  const footer = document.getElementById('exhibition-footer');
  if (container) container.innerHTML = '';
  if (footer) footer.style.opacity = '0';
  if (exhibitionObserver) exhibitionObserver.disconnect();
  closeLightbox();
}

// Open & Close Lightbox
function openLightbox(src, caption) {
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbCap = document.getElementById('lightbox-caption');

  if (lb && lbImg) {
    lbImg.src = src;
    if (lbCap) lbCap.textContent = caption;
    lb.classList.remove('hidden-section');
  }
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.add('hidden-section');
}

// Navigasi Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const galleryBackBtn = document.getElementById('gallery-back-btn');
  const galleryLetterBtn = document.getElementById('gallery-letter-btn');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxBackdrop = document.getElementById('lightbox-backdrop');

  if (galleryBackBtn) {
    galleryBackBtn.addEventListener('click', () => {
      sceneTransition(() => {
        resetGallery();
        hideSection(document.getElementById('section-gallery'));
        showSection(document.getElementById('main-page'));
      });
    });
  }

  if (galleryLetterBtn) {
    galleryLetterBtn.addEventListener('click', () => {
      sceneTransition(() => {
        resetGallery();
        hideSection(document.getElementById('section-gallery'));
        openMessageSection();
      });
    });
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
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
    
    // PERBAIKAN LOGIKA: Apapun lagu yang dipilih, perjalanan WAJIB dimulai dari Kue (Linear Journey)
    sceneTransition(() => {
      hideSection(mainPage);
      resetCakeSection();
      showSection(cakeSection);
      if (stopCakeAmbient) stopCakeAmbient();
      stopCakeAmbient = startAmbientPetals(cakeSection, 4);
      startIgniteSequence();
    });
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

// ============================================================
// FITUR TAMBAHAN: TYPING STORY, ENVELOPE, PARALLAX, & LOVE COUNTER
// ============================================================

// 1. TYPING STORY INTRO
const storyText = "Sebelum kita merayakan hari ini, mari kita putar kembali waktunya sebentar...";
const typingContainer = document.getElementById('typing-container');
const introSection = document.getElementById('section-intro');
const skipHint = document.getElementById('skip-hint');
let charIndex = 0;
let typingTimeout;
let isTypingSkipped = false;

function startTypingStory() {
  charIndex = 0;
  isTypingSkipped = false;
  typingContainer.textContent = '';
  typingContainer.classList.add('typing-cursor');
  typeCharacter();
  
  // Munculkan hint skip setelah 2 detik
  setTimeout(() => { skipHint.classList.remove('opacity-0'); }, 2000);
}

function typeCharacter() {
  if (isTypingSkipped) return;
  if (charIndex < storyText.length) {
    typingContainer.textContent += storyText.charAt(charIndex);
    charIndex++;
    typingTimeout = setTimeout(typeCharacter, 60); // Kecepatan ketik (ms)
  } else {
    typingContainer.classList.remove('typing-cursor');
  }
}

// Tap di mana saja untuk skip atau lanjut
// Ganti bagian transisi Typing Story menjadi:
introSection.addEventListener('click', () => {
  if (charIndex < storyText.length && !isTypingSkipped) {
    isTypingSkipped = true;
    clearTimeout(typingTimeout);
    typingContainer.textContent = storyText;
    typingContainer.classList.remove('typing-cursor');
  } else {
    // Lanjut ke Memory Section
    sceneTransition(() => {
      hideSection(introSection);
      showSection(document.getElementById('section-memory'));
      
      // Trigger animasi fade-in elemen memori
      setTimeout(() => {
        document.getElementById('mem-text-1').classList.remove('opacity-0', 'translate-y-4');
        document.getElementById('mem-video-frame').classList.remove('opacity-0', 'scale-95');
        document.getElementById('mem-text-2').classList.remove('opacity-0', 'translate-y-4');
        document.getElementById('btn-lanjut-memory').classList.remove('opacity-0', 'translate-y-4');
      }, 500);
    });
  }
});

// Listener untuk tombol lanjut di Memory Section
document.getElementById('btn-lanjut-memory').addEventListener('click', () => {
  sceneTransition(() => {
    hideSection(document.getElementById('section-memory'));
    showSection(mainPage);
  });
});

// 2. PARALLAX EFFECT DI MAIN MENU
const mainPageEl = document.getElementById('main-page');
const mixtapeCard = document.querySelector('#main-page > div');

mainPageEl.addEventListener('mousemove', (e) => {
  // Matikan parallax di mobile untuk jaga performa
  if (window.innerWidth < 768) return; 
  
  const xAxis = (window.innerWidth / 2 - e.pageX) / 35;
  const yAxis = (window.innerHeight / 2 - e.pageY) / 35;
  mixtapeCard.style.transform = `perspective(1000px) rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
});

mainPageEl.addEventListener('mouseleave', () => {
  mixtapeCard.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg)`;
});

// 3. INTERACTIVE ENVELOPE (SURAT)
const envelopeWrapper = document.getElementById('envelope-wrapper');
const envelopeFlap = document.getElementById('envelope-flap');
const envelopeFront = document.getElementById('envelope-front');
const letterContentWrapper = document.getElementById('letter-content-wrapper');

let isEnvelopeOpened = false;

envelopeWrapper.addEventListener('click', () => {
  if (isEnvelopeOpened) return;
  isEnvelopeOpened = true;

  // 1. Buka Flap
  envelopeFlap.classList.add('envelope-open-flap');
  document.getElementById('envelope-text').classList.add('hidden');
  
  // 2. Hilangkan penutup depan amplop
  setTimeout(() => {
    envelopeFront.classList.add('envelope-fade-front');
  }, 300);

  // 3. Tarik Kertas ke atas & mulai animasi surat (stagger)
  setTimeout(() => {
    letterContentWrapper.classList.add('envelope-pull-letter');
    
    // Trigger animasi paragraf surat yang sudah ada di sistemmu
    const lines = document.querySelectorAll('.letter-line, .letter-sign');
    lines.forEach((line, i) => {
      setTimeout(() => line.classList.add('line-revealed'), 400 + (i * 200));
    });

    // Tampilkan tombol penutup setelah surat selesai dibaca
    const closingCard = document.querySelector('.closing-card');
    const openBtn = document.getElementById('open-flower-btn');
    const letterDelay = 400 + (lines.length * 200) + 400;

    if (closingCard) { setTimeout(() => closingCard.classList.add('card-revealed'), letterDelay); }
    if (openBtn) { setTimeout(() => openBtn.classList.add('btn-revealed'), letterDelay + 200); }

  }, 800);
});

// Pastikan saat section message dibuka ulang, amplop tertutup kembali
const originalOpenMessageSection = openMessageSection; // Ambil referensi fungsi lama
window.openMessageSection = function() {
  // Reset envelope
  isEnvelopeOpened = false;
  envelopeFlap.classList.remove('envelope-open-flap');
  envelopeFront.classList.remove('envelope-fade-front');
  letterContentWrapper.classList.remove('envelope-pull-letter');
  document.getElementById('envelope-text').classList.remove('hidden');
  
  // Reset line-revealed
  document.querySelectorAll('.letter-line, .letter-sign').forEach(el => el.classList.remove('line-revealed'));
  const closingCard = document.querySelector('.closing-card');
  const openBtn = document.getElementById('open-flower-btn');
  if(closingCard) closingCard.classList.remove('card-revealed');
  if(openBtn) openBtn.classList.remove('btn-revealed');

  // Jalankan fungsi aslinya untuk show section (hilangkan animasi otomatis lamanya)
  showSection(msgSection);
  msgSection.scrollTop = 0;
  if (stopMessageAmbient) stopMessageAmbient();
  stopMessageAmbient = startAmbientPetals(msgSection, 5);
}

// 4. CLIMAX & LOVE COUNTER (Ganti fungsi Buka Bunga menjadi ke Outro)
const sectionOutro = document.getElementById('section-outro');
const btnBukaBunga = document.getElementById('open-flower-btn');
let loveCounterInterval;

const START_DATE = new Date('2007-12-02T00:00:00'); 

function updateLoveCounter() {
  const now = new Date();
  const diff = now - START_DATE;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / 1000 / 60) % 60);

  document.getElementById('count-days').textContent = days;
  document.getElementById('count-hours').textContent = hours;
  document.getElementById('count-mins').textContent = mins;
}

// Timpa event listener bawaan untuk tombol Buka Bunga
btnBukaBunga.removeEventListener('click', openFlowerModal); 
btnBukaBunga.addEventListener('click', () => {
  sceneTransition(() => {
    hideSection(msgSection);
    showSection(sectionOutro);
    
    // Mulai animasi Counter & Teks setelah section terbuka
    setTimeout(() => {
      document.getElementById('love-counter-box').classList.remove('translate-y-4', 'opacity-0');
      document.getElementById('outro-final-text').classList.remove('opacity-0');
      
      updateLoveCounter();
      loveCounterInterval = setInterval(updateLoveCounter, 60000); // Update tiap 1 menit
    }, 1000);
  });
});