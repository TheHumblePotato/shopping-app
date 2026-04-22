// ================================================================
// PANTRY APP — app.js
// All event wiring uses addEventListener, no inline onclick handlers.
// ================================================================

import { initializeApp }                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signInWithPopup,
         GoogleAuthProvider, signOut, updateProfile }
                                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc,
         deleteDoc, onSnapshot, serverTimestamp }
                                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ================================================================
// [CONFIG] — swap keys / models here
// ================================================================
const firebaseConfig = {
  apiKey:            "AIzaSyBs4yuMJEOhVOZw8E_Ghnn7Y_jtsYxei38",
  authDomain:        "shop-list-web-app.firebaseapp.com",
  projectId:         "shop-list-web-app",
  storageBucket:     "shop-list-web-app.firebasestorage.app",
  messagingSenderId: "323355056685",
  appId:             "1:323355056685:web:41661b5d6b8da54fe4f6a4"
};

// OCR: Tesseract.js (runs in-browser, zero keys, no quota)
// PDF: pdf.js (in-browser, no key)
// AI parsing: Gemini called directly from browser
// NOTE: Set a quota cap on this key in Google AI Studio (aistudio.google.com)
// and restrict it to your domain — that limits abuse even if the key is seen.
const GEMINI_API_KEY = 'AIzaSyBXg8ZoQObwPshU1f3NFRu3JFQkuefTaU8';
const GEMINI_MODEL   = 'gemini-2.5-flash-lite';

// [THRESHOLDS] — default "low stock" threshold for new items
const DEFAULT_LOW_THRESHOLD = 1;

// ================================================================
// FIREBASE INIT
// ================================================================
const fbApp          = initializeApp(firebaseConfig);
const auth           = getAuth(fbApp);
const db             = getFirestore(fbApp);
const googleProvider = new GoogleAuthProvider();

// ================================================================
// APP STATE
// ================================================================
let currentUser    = null;
let pantry         = [];
let unsubPantry    = null;
let reviewItems    = [];
let checkedShopIds = new Set();
let cameraStream   = null;

// ================================================================
// BOOT — wire all events once DOM is ready
// ================================================================
document.addEventListener('DOMContentLoaded', initEventListeners);

function initEventListeners() {
  // ---- Auth ----
  on('btn-login',          'click', handleLogin);
  on('btn-google-login',   'click', handleGoogleLogin);
  on('btn-register',       'click', handleRegister);
  on('btn-signout',        'click', handleSignOut);
  on('link-to-register',   'click', (e) => { e.preventDefault(); switchAuth('register'); });
  on('link-to-login',      'click', (e) => { e.preventDefault(); switchAuth('login'); });
  on('login-password',     'keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  on('reg-password',       'keydown', (e) => { if (e.key === 'Enter') handleRegister(); });

  // ---- Nav tabs ----
  on('tab-btn-scan',       'click', () => showTab('scan'));
  on('tab-btn-inventory',  'click', () => showTab('inventory'));
  on('tab-btn-shopping',   'click', () => showTab('shopping'));

  // ---- User menu ----
  on('user-chip',          'click', (e) => { e.stopPropagation(); toggleUserMenu(); });
  document.addEventListener('click', () => hide('user-menu'));

  // ---- Scan tab ----
  on('btn-upload-file',    'click', () => document.getElementById('receipt-file').click());
  on('btn-open-camera',    'click', openCamera);
  on('receipt-file',       'change', (e) => { const f = e.target.files[0]; if (f) processReceiptFile(f); e.target.value = ''; });
  on('camera-file',        'change', (e) => { const f = e.target.files[0]; if (f) processReceiptFile(f); e.target.value = ''; });
  on('btn-clear-preview',  'click', clearPreview);
  on('btn-capture',        'click', captureFromCamera);
  on('btn-cancel-camera',  'click', closeCameraView);

  const scanZone = document.getElementById('scan-zone');
  scanZone.addEventListener('dragover',  (e) => { e.preventDefault(); scanZone.classList.add('drag-over'); });
  scanZone.addEventListener('dragleave', ()  => scanZone.classList.remove('drag-over'));
  scanZone.addEventListener('drop',      (e) => {
    e.preventDefault(); scanZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) processReceiptFile(f);
  });

  // ---- Review panel ----
  on('btn-add-review-row', 'click', addReviewRow);
  on('btn-add-to-pantry',  'click', addReviewedItemsToPantry);
  on('btn-cancel-review',  'click', clearReview);

  // Event delegation for dynamic review delete buttons
  document.getElementById('review-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.row-delete-btn');
    if (btn) removeReviewItem(parseInt(btn.dataset.idx, 10));
  });

  // ---- Inventory tab ----
  on('btn-toggle-add-form',  'click', toggleAddForm);
  on('btn-add-manual-item',  'click', addManualItem);
  on('btn-cancel-add-form',  'click', toggleAddForm);
  on('inventory-search',     'input', renderInventory);

  // Event delegation for dynamic inventory grid (qty buttons, delete, threshold, category toggle)
  document.getElementById('inventory-grid').addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn) { changeQty(qtyBtn.dataset.id, parseInt(qtyBtn.dataset.delta, 10)); return; }

    const delBtn = e.target.closest('.item-delete-btn');
    if (delBtn) { deleteItem(delBtn.dataset.id); return; }

    const catHeader = e.target.closest('.category-header');
    if (catHeader) { toggleCategory(catHeader.dataset.slug); return; }
  });
  document.getElementById('inventory-grid').addEventListener('change', (e) => {
    if (e.target.classList.contains('threshold-input')) {
      setThreshold(e.target.dataset.id, e.target.value);
    }
  });

  // ---- Shopping tab ----
  on('btn-clear-checked', 'click', () => { checkedShopIds.clear(); renderShopping(); });

  // Event delegation for shop checkboxes
  document.getElementById('shopping-list-content').addEventListener('click', (e) => {
    const chk = e.target.closest('.shop-checkbox');
    if (chk) toggleShopCheck(chk.dataset.id);
  });
}

// ================================================================
// AUTH
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

async function handleLogin() {
  const email    = val('login-email');
  const password = val('login-password');
  const errEl    = document.getElementById('auth-error');
  errEl.style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
}

async function handleRegister() {
  const name     = val('reg-name');
  const email    = val('reg-email');
  const password = val('reg-password');
  const errEl    = document.getElementById('reg-error');
  errEl.style.display = 'none';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
  } catch (e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
}

async function handleGoogleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const errEl = document.getElementById('auth-error');
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
}

async function handleSignOut() {
  await signOut(auth);
  hide('user-menu');
}

function switchAuth(mode) {
  document.getElementById('auth-login').classList.toggle('active',    mode === 'login');
  document.getElementById('auth-register').classList.toggle('active', mode === 'register');
}

function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email':        'Invalid email address.',
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'That email is already registered.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/invalid-credential':   'Incorrect email or password.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
  };
  return map[code] || 'Authentication error. Please try again.';
}

function showApp(user) {
  hide('auth-screen');
  document.getElementById('app').style.display = 'block';
  const initials = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  document.getElementById('user-avatar').textContent     = initials;
  document.getElementById('user-name-nav').textContent   = user.displayName || user.email.split('@')[0];
  document.getElementById('user-menu-email').textContent = user.email;
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  hide('app');
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// ================================================================
// FIRESTORE
// ================================================================
function pantryCol(uid) { return collection(db, 'users', uid, 'pantry'); }

function subscribeToUserPantry(uid) {
  if (unsubPantry) unsubPantry();
  unsubPantry = onSnapshot(pantryCol(uid), (snap) => {
    pantry = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderInventory();
    renderShopping();
    updateCategoryDatalist();
    updateSubtitle();
    setSyncIndicator('Synced');
  }, (err) => { console.error(err); setSyncIndicator('Sync error'); });
}

async function fsAdd(item) {
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try {
    return await addDoc(pantryCol(currentUser.uid), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (e) { console.error(e); toast('Error saving item'); }
}

async function fsUpdate(id, updates) {
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'pantry', id), { ...updates, updatedAt: serverTimestamp() });
  } catch (e) { console.error(e); toast('Error updating item'); }
}

async function fsDel(id) {
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'pantry', id));
  } catch (e) { console.error(e); toast('Error deleting item'); }
}

// ================================================================
// TAB NAVIGATION
// ================================================================
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-btn-' + tab).classList.add('active');
  if (tab === 'inventory') renderInventory();
  if (tab === 'shopping')  renderShopping();
}

// ================================================================
// CAMERA
// ================================================================
function openCamera() {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) { document.getElementById('camera-file').click(); return; }
  const video = document.getElementById('camera-video');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      cameraStream = stream;
      video.srcObject = stream;
      document.getElementById('camera-view').style.display = 'block';
    })
    .catch(() => {
      toast('Camera unavailable — opening file picker');
      document.getElementById('camera-file').click();
    });
}

function closeCameraView() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  hide('camera-view');
}

function captureFromCamera() {
  const video  = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  closeCameraView();
  canvas.toBlob(blob => processReceiptFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.92);
}

// ================================================================
// RECEIPT PROCESSING
// ================================================================
async function processReceiptFile(file) {
  const isPDF = file.type === 'application/pdf';

  // Preview
  const previewImg = document.getElementById('scan-preview-img');
  if (isPDF) {
    previewImg.src = 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="130" viewBox="0 0 240 130">
        <rect width="240" height="130" rx="8" fill="#1A1814"/>
        <text x="120" y="58" font-family="sans-serif" font-size="32" fill="#C8954A" text-anchor="middle">📄</text>
        <text x="120" y="86" font-family="sans-serif" font-size="13" fill="#9A8F82" text-anchor="middle">${esc(file.name)}</text>
      </svg>`);
  } else {
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; };
    reader.readAsDataURL(file);
  }
  document.getElementById('scan-preview-wrap').style.display = 'block';

  showStatus('info', isPDF ? '📄 Reading PDF…' : '🔍 Reading image…');
  showProcessing(true, 'Preparing…');

  try {
    let rawText = '';
    if (isPDF) {
      showProcessingMsg('Extracting PDF text…');
      rawText = await extractTextFromPDF(file);
      if (!rawText.trim()) throw new Error('No readable text in PDF — is it a scanned image?');
    } else {
      showProcessingMsg('Loading OCR engine… (first run ~10s)');
      rawText = await ocrWithTesseract(file, msg => showProcessingMsg(msg));
      if (!rawText.trim()) throw new Error('OCR found no text — try a clearer, well-lit photo');
    }

    showProcessingMsg('Parsing items with AI…');
    const items = await parseReceiptTextWithGemini(rawText);

    showProcessing(false);
    if (!items.length) { showStatus('error', '✕ No grocery items found — try a clearer photo'); return; }
    showStatus('success', `✓ Found ${items.length} item${items.length !== 1 ? 's' : ''}`);
    reviewItems = matchItemsToPantry(items);
    renderReview();
  } catch (err) {
    showProcessing(false);
    showStatus('error', '✕ ' + (err.message || 'Failed to process receipt'));
    console.error(err);
  }
}

function clearPreview() {
  hide('scan-preview-wrap');
  document.getElementById('scan-preview-img').src = '';
}

// ================================================================
// OCR — Tesseract.js (fully in-browser, no API key)
// ================================================================
async function ocrWithTesseract(imageFile, onProgress) {
  if (!window.Tesseract) {
    onProgress('Loading OCR engine…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js');
  }
  const blob = await resizeForOCR(imageFile);
  const url  = URL.createObjectURL(blob);
  try {
    const result = await Tesseract.recognize(url, 'eng', {
      logger: m => {
        if      (m.status === 'recognizing text')             onProgress(`OCR ${Math.round((m.progress||0)*100)}%…`);
        else if (m.status === 'loading tesseract core')       onProgress('Loading OCR engine…');
        else if (m.status === 'initializing tesseract')       onProgress('Initializing OCR…');
        else if (m.status === 'loading language traineddata') onProgress('Loading language data…');
      }
    });
    return result.data.text || '';
  } finally { URL.revokeObjectURL(url); }
}

function resizeForOCR(file) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      const MAX = 2000;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => resolve(b || file), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ================================================================
// PDF TEXT EXTRACTION — pdf.js (in-browser, no key)
// ================================================================
async function extractTextFromPDF(file) {
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    text += content.items.map(x => x.str).join(' ') + '\n';
  }
  return text;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}

// ================================================================
// ================================================================
// ================================================================
// AI PARSING — Gemini REST API (text-only, minimal tokens per call)
// ================================================================
async function parseReceiptTextWithGemini(rawText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `Parse this grocery receipt OCR text. Return ONLY a raw JSON array, no markdown, no explanation.
Each element: {"name":"clean readable name","qty":<number>,"unit":"<unit or empty string>"}
Rules:
- Skip taxes, totals, fees, store name, phone, dates, cashier lines
- Fix ALL-CAPS abbreviations (e.g. "TROP PURE PREM OJ FL" to "Orange Juice")
- If quantity shown (e.g. "2 @ $1.99") set qty = 2. Default qty = 1 if unclear.
- unit examples: box, can, lb, oz, bag, bottle, gallon, pack, carton — or empty string
- Return ONLY the JSON array, nothing else

Receipt text:
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
    throw new Error(e?.error?.message || `Gemini error ${resp.status}`);
  }

  const data  = await resp.json();
  const text  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json|```/gi, '').trim();
  const match = clean.match(/\[\s\S]*\]/);
  try {
    const parsed = JSON.parse(match ? match[0] : clean);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed.filter(i => i.name?.trim());
  } catch {
    console.error('Gemini raw response:', text);
    throw new Error('AI returned unexpected format — try a clearer photo');
  }
}

// [MATCHING] — Category matching logic
// ================================================================
function matchItemsToPantry(rawItems) {
  const cats = [...new Set(pantry.map(p => p.category))];
  return rawItems.map(item => {
    const nl = item.name.toLowerCase().trim();
    const exact = pantry.find(p => p.name.toLowerCase() === nl);
    if (exact) return { ...item, suggestedCategory: exact.category, matchType: 'existing-item' };

    let bestCat = null, bestLen = 0;
    for (const cat of cats) {
      const cl = cat.toLowerCase();
      if (nl.includes(cl) && cl.length > bestLen) { bestCat = cat; bestLen = cl.length; }
    }
    if (bestCat) return { ...item, suggestedCategory: bestCat, matchType: 'category-match' };

    for (const cat of cats) {
      if (cat.toLowerCase().split(/\s+/).some(w => w.length >= 4 && nl.includes(w)))
        return { ...item, suggestedCategory: cat, matchType: 'word-match' };
    }

    const title = item.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return { ...item, suggestedCategory: title, matchType: 'new' };
  });
}

// ================================================================
// REVIEW PANEL
// ================================================================
function addReviewRow() {
  reviewItems.push({ name: '', qty: 1, unit: '', suggestedCategory: '', matchType: 'new' });
  renderReview();
  setTimeout(() => {
    const rows = document.querySelectorAll('#review-tbody tr');
    if (rows.length) rows[rows.length - 1].querySelector('input')?.focus();
  }, 50);
}

function removeReviewItem(i) {
  reviewItems.splice(i, 1);
  if (!reviewItems.length) clearReview(); else renderReview();
}

function clearReview() {
  reviewItems = [];
  hide('receipt-review');
  document.getElementById('review-tbody').innerHTML = '';
}

function renderReview() {
  document.getElementById('receipt-review').style.display = 'block';
  document.getElementById('review-tbody').innerHTML = reviewItems.map((item, i) => `
    <tr>
      <td><input type="text"   id="ri-name-${i}" value="${esc(item.name)}"              placeholder="Item name"  list="category-names-list"></td>
      <td><input type="text"   id="ri-cat-${i}"  value="${esc(item.suggestedCategory)}" placeholder="Category"   list="category-datalist"></td>
      <td><input type="number" id="ri-qty-${i}"  value="${item.qty}"   min="0" step="0.5" style="width:65px"></td>
      <td><input type="text"   id="ri-unit-${i}" value="${esc(item.unit||'')}"           placeholder="qty"        style="width:70px"></td>
      <td><span class="match-badge ${item.matchType === 'new' ? 'match-new' : 'match-existing'}">${item.matchType === 'new' ? '+ New' : '↩ Match'}</span></td>
      <td><button class="row-delete-btn" data-idx="${i}" title="Remove">✕</button></td>
    </tr>`).join('');
}

async function addReviewedItemsToPantry() {
  const toAdd = [];
  reviewItems.forEach((_, i) => {
    const name     = document.getElementById(`ri-name-${i}`)?.value?.trim();
    const category = document.getElementById(`ri-cat-${i}`)?.value?.trim() || name;
    const qty      = parseFloat(document.getElementById(`ri-qty-${i}`)?.value) || 1;
    const unit     = document.getElementById(`ri-unit-${i}`)?.value?.trim() || '';
    if (name) toAdd.push({ name, category, qty, unit });
  });

  showProcessing(true, 'Adding to pantry…');
  for (const item of toAdd) {
    const existing = pantry.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    if (existing) await fsUpdate(existing.id, { qty: (existing.qty || 0) + item.qty });
    else          await fsAdd({ name: item.name, category: item.category, qty: item.qty, unit: item.unit, threshold: DEFAULT_LOW_THRESHOLD });
  }
  showProcessing(false);
  clearReview();
  clearPreview();
  showStatus('success', `✓ ${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} added to pantry`);
  toast(`${toAdd.length} items added`);
}

// ================================================================
// INVENTORY
// ================================================================
function renderInventory() {
  const search = (document.getElementById('inventory-search')?.value || '').toLowerCase();
  const grid   = document.getElementById('inventory-grid');
  if (!grid) return;

  if (!pantry.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🥫</div><h3>Your pantry is empty</h3><p>Scan a receipt or add items manually</p></div>`;
    updateSubtitle(); return;
  }

  const filtered = search ? pantry.filter(p =>
    p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search)) : pantry;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No results</h3><p>Try a different search</p></div>`;
    return;
  }

  const groups = {};
  filtered.forEach(item => { (groups[item.category || 'Uncategorised'] ??= []).push(item); });

  grid.innerHTML = Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([cat, items]) => `
    <div class="category-section" id="cat-${slugify(cat)}">
      <div class="category-header" data-slug="${slugify(cat)}">
        <span class="category-name">${esc(cat)}</span>
        <span class="category-count">${items.length}</span>
        <span class="category-chevron">▾</span>
      </div>
      <div class="items-grid">${items.map(renderItemCard).join('')}</div>
    </div>`).join('');

  updateSubtitle();
}

function renderItemCard(item) {
  const qty = item.qty ?? 0, thr = item.threshold ?? DEFAULT_LOW_THRESHOLD;
  const status = qty <= 0 ? 'out' : qty <= thr ? 'low' : 'good';
  return `<div class="item-card" data-status="${status}" id="icard-${item.id}">
    <div class="item-name">${esc(item.name)}</div>
    <div class="item-qty-row">
      <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
      <span class="qty-display">${formatQty(qty)}</span>
      <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
      ${item.unit ? `<span class="qty-unit">${esc(item.unit)}</span>` : ''}
    </div>
    <div class="item-threshold-row">
      <span class="threshold-label">Low alert at</span>
      <input class="threshold-input" type="number" value="${thr}" min="0" step="0.5" data-id="${item.id}" title="Low threshold">
    </div>
    <button class="item-delete-btn" data-id="${item.id}" title="Delete">✕</button>
  </div>`;
}

function toggleCategory(slug) {
  document.getElementById('cat-' + slug)?.classList.toggle('collapsed');
}

async function changeQty(id, delta) {
  const item = pantry.find(p => p.id === id);
  if (!item) return;
  const newQty = Math.max(0, (item.qty ?? 0) + delta);
  item.qty = newQty;
  const card = document.getElementById('icard-' + id);
  if (card) {
    const thr = item.threshold ?? DEFAULT_LOW_THRESHOLD;
    card.dataset.status = newQty <= 0 ? 'out' : newQty <= thr ? 'low' : 'good';
    card.querySelector('.qty-display').textContent = formatQty(newQty);
  }
  await fsUpdate(id, { qty: newQty });
}

async function setThreshold(id, val) {
  const item = pantry.find(p => p.id === id);
  if (!item) return;
  item.threshold = Math.max(0, parseFloat(val) || 0);
  await fsUpdate(id, { threshold: item.threshold });
  renderInventory();
}

async function deleteItem(id) {
  await fsDel(id);
  toast('Item removed');
}

function toggleAddForm() {
  document.getElementById('add-item-form').classList.toggle('open');
}

async function addManualItem() {
  const name      = val('new-item-name');
  const category  = val('new-item-category') || name;
  const qty       = parseFloat(document.getElementById('new-item-qty').value) || 0;
  const unit      = val('new-item-unit');
  const threshold = parseFloat(document.getElementById('new-item-threshold').value) || DEFAULT_LOW_THRESHOLD;

  if (!name) { toast('Please enter an item name'); return; }

  const existing = pantry.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) { await fsUpdate(existing.id, { qty: (existing.qty || 0) + qty }); toast(`Updated ${name}`); }
  else          { await fsAdd({ name, category, qty, unit, threshold }); toast(`Added ${name}`); }

  ['new-item-name','new-item-category','new-item-unit'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('new-item-qty').value       = '1';
  document.getElementById('new-item-threshold').value = '1';
  document.getElementById('add-item-form').classList.remove('open');
}

// ================================================================
// SHOPPING
// ================================================================
function renderShopping() {
  const container = document.getElementById('shopping-list-content');
  if (!container) return;
  const outItems = pantry.filter(p => (p.qty ?? 0) <= 0);
  const lowItems = pantry.filter(p => { const q = p.qty??0, t = p.threshold??DEFAULT_LOW_THRESHOLD; return q>0 && q<=t; });

  if (!outItems.length && !lowItems.length) {
    container.innerHTML = `<div class="shop-empty"><div class="shop-empty-icon">🎉</div><h3>All stocked up!</h3><p>No items are low or out of stock</p></div>`;
    return;
  }

  let html = '';
  if (outItems.length) {
    html += `<div class="shop-section"><div class="shop-section-heading"><span class="shop-section-label urgent">Out of Stock</span><span class="shop-section-count">${outItems.length}</span></div>
    ${outItems.sort((a,b)=>a.name.localeCompare(b.name)).map(i=>shopItemHTML(i,'out')).join('')}</div>`;
  }
  if (lowItems.length) {
    const sorted = [...lowItems].sort((a,b) => (a.qty??0)/(a.threshold||1) - (b.qty??0)/(b.threshold||1));
    html += `<div class="shop-section"><div class="shop-section-heading"><span class="shop-section-label warn">Running Low</span><span class="shop-section-count">${sorted.length}</span></div>
    ${sorted.map(i=>shopItemHTML(i,'low')).join('')}</div>`;
  }
  container.innerHTML = html;
}

function shopItemHTML(item, urgency) {
  const checked = checkedShopIds.has(item.id);
  const qty = item.qty ?? 0;
  const detail = urgency === 'out'
    ? `Out of stock · ${esc(item.category)}`
    : `${formatQty(qty)}${item.unit ? ' '+esc(item.unit) : ''} left · low at ${item.threshold ?? DEFAULT_LOW_THRESHOLD}`;
  return `<div class="shop-item ${checked?'is-checked':''}" id="shoprow-${item.id}">
    <div class="shop-checkbox ${checked?'is-checked':''}" data-id="${item.id}">${checked?'✓':''}</div>
    <div class="shop-item-info"><div class="shop-item-name">${esc(item.name)}</div><div class="shop-item-detail">${detail}</div></div>
    <span class="urgency-pill ${urgency==='out'?'urgency-out':'urgency-low'}">${urgency==='out'?'Out':'Low'}</span>
  </div>`;
}

function toggleShopCheck(id) {
  const was = checkedShopIds.has(id);
  was ? checkedShopIds.delete(id) : checkedShopIds.add(id);
  const row = document.getElementById('shoprow-' + id);
  const chk = row?.querySelector('.shop-checkbox');
  if (row) row.classList.toggle('is-checked', !was);
  if (chk) { chk.classList.toggle('is-checked', !was); chk.textContent = !was ? '✓' : ''; }
}

// ================================================================
// HELPERS
// ================================================================
function updateCategoryDatalist() {
  const cats  = [...new Set(pantry.map(p => p.category))].sort();
  const names = [...new Set(pantry.map(p => p.name))].sort();
  const dl = document.getElementById('category-datalist');
  const nl = document.getElementById('category-names-list');
  if (dl) dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  if (nl) nl.innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

function updateSubtitle() {
  const el = document.getElementById('inv-subtitle');
  if (!el) return;
  const total = pantry.length;
  const out   = pantry.filter(p => (p.qty??0) <= 0).length;
  const low   = pantry.filter(p => { const q=p.qty??0; return q>0 && q<=(p.threshold??DEFAULT_LOW_THRESHOLD); }).length;
  el.textContent = `${total} item${total!==1?'s':''}${out>0?` · ${out} out`:''}${low>0?` · ${low} low`:''}`;
}

function setSyncIndicator(msg) {
  const el = document.getElementById('sync-indicator');
  if (el) el.textContent = msg === 'Synced' ? '✓ Cloud synced' : msg;
}

function showStatus(type, msg) {
  const bar = document.getElementById('scan-status');
  if (!bar) return;
  bar.className = 'status-bar ' + type;
  bar.textContent = msg;
  bar.style.display = 'block';
  if (type === 'success') setTimeout(() => { bar.style.display = 'none'; }, 5000);
}

function showProcessing(show, msg) {
  document.getElementById('processing-overlay').classList.toggle('show', show);
  if (msg) showProcessingMsg(msg);
}
function showProcessingMsg(msg) {
  const el = document.getElementById('processing-msg');
  if (el) el.textContent = msg;
}

let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---- micro-utilities ----
function on(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
  else console.warn(`[pantry] #${id} not found for event "${event}"`);
}
function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }
function formatQty(n) { n = n ?? 0; return n % 1 === 0 ? String(n) : n.toFixed(1); }
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g,'-'); }
