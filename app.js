/* ================================================================
   PANTRY APP — app.js
   ================================================================
   CUSTOMIZATION GUIDE:
   - [CONFIG]   → API keys, Firebase config (top of file)
   - [MATCHING] → Category matching logic
   - [THRESHOLDS] → Default low-stock threshold
   ================================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ================================================================
// [CONFIG] — Firebase & API configuration
// ================================================================

const firebaseConfig = {
  apiKey:            "AIzaSyBs4yuMJEOhVOZw8E_Ghnn7Y_jtsYxei38",
  authDomain:        "shop-list-web-app.firebaseapp.com",
  projectId:         "shop-list-web-app",
  storageBucket:     "shop-list-web-app.firebasestorage.app",
  messagingSenderId: "323355056685",
  appId:             "1:323355056685:web:41661b5d6b8da54fe4f6a4"
};

// API keys & external services — edit here to swap providers
// OCR: API Ninjas imagetotext (images, compressed to <200KB)
// PDF text: pdf.js (loaded from CDN, no key needed)
// AI parsing: Gemini 2.5 Flash Lite via Google Generative Language REST API
const API_NINJAS_KEY  = 'lSaumA3b327yWoF07WURK6efk8u5zAAN2EhmP9fU';
const GEMINI_API_KEY  = 'AIzaSyBXg8ZoQObwPshU1f3NFRu3JFQkuefTaU8';
const GEMINI_MODEL    = 'gemini-2.5-flash-lite-preview-06-17'; // fast & cheap, text-only parsing

// [THRESHOLDS] — default "low" threshold for new items
const DEFAULT_LOW_THRESHOLD = 1;

// ================================================================
// FIREBASE INIT
// ================================================================
const fbApp  = initializeApp(firebaseConfig);
const auth   = getAuth(fbApp);
const db     = getFirestore(fbApp);
const googleProvider = new GoogleAuthProvider();

// ================================================================
// APP STATE
// ================================================================
let currentUser  = null;
let pantry       = [];   // local cache of Firestore docs
let unsubPantry  = null; // Firestore real-time listener unsubscribe fn
let reviewItems  = [];
let checkedShopIds = new Set();

// ================================================================
// AUTH STATE OBSERVER
// ================================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    showApp(user);
    subscribeToUserPantry(user.uid);
  } else {
    currentUser = null;
    if (unsubPantry) { unsubPantry(); unsubPantry = null; }
    pantry = [];
    showAuthScreen();
  }
});

// ================================================================
// AUTH FUNCTIONS
// ================================================================
window.switchAuth = (mode) => {
  document.getElementById('auth-login').classList.toggle('active',    mode === 'login');
  document.getElementById('auth-register').classList.toggle('active', mode === 'register');
};

window.handleLogin = async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
};

window.handleRegister = async () => {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('reg-error');
  errEl.style.display = 'none';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
  } catch (e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
};

window.handleGoogleLogin = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const errEl = document.getElementById('auth-error');
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
};

window.handleSignOut = async () => {
  await signOut(auth);
  toggleUserMenu(true);
};

function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email':          'Invalid email address.',
    'auth/user-not-found':         'No account found with that email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/email-already-in-use':   'That email is already registered.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/popup-closed-by-user':   'Google sign-in was cancelled.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
  };
  return map[code] || 'Authentication error. Please try again.';
}

function showApp(user) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  // Set user info in nav
  const initials = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  document.getElementById('user-avatar').textContent       = initials;
  document.getElementById('user-name-nav').textContent     = user.displayName || user.email.split('@')[0];
  document.getElementById('user-menu-email').textContent   = user.email;
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

window.toggleUserMenu = (forceClose) => {
  const menu = document.getElementById('user-menu');
  if (forceClose) { menu.style.display = 'none'; return; }
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};
document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-right')) {
    document.getElementById('user-menu').style.display = 'none';
  }
});

// ================================================================
// FIRESTORE — pantry collection per user
// ================================================================
function pantryCollection(uid) {
  return collection(db, 'users', uid, 'pantry');
}

function subscribeToUserPantry(uid) {
  if (unsubPantry) unsubPantry();
  const col = pantryCollection(uid);
  unsubPantry = onSnapshot(col, (snapshot) => {
    pantry = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderInventory();
    renderShopping();
    updateCategoryDatalist();
    updateSubtitle();
    setSyncIndicator('Synced');
  }, (err) => {
    console.error('Firestore error:', err);
    setSyncIndicator('Sync error');
  });
}

async function fsAddItem(item) {
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try {
    const ref = await addDoc(pantryCollection(currentUser.uid), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  } catch (e) { console.error('Add error:', e); toast('Error saving item'); }
}

async function fsUpdateItem(id, updates) {
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'pantry', id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (e) { console.error('Update error:', e); toast('Error updating item'); }
}

async function fsDeleteItem(id) {
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'pantry', id));
  } catch (e) { console.error('Delete error:', e); toast('Error deleting item'); }
}

// ================================================================
// TAB NAVIGATION
// ================================================================
window.showTab = (tab, btn) => {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  if (tab === 'inventory') renderInventory();
  if (tab === 'shopping')  renderShopping();
};

// ================================================================
// FILE / RECEIPT HANDLING — images, PDFs, and live camera
// ================================================================
window.dragOver = (e) => { e.preventDefault(); document.getElementById('scan-zone').classList.add('drag-over'); };
window.dragLeave = ()  => { document.getElementById('scan-zone').classList.remove('drag-over'); };
window.dropFile  = (e) => {
  e.preventDefault();
  document.getElementById('scan-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processReceiptFile(file);
};
window.handleFileSelect = (e) => {
  const file = e.target.files[0];
  if (file) processReceiptFile(file);
  e.target.value = '';
};
window.clearPreview = () => {
  document.getElementById('scan-preview-wrap').style.display = 'none';
  document.getElementById('scan-preview-img').src = '';
};

// ---- CAMERA ----
let cameraStream = null;

window.openCamera = async () => {
  // On mobile, prefer the native capture input (simpler UX)
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    document.getElementById('camera-file').click();
    return;
  }
  // Desktop: open in-page live camera view
  const view = document.getElementById('camera-view');
  const video = document.getElementById('camera-video');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = cameraStream;
    view.style.display = 'block';
  } catch (err) {
    // Permission denied or no camera — fall back to file picker
    toast('Camera not available, using file picker');
    document.getElementById('camera-file').click();
  }
};

window.closeCameraView = () => {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  document.getElementById('camera-view').style.display = 'none';
};

window.captureFromCamera = () => {
  const video  = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  closeCameraView();
  canvas.toBlob((blob) => {
    const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    processReceiptFile(file);
  }, 'image/jpeg', 0.92);
};

// ---- PROCESS FILE ----
async function processReceiptFile(file) {
  const isPDF = file.type === 'application/pdf';

  // Show preview
  const previewWrap = document.getElementById('scan-preview-wrap');
  const previewImg  = document.getElementById('scan-preview-img');
  if (isPDF) {
    previewImg.src = 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="130" viewBox="0 0 240 130">
        <rect width="240" height="130" rx="8" fill="#1A1814"/>
        <text x="120" y="58" font-family="sans-serif" font-size="32" fill="#C8954A" text-anchor="middle">📄</text>
        <text x="120" y="86" font-family="sans-serif" font-size="13" fill="#9A8F82" text-anchor="middle">PDF — ${file.name}</text>
      </svg>`);
    previewWrap.style.display = 'block';
  } else {
    const reader = new FileReader();
    reader.onload = (e) => { previewImg.src = e.target.result; previewWrap.style.display = 'block'; };
    reader.readAsDataURL(file);
  }

  showStatus('info', isPDF ? '📄 Reading PDF receipt…' : '🔍 Reading receipt image…');
  showProcessing(true, 'Preparing file…');

  try {
    let rawText = '';

    if (isPDF) {
      // PDFs: extract text directly from the PDF bytes using pdf.js
      showProcessingMsg('Extracting text from PDF…');
      rawText = await extractTextFromPDF(file);
      if (!rawText.trim()) throw new Error('No readable text found in PDF — is it a scanned image PDF?');
    } else {
      // Images: compress to <200 KB then OCR via API Ninjas
      showProcessingMsg('Compressing image…');
      const compressed = await compressImageBelow200KB(file);
      showProcessingMsg('Running OCR…');
      rawText = await ocrWithApiNinjas(compressed);
      if (!rawText.trim()) throw new Error('OCR found no text — try a clearer, well-lit photo');
    }

    // Parse raw OCR/PDF text into structured grocery items via Claude
    showProcessingMsg('Parsing items with AI…');
    const items = await parseReceiptTextWithClaude(rawText);

    showProcessing(false);
    if (items.length === 0) {
      showStatus('error', '✕ No grocery items found — try a clearer photo');
      return;
    }
    showStatus('success', `✓ Found ${items.length} item${items.length !== 1 ? 's' : ''}`);
    reviewItems = matchItemsToPantry(items);
    renderReview();
  } catch (err) {
    showProcessing(false);
    showStatus('error', '✕ ' + (err.message || 'Failed to process receipt'));
    console.error(err);
  }
}

// ================================================================
// STEP 1a — Compress image to below 200 KB using canvas
// ================================================================
function compressImageBelow200KB(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      // Start at original size, scale down if needed
      let w = img.width, h = img.height;
      // Cap at 1600px on longest side to keep file reasonable
      const MAX_DIM = 1600;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      // Try quality levels from 0.85 down until under 200 KB
      const tryQuality = (q) => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          if (blob.size <= 200 * 1024 || q <= 0.2) {
            resolve(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
          } else {
            tryQuality(Math.round((q - 0.1) * 10) / 10);
          }
        }, 'image/jpeg', q);
      };
      tryQuality(0.85);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

// ================================================================
// STEP 1b — OCR via API Ninjas imagetotext
// ================================================================
async function ocrWithApiNinjas(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const resp = await fetch('https://api.api-ninjas.com/v1/imagetotext', {
    method: 'POST',
    headers: { 'X-Api-Key': API_NINJAS_KEY },
    body: formData
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`OCR failed (${resp.status}): ${msg || 'API Ninjas error'}`);
  }

  const result = await resp.json();
  // API returns [{ text: "...", score: 0.9 }, ...] — join all lines
  if (!Array.isArray(result) || result.length === 0) return '';
  return result.map(r => r.text || '').join('\n');
}

// ================================================================
// STEP 1c — Extract text from PDF using pdf.js (CDN)
// ================================================================
async function extractTextFromPDF(file) {
  // Lazy-load pdf.js from CDN
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Script load failed: ' + src));
    document.head.appendChild(s);
  });
}

// ================================================================
// STEP 2 — Parse raw OCR/PDF text → structured items via Gemini
// Uses text-only input (OCR already extracted the text)
// ================================================================
async function parseReceiptTextWithClaude(rawText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `You are a grocery receipt parser. Below is raw OCR text extracted from a grocery receipt. Extract all food/grocery items purchased.

Return ONLY a raw JSON array — no markdown fences, no explanation, no preamble. Each element:
{"name":"clean readable item name","qty":<number>,"unit":"<unit or empty string>"}

Rules:
- SKIP taxes, totals, subtotals, fees, store name, phone, dates, cashier info
- Fix ALL-CAPS abbreviations (e.g. "TROP PURE PREM OJ FL" → "Orange Juice")
- If quantity is shown (e.g. "2 @ $1.99"), set qty accordingly
- Default qty = 1 if unclear
- unit examples: box, can, lb, oz, bag, bottle, gallon, pack, carton — empty string for plain counts
- Return ONLY the JSON array, nothing else

Raw receipt text:
${rawText.slice(0, 4000)}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    })
  });

  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Gemini API error ${resp.status}`);
  }

  const data  = await resp.json();
  const text  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json|```/gi, '').trim();
  const match = clean.match(/\[[\s\S]*\]/);
  const jsonStr = match ? match[0] : clean;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    return parsed.filter(i => i.name && String(i.name).trim().length > 0);
  } catch {
    console.error('Gemini raw response:', text);
    throw new Error('AI parsing failed — try a clearer photo');
  }
}

// ================================================================
// [MATCHING] — Smart category matching
// Modify this function to change how scanned items map to categories
// ================================================================
function matchItemsToPantry(rawItems) {
  const existingCategories = [...new Set(pantry.map(p => p.category))];

  return rawItems.map(item => {
    const nameLower = item.name.toLowerCase().trim();

    // 1. Exact name match in pantry → use that item's category
    const exactName = pantry.find(p => p.name.toLowerCase() === nameLower);
    if (exactName) {
      return { ...item, suggestedCategory: exactName.category, matchType: 'existing-item' };
    }

    // 2. Item name contains an existing category (longest match wins)
    //    e.g. "ice cream sandwich" contains "ice cream" → Ice Cream category
    let bestCat = null, bestLen = 0;
    for (const cat of existingCategories) {
      const cl = cat.toLowerCase();
      if (nameLower.includes(cl) && cl.length > bestLen) {
        bestCat = cat;
        bestLen = cl.length;
      }
    }
    if (bestCat) return { ...item, suggestedCategory: bestCat, matchType: 'category-match' };

    // 3. Existing category name is a significant sub-word of the new item
    //    e.g. "yogurt strawberry" matches category "Yogurt"
    for (const cat of existingCategories) {
      const words = cat.toLowerCase().split(/\s+/);
      if (words.some(w => w.length >= 4 && nameLower.includes(w))) {
        return { ...item, suggestedCategory: cat, matchType: 'word-match' };
      }
    }

    // 4. No match → new category = title-cased item name
    const titleName = item.name.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return { ...item, suggestedCategory: titleName, matchType: 'new' };
  });
}

// ================================================================
// REVIEW PANEL
// ================================================================
window.addReviewRow = () => {
  reviewItems.push({ name: '', qty: 1, unit: '', suggestedCategory: '', matchType: 'new' });
  renderReview();
  // Focus last name input
  setTimeout(() => {
    const rows = document.querySelectorAll('#review-tbody tr');
    if (rows.length) rows[rows.length - 1].querySelector('input')?.focus();
  }, 50);
};

window.removeReviewItem = (i) => {
  reviewItems.splice(i, 1);
  if (reviewItems.length === 0) clearReview();
  else renderReview();
};

window.clearReview = () => {
  reviewItems = [];
  document.getElementById('receipt-review').style.display = 'none';
  document.getElementById('review-tbody').innerHTML = '';
};

function renderReview() {
  const tbody  = document.getElementById('review-tbody');
  const panel  = document.getElementById('receipt-review');
  panel.style.display = 'block';

  tbody.innerHTML = reviewItems.map((item, i) => `
    <tr>
      <td><input type="text"   id="ri-name-${i}" value="${esc(item.name)}"              placeholder="Item name"  list="category-names-list"></td>
      <td><input type="text"   id="ri-cat-${i}"  value="${esc(item.suggestedCategory)}" placeholder="Category"   list="category-datalist"></td>
      <td><input type="number" id="ri-qty-${i}"  value="${item.qty}"   min="0" step="0.5" style="width:65px"></td>
      <td><input type="text"   id="ri-unit-${i}" value="${esc(item.unit || '')}"         placeholder="qty" style="width:70px"></td>
      <td><span class="match-badge ${item.matchType === 'new' ? 'match-new' : 'match-existing'}">${item.matchType === 'new' ? '+ New' : '↩ Match'}</span></td>
      <td><button class="row-delete-btn" onclick="removeReviewItem(${i})" title="Remove">✕</button></td>
    </tr>
  `).join('');
}

window.addReviewedItemsToPantry = async () => {
  const rows = document.querySelectorAll('#review-tbody tr');
  const toAdd = [];

  rows.forEach((_, i) => {
    const name     = document.getElementById(`ri-name-${i}`)?.value?.trim();
    const category = document.getElementById(`ri-cat-${i}`)?.value?.trim()  || name;
    const qty      = parseFloat(document.getElementById(`ri-qty-${i}`)?.value)  || 1;
    const unit     = document.getElementById(`ri-unit-${i}`)?.value?.trim() || '';
    if (!name) return;
    toAdd.push({ name, category, qty, unit });
  });

  showProcessing(true, 'Adding items to pantry…');

  for (const item of toAdd) {
    const existing = pantry.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    if (existing) {
      await fsUpdateItem(existing.id, { qty: (existing.qty || 0) + item.qty });
    } else {
      await fsAddItem({
        name:      item.name,
        category:  item.category,
        qty:       item.qty,
        unit:      item.unit,
        threshold: DEFAULT_LOW_THRESHOLD
      });
    }
  }

  showProcessing(false);
  clearReview();
  clearPreview();
  showStatus('success', `✓ ${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} added to pantry`);
  toast(`${toAdd.length} items added to pantry`);
};

// ================================================================
// INVENTORY RENDERING
// ================================================================
function renderInventory() {
  const search = (document.getElementById('inventory-search')?.value || '').toLowerCase();
  const grid   = document.getElementById('inventory-grid');
  if (!grid) return;

  if (pantry.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🥫</div>
      <h3>Your pantry is empty</h3>
      <p>Scan a receipt or add items manually to get started</p>
    </div>`;
    updateSubtitle();
    return;
  }

  const filtered = search
    ? pantry.filter(p => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search))
    : pantry;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No results</h3><p>Try a different search</p></div>`;
    return;
  }

  // Group by category
  const groups = {};
  filtered.forEach(item => {
    const cat = item.category || 'Uncategorised';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  grid.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, items]) => `
      <div class="category-section" id="cat-${slugify(cat)}">
        <div class="category-header" onclick="toggleCategory('${slugify(cat)}')">
          <span class="category-name">${esc(cat)}</span>
          <span class="category-count">${items.length}</span>
          <span class="category-chevron">▾</span>
        </div>
        <div class="items-grid">
          ${items.map(renderItemCard).join('')}
        </div>
      </div>
    `).join('');

  updateSubtitle();
}

function renderItemCard(item) {
  const qty       = item.qty ?? 0;
  const threshold = item.threshold ?? DEFAULT_LOW_THRESHOLD;
  const status    = qty <= 0 ? 'out' : qty <= threshold ? 'low' : 'good';

  return `<div class="item-card" data-status="${status}" id="icard-${item.id}">
    <div class="item-name">${esc(item.name)}</div>
    <div class="item-qty-row">
      <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
      <span class="qty-display">${formatQty(qty)}</span>
      <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
      ${item.unit ? `<span class="qty-unit">${esc(item.unit)}</span>` : ''}
    </div>
    <div class="item-threshold-row">
      <span class="threshold-label">Low alert at</span>
      <input class="threshold-input" type="number" value="${threshold}" min="0" step="0.5"
        onchange="setThreshold('${item.id}', this.value)" title="Low threshold">
    </div>
    <button class="item-delete-btn" onclick="deleteItem('${item.id}')" title="Delete">✕</button>
  </div>`;
}

window.toggleCategory = (slug) => {
  document.getElementById('cat-' + slug)?.classList.toggle('collapsed');
};

window.changeQty = async (id, delta) => {
  const item = pantry.find(p => p.id === id);
  if (!item) return;
  const newQty = Math.max(0, (item.qty ?? 0) + delta);
  // Optimistic local update
  item.qty = newQty;
  const card = document.getElementById('icard-' + id);
  if (card) {
    const threshold = item.threshold ?? DEFAULT_LOW_THRESHOLD;
    const status    = newQty <= 0 ? 'out' : newQty <= threshold ? 'low' : 'good';
    card.dataset.status = status;
    card.querySelector('.qty-display').textContent = formatQty(newQty);
  }
  await fsUpdateItem(id, { qty: newQty });
};

window.setThreshold = async (id, val) => {
  const item = pantry.find(p => p.id === id);
  if (!item) return;
  const threshold = Math.max(0, parseFloat(val) || 0);
  item.threshold  = threshold;
  await fsUpdateItem(id, { threshold });
  renderInventory();
};

window.deleteItem = async (id) => {
  await fsDeleteItem(id);
  toast('Item removed');
};

// ================================================================
// MANUAL ADD
// ================================================================
window.toggleAddForm = () => {
  document.getElementById('add-item-form').classList.toggle('open');
};

window.addManualItem = async () => {
  const name      = document.getElementById('new-item-name').value.trim();
  const category  = document.getElementById('new-item-category').value.trim() || name;
  const qty       = parseFloat(document.getElementById('new-item-qty').value)       || 0;
  const unit      = document.getElementById('new-item-unit').value.trim();
  const threshold = parseFloat(document.getElementById('new-item-threshold').value) || DEFAULT_LOW_THRESHOLD;

  if (!name) { toast('Please enter an item name'); return; }

  const existing = pantry.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    await fsUpdateItem(existing.id, { qty: (existing.qty || 0) + qty });
    toast(`Updated ${name}`);
  } else {
    await fsAddItem({ name, category, qty, unit, threshold });
    toast(`Added ${name}`);
  }

  // Reset form
  ['new-item-name','new-item-category','new-item-unit'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('new-item-qty').value       = '1';
  document.getElementById('new-item-threshold').value = '1';
  document.getElementById('add-item-form').classList.remove('open');
};

// ================================================================
// SHOPPING MODE
// ================================================================
function renderShopping() {
  const container = document.getElementById('shopping-list-content');
  if (!container) return;

  const outItems = pantry.filter(p => (p.qty ?? 0) <= 0);
  const lowItems = pantry.filter(p => {
    const qty = p.qty ?? 0;
    const thr = p.threshold ?? DEFAULT_LOW_THRESHOLD;
    return qty > 0 && qty <= thr;
  });

  if (outItems.length === 0 && lowItems.length === 0) {
    container.innerHTML = `<div class="shop-empty">
      <div class="shop-empty-icon">🎉</div>
      <h3>All stocked up!</h3>
      <p>No items are low or out of stock right now</p>
    </div>`;
    return;
  }

  let html = '';

  if (outItems.length > 0) {
    html += `<div class="shop-section">
      <div class="shop-section-heading">
        <span class="shop-section-label urgent">Out of Stock</span>
        <span class="shop-section-count">${outItems.length}</span>
      </div>
      ${outItems.sort((a,b) => a.name.localeCompare(b.name)).map(i => shopItemHTML(i, 'out')).join('')}
    </div>`;
  }

  if (lowItems.length > 0) {
    const sorted = [...lowItems].sort((a, b) => {
      const ra = (a.qty ?? 0) / (a.threshold || 1);
      const rb = (b.qty ?? 0) / (b.threshold || 1);
      return ra - rb;
    });
    html += `<div class="shop-section">
      <div class="shop-section-heading">
        <span class="shop-section-label warn">Running Low</span>
        <span class="shop-section-count">${sorted.length}</span>
      </div>
      ${sorted.map(i => shopItemHTML(i, 'low')).join('')}
    </div>`;
  }

  container.innerHTML = html;
}

function shopItemHTML(item, urgency) {
  const checked = checkedShopIds.has(item.id);
  const qty     = item.qty ?? 0;
  const detail  = urgency === 'out'
    ? `Out of stock · ${esc(item.category)}`
    : `${formatQty(qty)}${item.unit ? ' ' + esc(item.unit) : ''} remaining · low at ${item.threshold ?? DEFAULT_LOW_THRESHOLD}`;

  return `<div class="shop-item ${checked ? 'is-checked' : ''}" id="shoprow-${item.id}">
    <div class="shop-checkbox ${checked ? 'is-checked' : ''}" id="shopchk-${item.id}"
         onclick="toggleShopCheck('${item.id}')">${checked ? '✓' : ''}</div>
    <div class="shop-item-info">
      <div class="shop-item-name">${esc(item.name)}</div>
      <div class="shop-item-detail">${detail}</div>
    </div>
    <span class="urgency-pill ${urgency === 'out' ? 'urgency-out' : 'urgency-low'}">
      ${urgency === 'out' ? 'Out' : 'Low'}
    </span>
  </div>`;
}

window.toggleShopCheck = (id) => {
  const was = checkedShopIds.has(id);
  was ? checkedShopIds.delete(id) : checkedShopIds.add(id);
  const row = document.getElementById('shoprow-' + id);
  const chk = document.getElementById('shopchk-' + id);
  if (row) row.classList.toggle('is-checked', !was);
  if (chk) { chk.classList.toggle('is-checked', !was); chk.textContent = !was ? '✓' : ''; }
};

window.clearCheckedShopItems = () => {
  checkedShopIds.clear();
  renderShopping();
};

// ================================================================
// HELPERS
// ================================================================
function updateCategoryDatalist() {
  const cats  = [...new Set(pantry.map(p => p.category))].sort();
  const names = [...new Set(pantry.map(p => p.name))].sort();
  const dl    = document.getElementById('category-datalist');
  const nl    = document.getElementById('category-names-list');
  if (dl) dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  if (nl) nl.innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

function updateSubtitle() {
  const el = document.getElementById('inv-subtitle');
  if (!el) return;
  const total = pantry.length;
  const low   = pantry.filter(p => { const q = p.qty ?? 0; return q > 0 && q <= (p.threshold ?? DEFAULT_LOW_THRESHOLD); }).length;
  const out   = pantry.filter(p => (p.qty ?? 0) <= 0).length;
  el.textContent = `${total} item${total !== 1 ? 's' : ''}${out > 0 ? ` · ${out} out` : ''}${low > 0 ? ` · ${low} low` : ''}`;
}

function setSyncIndicator(msg) {
  const el = document.getElementById('sync-indicator');
  if (el) el.textContent = msg === 'Synced' ? '✓ Cloud synced' : msg;
}

window.showStatus = (type, msg) => {
  const bar = document.getElementById('scan-status');
  if (!bar) return;
  bar.className = 'status-bar ' + type;
  bar.textContent = msg;
  bar.style.display = 'block';
  if (type === 'success') setTimeout(() => { bar.style.display = 'none'; }, 5000);
};

function showProcessing(show, msg) {
  document.getElementById('processing-overlay').classList.toggle('show', show);
  if (msg) document.getElementById('processing-msg').textContent = msg;
}
function showProcessingMsg(msg) {
  const el = document.getElementById('processing-msg');
  if (el) el.textContent = msg;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function formatQty(n) {
  n = n ?? 0;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// Enter key shortcut for auth forms
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('auth-login').classList.contains('active'))    handleLogin();
  if (document.getElementById('auth-register').classList.contains('active')) handleRegister();
});
