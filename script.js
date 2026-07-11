// ============================================================
// KONFIGURASI
// ============================================================
const CORRECT_PASSWORD = '021207';
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

/**
 * Transisi antar scene dengan blackout sinematik:
 *  1. Fade ke hitam (durIn ms) — cubic-bezier tajam
 *  2. Callback (ganti section)
 *  3. Section baru muncul dengan scale 0.98→1 + fade (durOut ms)
 */
function sceneTransition(callback, durIn = 300, durOut = 450) {
  sceneTransitionEl.style.setProperty('--scene-dur', `${durIn}ms`);
  sceneTransitionEl.classList.add('fade-in-black');

  setTimeout(() => {
    callback();
    sceneTransitionEl.style.setProperty('--scene-dur', `${durOut}ms`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sceneTransitionEl.classList.remove('fade-in-black');
      });
    });
  }, durIn);
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
    }, 400, 450);
  }, LOADING_DURATION_MS);
});

// ============================================================
// 2. VALIDASI PASSWORD -> MAIN PAGE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const pinDots = document.querySelectorAll('.pin-dot');
  const numpadBtns = document.querySelectorAll('.numpad-btn[data-val]');
  const backspaceBtn = document.getElementById('btn-backspace');
  
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

  // Fungsi Validasi Utama
  function validatePin() {
    // Beri sedikit jeda agar user melihat titik terakhir terisi sebelum transisi
    setTimeout(() => {
      if (currentPin === CORRECT_PASSWORD) {
        sceneTransition(() => {
          hideSection(passwordPage);
          showSection(mainPage);
        }, 280, 420);
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
const holdRingProgress = document.getElementById('hold-ring-progress');
const holdHint         = document.getElementById('hold-hint');
const petalsLayer      = document.getElementById('petals-layer');
const backToMenuBtn    = document.getElementById('back-to-menu-btn');

// Section blown & wish terpisah
const blownSection     = document.getElementById('section-blown');
const wishSection      = document.getElementById('section-wish');
const wishesContainer  = document.getElementById('wishes-container');
const wishPopup        = document.getElementById('wish-popup');
const wishBackBtn      = document.getElementById('wish-back-btn');

// Referensi timer/RAF/state — semua wajib direset lewat resetCakeSection()
let igniteTimer      = null;
let holdWarningTimer = null;
let blownTextTimer   = null;
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
function startIgniteSequence() {
  igniteTimer = setTimeout(igniteCandle, IGNITE_DELAY_MS);
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

  if (elapsed < HOLD_DURATION_MS) {
    holdHint.textContent = 'Yah, nafasnya kurang panjang 😤';
    holdHint.classList.add('warning');

    clearTimeout(holdWarningTimer);
    holdWarningTimer = setTimeout(() => {
      if (!candleIsExtinguished) {
        holdHint.textContent = '👆 Tekan & tahan lilinnya sampai padam';
        holdHint.classList.remove('warning');
      }
    }, 1600);
  }
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
  setTimeout(() => {
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
    }, 500, 600);
  }, 500);

  // Setelah blown text cukup terbaca, fade ke wish section
  blownTextTimer = setTimeout(() => {
    sceneTransition(() => {
      hideSection(blownSection);
      renderWishes();
      showSection(wishSection);
      wishSection.scrollTop = 0;
    }, 500, 600);
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

  // 1. Redupkan tag yang tidak dipilih, highlight yang dipilih
  document.querySelectorAll('.wish-tag').forEach((tag) => {
    if (tag === selectedTag) {
      tag.classList.add('selected-float');
    } else {
      tag.classList.add('dimmed');
      tag.style.pointerEvents = 'none';
    }
  });

  // 2. Munculkan popup & jalankan efek kelopak
  spawnPetals(20);
  if (wishPopup) wishPopup.classList.remove('hidden-section');

  // 3. Delayed Auto-Transition menggunakan sceneTransition lu sendiri
  setTimeout(() => {
    // Fungsi sceneTransition sudah mengatur fade-to-black
    sceneTransition(() => {
      // Hentikan efek hujan kelopak di background wish
      if (stopWishAmbient) { stopWishAmbient(); stopWishAmbient = null; }
      
      // Sembunyikan section wish
      hideSection(wishSection);
      if (wishPopup) wishPopup.classList.add('hidden-section');
      
      // Siapkan dan munculkan gallery
      const gallerySection = document.getElementById('section-gallery');
      resetGallery();
      showSection(gallerySection);
      
      // Trigger rendering gallery setelah transisi layar hitam
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          buildGallery();
          if (stopGalleryAmbient) stopGalleryAmbient();
          stopGalleryAmbient = startAmbientPetals(gallerySection, 6);
        });
      });
    }, 400, 500); // 400ms durasi fade in layar hitam, 500ms fade out ke gallery
  }, 3200); // Jeda 3.2 detik agar user sempat membaca teks konfirmasi
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
  spawnPetals(20);
  if (wishPopup) wishPopup.classList.remove('hidden-section');

  // 3. Transisi otomatis ke Gallery setelah jeda membaca (3 detik)
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
      
      // Render layout galeri menggunakan double rAF untuk memastikan DOM siap
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          buildGallery();
          if (stopGalleryAmbient) stopGalleryAmbient();
          stopGalleryAmbient = startAmbientPetals(gallerySection, 6);
        });
      });
    }, 400, 500); // 400ms durasi fade-in layar hitam, 500ms durasi fade-out ke galeri
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
  cancelAnimationFrame(holdRAF);
  stopSparkEffect();

  holdRAF = null;
  holdStartTime = null;
  candleIsLit = false;
  candleIsExtinguished = false;
  wishAlreadyPicked = false;

  cakeSection.classList.remove('lit');
  candleFlame.classList.remove('visible', 'blowing', 'extinguishing');
  setRingProgress(0);

  // Reset efek hold
  holdTarget.style.setProperty('--cake-scale', '1');
  cakeSection.style.setProperty('--dim-opacity', '0');

  holdTarget.style.setProperty('--hold-progress', '0');

  holdHint.classList.add('hidden-section');
  holdHint.classList.remove('warning');

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
  }, 280, 420);
});

wishBackBtn.addEventListener('click', () => {
  sceneTransition(() => {
    if (stopWishAmbient) { stopWishAmbient(); stopWishAmbient = null; }
    hideSection(wishSection);
    showSection(mainPage);
  }, 280, 420);
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
  }, 280, 420);
}

galleryBackBtn.addEventListener('click', () => {
  sceneTransition(() => {
    resetGallery();
    hideSection(gallerySection);
    showSection(mainPage);
  }, 280, 420);
});

galleryLetterBtn.addEventListener('click', () => {
  sceneTransition(() => {
    resetGallery();
    hideSection(gallerySection);
    openMessageSection();
  }, 280, 420);
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
  const restartBtnEl = document.getElementById('restart-btn');
  const letterDelay = 200 + lines.length * 100 + 200;

  if (closingCard) {
    closingCard.classList.remove('card-revealed');
    setTimeout(() => closingCard.classList.add('card-revealed'), letterDelay);
  }
  if (openBtn) {
    openBtn.classList.remove('btn-revealed');
    setTimeout(() => openBtn.classList.add('btn-revealed'), letterDelay + 180);
  }
  if (restartBtnEl) {
    restartBtnEl.classList.remove('btn-revealed');
    setTimeout(() => restartBtnEl.classList.add('btn-revealed'), letterDelay + 320);
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
      }, 280, 420);
    } else if (menu === 'galeri') {
      openGallery();
    } else if (menu === 'pesan') {
      sceneTransition(() => {
        hideSection(mainPage);
        openMessageSection();
      }, 280, 420);
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
const restartBtn      = document.getElementById('restart-btn');

// ── Modal buket bunga ────────────────────────────────────────
const flowerModal        = document.getElementById('flower-modal');
const flowerModalBackdrop= document.getElementById('flower-modal-backdrop');
const flowerBackBtn      = document.getElementById('flower-back-btn');
const flowerRestartBtn   = document.getElementById('flower-restart-btn');
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
restartBtn.addEventListener('click', () => location.reload());
flowerRestartBtn.addEventListener('click', () => location.reload());

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
  }, 280, 420);
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