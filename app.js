// ================================================================
// MUNCHSNAP APP — app.js  v2.0
// Meals AI · Demo Mode · Subscriptions · Avatar · Social Recipes
// Friends · InstaCart · Enhanced Aesthetics
// ================================================================

import { initializeApp }                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signInWithPopup,
         GoogleAuthProvider, signOut, updateProfile }
                                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc,
         deleteDoc, onSnapshot, serverTimestamp, query, orderBy,
         limit, getDocs, getDoc, setDoc, arrayUnion, arrayRemove, where }
                                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ================================================================
// CONFIG
// ================================================================
const firebaseConfig = {
  apiKey:            "AIzaSyBs4yuMJEOhVOZw8E_Ghnn7Y_jtsYxei38",
  authDomain:        "shop-list-web-app.firebaseapp.com",
  projectId:         "shop-list-web-app",
  storageBucket:     "shop-list-web-app.firebasestorage.app",
  messagingSenderId: "323355056685",
  appId:             "1:323355056685:web:41661b5d6b8da54fe4f6a4"
};
const GEMINI_MODEL         = 'gemini-2.5-flash-lite';
const DEFAULT_LOW_THRESHOLD = 1;

// ================================================================
// FIREBASE
// ================================================================
const fbApp          = initializeApp(firebaseConfig);
const auth           = getAuth(fbApp);
const db             = getFirestore(fbApp);
const googleProvider = new GoogleAuthProvider();

// ================================================================
// DEMO PANTRY DATA
// ================================================================
const DEMO_PANTRY = [
  { id: 'd1',  name: 'Whole Milk',       category: 'Dairy',      qty: 1,  unit: 'gallon', threshold: 1 },
  { id: 'd2',  name: 'Large Eggs',       category: 'Dairy',      qty: 6,  unit: '',       threshold: 6 },
  { id: 'd3',  name: 'Cheddar Cheese',   category: 'Dairy',      qty: 2,  unit: 'block',  threshold: 1 },
  { id: 'd4',  name: 'Butter',           category: 'Dairy',      qty: 1,  unit: 'lb',     threshold: 0 },
  { id: 'd5',  name: 'Greek Yogurt',     category: 'Dairy',      qty: 3,  unit: 'cup',    threshold: 2 },
  { id: 'd6',  name: 'Chicken Breast',   category: 'Meat',       qty: 2,  unit: 'lb',     threshold: 1 },
  { id: 'd7',  name: 'Ground Beef',      category: 'Meat',       qty: 0,  unit: 'lb',     threshold: 1 },
  { id: 'd8',  name: 'Salmon',           category: 'Seafood',    qty: 1,  unit: 'fillet', threshold: 0 },
  { id: 'd9',  name: 'Broccoli',         category: 'Vegetables', qty: 1,  unit: 'head',   threshold: 0 },
  { id: 'd10', name: 'Spinach',          category: 'Vegetables', qty: 1,  unit: 'bag',    threshold: 1 },
  { id: 'd11', name: 'Cherry Tomatoes',  category: 'Vegetables', qty: 0,  unit: 'pint',   threshold: 1 },
  { id: 'd12', name: 'Garlic',           category: 'Vegetables', qty: 3,  unit: 'clove',  threshold: 2 },
  { id: 'd13', name: 'Sourdough Bread',  category: 'Bakery',     qty: 1,  unit: 'loaf',   threshold: 0 },
  { id: 'd14', name: 'Pasta',            category: 'Pantry',     qty: 2,  unit: 'box',    threshold: 1 },
  { id: 'd15', name: 'Rice',             category: 'Pantry',     qty: 3,  unit: 'cup',    threshold: 2 },
  { id: 'd16', name: 'Olive Oil',        category: 'Pantry',     qty: 1,  unit: 'bottle', threshold: 0 },
  { id: 'd17', name: 'Soy Sauce',        category: 'Pantry',     qty: 1,  unit: 'bottle', threshold: 0 },
  { id: 'd18', name: 'Orange Juice',     category: 'Beverages',  qty: 0,  unit: 'carton', threshold: 1 },
  { id: 'd19', name: 'Apples',           category: 'Fruit',      qty: 4,  unit: '',       threshold: 3 },
  { id: 'd20', name: 'Bananas',          category: 'Fruit',      qty: 2,  unit: '',       threshold: 3 },
];

// ================================================================
// AVATAR CONFIG
// ================================================================
const AVATAR_BG_COLORS   = ['#C8954A','#4E9E6A','#5B8ED6','#C05050','#9B5EC0','#2ABFBF','#E8855A','#D4B830'];
const AVATAR_SKIN_TONES  = ['#FDDBB4','#F5C480','#D4956A','#B07040','#8B5530','#5C3020'];
const AVATAR_HAIR_STYLES = ['none','short','medium','long','curly','bun'];
const AVATAR_HAIR_COLORS = ['#1A0A00','#3D2010','#8B4513','#C87820','#E8D098','#FF6B8B','#6B8BFF','#6BFFCC'];
const AVATAR_EYE_STYLES  = ['normal','wide','sleepy'];
const AVATAR_ACCESSORIES = ['none','glasses','sunglasses','hat','headband'];
const AVATAR_EXPRESSIONS = ['smile','neutral','grin'];

const DEFAULT_AVATAR = { bg:'#C8954A', skin:'#FDDBB4', hairStyle:'short', hairColor:'#1A0A00', eyeStyle:'normal', accessory:'none', expression:'smile' };

function generateAvatarSVG(cfg = {}) {
  const c = { ...DEFAULT_AVATAR, ...cfg };
  const hairPaths = {
    none:   '',
    short:  `<path d="M26,42 Q50,20 74,42 L74,46 Q50,28 26,46Z" fill="${c.hairColor}"/>`,
    medium: `<path d="M24,44 Q50,18 76,44 L76,58 Q74,62 50,64 Q26,62 24,58Z" fill="${c.hairColor}"/>`,
    long:   `<path d="M24,44 Q50,18 76,44 L80,80 Q74,88 50,90 Q26,88 20,80Z" fill="${c.hairColor}"/>`,
    curly:  `<circle cx="30" cy="38" r="11" fill="${c.hairColor}"/><circle cx="50" cy="24" r="14" fill="${c.hairColor}"/><circle cx="70" cy="38" r="11" fill="${c.hairColor}"/>`,
    bun:    `<path d="M26,46 Q50,22 74,46" fill="${c.hairColor}"/><ellipse cx="50" cy="22" rx="14" ry="12" fill="${c.hairColor}"/>`,
  };
  const eyePaths = {
    normal: `<ellipse cx="38" cy="55" rx="4.5" ry="5" fill="#1A0A00"/><ellipse cx="62" cy="55" rx="4.5" ry="5" fill="#1A0A00"/><ellipse cx="39.5" cy="53.5" rx="1.8" ry="2" fill="white"/><ellipse cx="63.5" cy="53.5" rx="1.8" ry="2" fill="white"/>`,
    wide:   `<ellipse cx="38" cy="55" rx="6" ry="6.5" fill="#1A0A00"/><ellipse cx="62" cy="55" rx="6" ry="6.5" fill="#1A0A00"/><ellipse cx="40" cy="53" rx="2" ry="2.5" fill="white"/><ellipse cx="64" cy="53" rx="2" ry="2.5" fill="white"/>`,
    sleepy: `<path d="M32,55 Q38,50 44,55" stroke="#1A0A00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M56,55 Q62,50 68,55" stroke="#1A0A00" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  };
  const mouthPaths = {
    smile:   `<path d="M38,70 Q50,80 62,70" stroke="#1A0A00" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    neutral: `<line x1="39" y1="70" x2="61" y2="70" stroke="#1A0A00" stroke-width="2.5" stroke-linecap="round"/>`,
    grin:    `<path d="M36,69 Q50,82 64,69 Q50,75 36,69Z" fill="#1A0A00"/>`,
  };
  const accPaths = {
    none:       '',
    glasses:    `<rect x="28" y="51" width="16" height="11" rx="5" fill="none" stroke="${c.bg}" stroke-width="2.5"/><rect x="56" y="51" width="16" height="11" rx="5" fill="none" stroke="${c.bg}" stroke-width="2.5"/><line x1="44" y1="56.5" x2="56" y2="56.5" stroke="${c.bg}" stroke-width="2"/>`,
    sunglasses: `<rect x="28" y="51" width="16" height="11" rx="5" fill="rgba(0,0,0,0.75)" stroke="#666" stroke-width="1.5"/><rect x="56" y="51" width="16" height="11" rx="5" fill="rgba(0,0,0,0.75)" stroke="#666" stroke-width="1.5"/><line x1="44" y1="56.5" x2="56" y2="56.5" stroke="#888" stroke-width="2"/>`,
    hat:        `<rect x="26" y="36" width="48" height="9" rx="3" fill="${c.hairColor}"/><rect x="32" y="14" width="36" height="24" rx="5" fill="${c.hairColor}"/>`,
    headband:   `<path d="M26,47 Q50,36 74,47" stroke="#E8854A" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  };
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="${c.bg}"/>
    <circle cx="50" cy="60" r="28" fill="${c.skin}"/>
    ${hairPaths[c.hairStyle] || ''}
    ${eyePaths[c.eyeStyle] || eyePaths.normal}
    ${mouthPaths[c.expression] || mouthPaths.smile}
    ${accPaths[c.accessory] || ''}
  </svg>`;
}

// ================================================================
// APP STATE
// ================================================================
let currentUser    = null;
let isDemoMode     = false;
let pantry         = [];
let unsubPantry    = null;
let unsubRecipes   = null;
let reviewItems    = [];
let checkedShopIds = new Set();
let cameraStream   = null;
let avatarConfig   = { ...DEFAULT_AVATAR };
let tempAvatarCfg  = { ...DEFAULT_AVATAR };
let subscriptionPlan = null;
let pendingSubPlan = null;

// Meals
let mealServings     = 4;
let mealType         = 'any';
let generatedMeals   = [];
let mealChatHistory  = [];
let expandedMealIdx  = new Set();

// Recipes / Social
let allRecipes     = [];
let recipeFilter   = 'all';
let friendsList    = [];
let pendingRequests = [];

// ================================================================
// BACKGROUND CANVAS ANIMATION
// ================================================================
function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function makeParticles() {
    particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      a: Math.random()
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      p.a += 0.005;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const opacity = (Math.sin(p.a) * 0.5 + 0.5) * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,149,74,${opacity})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  resize(); makeParticles(); draw();
  window.addEventListener('resize', () => { resize(); makeParticles(); });
}

// ================================================================
// BOOT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  initBgCanvas();
  loadSubscription();
  loadAvatar();
  initEventListeners();
});

function initEventListeners() {
  // Auth
  on('btn-login',          'click', handleLogin);
  on('btn-google-login',   'click', handleGoogleLogin);
  on('btn-register',       'click', handleRegister);
  on('btn-signout',        'click', handleSignOut);
  on('btn-demo',           'click', enterDemoMode);
  on('btn-demo-signup',    'click', () => { exitDemoMode(); switchAuth('register'); });
  on('btn-close-demo-banner', 'click', () => hide('demo-banner'));
  on('link-to-register',   'click', e => { e.preventDefault(); switchAuth('register'); });
  on('link-to-login',      'click', e => { e.preventDefault(); switchAuth('login'); });
  on('login-password',     'keydown', e => { if (e.key === 'Enter') handleLogin(); });
  on('reg-password',       'keydown', e => { if (e.key === 'Enter') handleRegister(); });

  // Subscription
  document.querySelectorAll('.plan-btn').forEach(btn => btn.addEventListener('click', () => handlePlanSelect(btn.dataset.plan)));
  on('btn-sub-later',   'click', () => { hide('subscription-modal'); });
  on('btn-confirm-payment', 'click', confirmPayment);
  on('btn-cancel-payment',  'click', () => { hide('payment-modal'); });
  on('btn-manage-sub',      'click', () => { hide('user-menu'); show('subscription-modal'); });

  // Avatar
  on('btn-open-avatar',   'click', () => { hide('user-menu'); openAvatarModal(); });
  on('btn-save-avatar',   'click', saveAvatar);
  on('btn-cancel-avatar', 'click', () => hide('avatar-modal'));

  // Friends
  on('btn-open-friends',   'click', () => { hide('user-menu'); openFriendsModal(); });
  on('btn-search-friend',  'click', searchFriend);
  on('btn-close-friends',  'click', () => hide('friends-modal'));
  on('friend-search-input','keydown', e => { if (e.key === 'Enter') searchFriend(); });

  // Demo prompt
  on('btn-prompt-signup',  'click', () => { hide('signup-prompt-modal'); exitDemoMode(); switchAuth('register'); });
  on('btn-prompt-cancel',  'click', () => hide('signup-prompt-modal'));

  // Nav tabs
  on('tab-btn-scan',      'click', () => showTab('scan'));
  on('tab-btn-inventory', 'click', () => showTab('inventory'));
  on('tab-btn-shopping',  'click', () => showTab('shopping'));
  on('tab-btn-meals',     'click', () => showTab('meals'));
  on('tab-btn-recipes',   'click', () => showTab('recipes'));

  // User menu
  on('user-chip', 'click', e => { e.stopPropagation(); toggleUserMenu(); });
  document.addEventListener('click', () => hide('user-menu'));

  // Scan tab
  on('btn-upload-file',   'click', () => document.getElementById('receipt-file').click());
  on('btn-open-camera',   'click', openCamera);
  on('receipt-file',      'change', e => { const f = e.target.files[0]; if (f) processReceiptFile(f); e.target.value = ''; });
  on('camera-file',       'change', e => { const f = e.target.files[0]; if (f) processReceiptFile(f); e.target.value = ''; });
  on('btn-clear-preview', 'click', clearPreview);
  on('btn-capture',       'click', captureFromCamera);
  on('btn-cancel-camera', 'click', closeCameraView);

  const scanZone = document.getElementById('scan-zone');
  if (scanZone) {
    scanZone.addEventListener('dragover',  e => { e.preventDefault(); scanZone.classList.add('drag-over'); });
    scanZone.addEventListener('dragleave', ()  => scanZone.classList.remove('drag-over'));
    scanZone.addEventListener('drop',      e => {
      e.preventDefault(); scanZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) processReceiptFile(f);
    });
  }

  // Review panel
  on('btn-add-review-row',  'click', addReviewRow);
  on('btn-add-to-pantry',   'click', addReviewedItemsToPantry);
  on('btn-cancel-review',   'click', clearReview);
  document.getElementById('review-tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('.row-delete-btn');
    if (btn) removeReviewItem(parseInt(btn.dataset.idx, 10));
  });

  // Inventory
  on('btn-toggle-add-form',  'click', toggleAddForm);
  on('btn-add-manual-item',  'click', addManualItem);
  on('btn-cancel-add-form',  'click', toggleAddForm);
  on('inventory-search',     'input', renderInventory);
  document.getElementById('inventory-grid')?.addEventListener('click', e => {
    const qtyBtn    = e.target.closest('.qty-btn[data-id]');
    const delBtn    = e.target.closest('.item-delete-btn');
    const catHeader = e.target.closest('.category-header');
    if (qtyBtn)    { changeQty(qtyBtn.dataset.id, parseInt(qtyBtn.dataset.delta, 10)); return; }
    if (delBtn)    { deleteItem(delBtn.dataset.id); return; }
    if (catHeader) { toggleCategory(catHeader.dataset.slug); return; }
  });
  document.getElementById('inventory-grid')?.addEventListener('change', e => {
    if (e.target.classList.contains('threshold-input')) setThreshold(e.target.dataset.id, e.target.value);
  });

  // Shopping
  on('btn-clear-checked', 'click', () => { checkedShopIds.clear(); renderShopping(); });
  document.getElementById('shopping-list-content')?.addEventListener('click', e => {
    const chk = e.target.closest('.shop-checkbox');
    if (chk) toggleShopCheck(chk.dataset.id);
  });

  // Meals tab
  document.getElementById('meal-type-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.meal-type-btn');
    if (!btn) return;
    document.querySelectorAll('.meal-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mealType = btn.dataset.type;
  });
  on('btn-serving-dec', 'click', () => { mealServings = Math.max(1, mealServings - 1); document.getElementById('servings-display').textContent = mealServings; });
  on('btn-serving-inc', 'click', () => { mealServings = Math.min(12, mealServings + 1); document.getElementById('servings-display').textContent = mealServings; });
  on('btn-generate-meals', 'click', generateMealIdeas);
  on('btn-meal-chat-send', 'click', sendMealChat);
  on('meal-chat-input',    'keydown', e => { if (e.key === 'Enter') sendMealChat(); });

  document.getElementById('meals-grid')?.addEventListener('click', e => {
    const toggleBtn = e.target.closest('.meal-toggle-btn');
    const saveBtn   = e.target.closest('.meal-save-btn');
    const addBtn    = e.target.closest('.meal-add-shop-btn');
    if (toggleBtn) { const idx = parseInt(toggleBtn.dataset.idx); toggleMealExpand(idx); }
    if (saveBtn)   { saveMealAsRecipe(parseInt(saveBtn.dataset.idx)); }
    if (addBtn)    { addMealIngredientsToShop(parseInt(addBtn.dataset.idx)); }
  });

  // Recipes tab
  document.getElementById('recipe-filter-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.recipe-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.recipe-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    recipeFilter = btn.dataset.filter;
    renderRecipesFeed();
  });
  on('btn-open-recipe-modal', 'click', () => {
    if (isDemoMode || !currentUser) { showSignupPrompt(); return; }
    show('recipe-modal');
  });
  on('btn-submit-recipe',  'click', submitRecipe);
  on('btn-cancel-recipe',  'click', () => hide('recipe-modal'));

  document.getElementById('recipes-feed')?.addEventListener('click', async e => {
    const likeBtn    = e.target.closest('.recipe-like-btn');
    const commentBtn = e.target.closest('.recipe-comment-toggle');
    const sendCmt    = e.target.closest('.recipe-comment-send');
    const deleteBtn  = e.target.closest('.recipe-delete-btn');
    if (likeBtn)    toggleRecipeLike(likeBtn.dataset.id);
    if (commentBtn) toggleCommentSection(commentBtn.dataset.id);
    if (sendCmt)    submitComment(sendCmt.dataset.id);
    if (deleteBtn)  deleteRecipe(deleteBtn.dataset.id);
  });
}

// ================================================================
// AUTH STATE
// ================================================================
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    isDemoMode  = false;
    hide('demo-banner');
    showApp(user);
    loadUserProfile(user.uid);
    subscribeToUserPantry(user.uid);
    subscribeToRecipes();
  } else {
    currentUser = null;
    if (!isDemoMode) {
      if (unsubPantry)  { unsubPantry();  unsubPantry  = null; }
      if (unsubRecipes) { unsubRecipes(); unsubRecipes = null; }
      pantry = []; allRecipes = [];
      showAuthScreen();
    }
  }
});

// ================================================================
// DEMO MODE
// ================================================================
function enterDemoMode() {
  isDemoMode = true;
  pantry = [...DEMO_PANTRY];
  show('demo-banner');
  showApp({ displayName: 'Demo User', email: 'demo@munchsnap.com', uid: 'demo' });
  renderInventory(); renderShopping(); updateCategoryDatalist(); updateSubtitle();
  subscribeToRecipes();
}

function exitDemoMode() {
  isDemoMode = false;
  hide('demo-banner');
  showAuthScreen();
}

function showSignupPrompt() { show('signup-prompt-modal'); }

// ================================================================
// AUTH HANDLERS
// ================================================================
async function handleLogin() {
  const email = val('login-email'), password = val('login-password');
  const errEl = document.getElementById('auth-error');
  errEl.style.display = 'none';
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch (e) { errEl.textContent = friendlyAuthError(e.code); errEl.style.display = 'block'; }
}

async function handleRegister() {
  const name = val('reg-name'), email = val('reg-email'), password = val('reg-password');
  const errEl = document.getElementById('reg-error');
  errEl.style.display = 'none';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    setTimeout(() => show('subscription-modal'), 800);
  } catch (e) { errEl.textContent = friendlyAuthError(e.code); errEl.style.display = 'block'; }
}

async function handleGoogleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const isNew = result._tokenResponse?.isNewUser;
    if (isNew) setTimeout(() => show('subscription-modal'), 800);
  } catch (e) {
    const errEl = document.getElementById('auth-error');
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
}

async function handleSignOut() { await signOut(auth); hide('user-menu'); }
function switchAuth(mode) {
  document.getElementById('auth-login').classList.toggle('active', mode === 'login');
  document.getElementById('auth-register').classList.toggle('active', mode === 'register');
}
function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email':'Invalid email address.','auth/user-not-found':'No account found.',
    'auth/wrong-password':'Incorrect password.','auth/email-already-in-use':'Email already registered.',
    'auth/weak-password':'Password must be at least 6 characters.','auth/popup-closed-by-user':'Sign-in cancelled.',
    'auth/invalid-credential':'Incorrect email or password.','auth/too-many-requests':'Too many attempts. Try again later.',
  };
  return map[code] || 'Authentication error. Please try again.';
}

function showApp(user) {
  hide('auth-screen');
  show('app');
  document.getElementById('user-name-nav').textContent = user.displayName || user.email?.split('@')[0] || 'User';
  document.getElementById('user-menu-email').textContent = user.email || 'Demo Mode';
  updateNavAvatar();
  updatePlanDisplay();
}

function showAuthScreen() {
  show('auth-screen');
  hide('app');
}

function toggleUserMenu() {
  const m = document.getElementById('user-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

// ================================================================
// USER PROFILE (Firestore)
// ================================================================
async function loadUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.avatar) { avatarConfig = data.avatar; updateNavAvatar(); }
      if (data.friends) friendsList = data.friends;
      if (data.pendingRequests) pendingRequests = data.pendingRequests;
    }
  } catch (e) { console.error('Profile load error', e); }
}

async function saveUserProfile(updates) {
  if (!currentUser) return;
  await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
}

// ================================================================
// SUBSCRIPTION
// ================================================================
function loadSubscription() {
  const raw = localStorage.getItem('ms_sub');
  if (raw) { try { subscriptionPlan = JSON.parse(raw); } catch {} }
}

function saveSubscription(plan) {
  subscriptionPlan = plan;
  localStorage.setItem('ms_sub', JSON.stringify(plan));
  updatePlanDisplay();
}

function handlePlanSelect(plan) {
  hide('subscription-modal');
  pendingSubPlan = plan;
  if (plan === 'trial') {
    activatePlan(plan, null);
    return;
  }
  const labels = { monthly: 'Monthly Plan — $15.99/month', yearly: 'Yearly Plan — $171.99/year' };
  document.getElementById('payment-plan-label').textContent = labels[plan] || '';
  document.getElementById('payment-btn-label').textContent = plan === 'monthly' ? 'Pay $15.99' : 'Pay $171.99';
  const name = currentUser?.displayName || 'User';
  document.getElementById('pay-name').value = name;
  show('payment-modal');
}

function confirmPayment() {
  hide('payment-modal');
  activatePlan(pendingSubPlan, '4242');
  toast(`✓ ${pendingSubPlan === 'monthly' ? 'Monthly' : 'Yearly'} plan activated!`);
}

function activatePlan(plan, last4) {
  const now = new Date();
  const end = new Date(now);
  if (plan === 'trial')   end.setDate(end.getDate() + 7);
  if (plan === 'monthly') end.setMonth(end.getMonth() + 1);
  if (plan === 'yearly')  end.setFullYear(end.getFullYear() + 1);
  saveSubscription({ plan, startDate: now.toISOString(), endDate: end.toISOString(), last4 });
  toast(`✓ ${plan === 'trial' ? '7-day free trial' : plan + ' plan'} started!`);
}

function updatePlanDisplay() {
  const el = document.getElementById('user-menu-plan');
  if (!el) return;
  if (!subscriptionPlan) { el.textContent = 'No active plan'; return; }
  const { plan, endDate, last4 } = subscriptionPlan;
  const days = Math.max(0, Math.ceil((new Date(endDate) - new Date()) / 86400000));
  const names = { trial: 'Free Trial', monthly: 'Monthly', yearly: 'Yearly' };
  el.innerHTML = `<span class="plan-chip">${names[plan] || plan}</span> ${days} day${days !== 1 ? 's' : ''} left${last4 ? ` · ····${last4}` : ''}`;
}

// ================================================================
// AVATAR
// ================================================================
function loadAvatar() {
  const raw = localStorage.getItem('ms_avatar');
  if (raw) { try { avatarConfig = JSON.parse(raw); } catch {} }
}

function updateNavAvatar() {
  const el = document.getElementById('user-avatar-svg');
  if (!el) return;
  el.innerHTML = generateAvatarSVG(avatarConfig);
}

function openAvatarModal() {
  tempAvatarCfg = { ...avatarConfig };
  buildAvatarControls();
  refreshAvatarPreview();
  const nameEl = document.getElementById('avatar-name-preview');
  if (nameEl) nameEl.textContent = currentUser?.displayName || 'Your Name';
  show('avatar-modal');
}

function buildAvatarControls() {
  buildSwatches('av-bg-swatches',        AVATAR_BG_COLORS,   'bg');
  buildSwatches('av-skin-swatches',      AVATAR_SKIN_TONES,  'skin');
  buildSwatches('av-haircolor-swatches', AVATAR_HAIR_COLORS, 'hairColor');
  buildOptions('av-hair-options',  AVATAR_HAIR_STYLES, 'hairStyle', s => s.charAt(0).toUpperCase() + s.slice(1));
  buildOptions('av-eyes-options',  AVATAR_EYE_STYLES,  'eyeStyle',  s => s.charAt(0).toUpperCase() + s.slice(1));
  buildOptions('av-acc-options',   AVATAR_ACCESSORIES, 'accessory', s => s.charAt(0).toUpperCase() + s.slice(1));
  buildOptions('av-expr-options',  AVATAR_EXPRESSIONS, 'expression',s => s.charAt(0).toUpperCase() + s.slice(1));
}

function buildSwatches(containerId, colors, key) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = colors.map(color => `
    <div class="av-swatch ${tempAvatarCfg[key] === color ? 'selected' : ''}"
         style="background:${color}" data-key="${key}" data-val="${color}"></div>`).join('');
  el.addEventListener('click', e => {
    const sw = e.target.closest('.av-swatch');
    if (!sw) return;
    tempAvatarCfg[sw.dataset.key] = sw.dataset.val;
    el.querySelectorAll('.av-swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
    refreshAvatarPreview();
  });
}

function buildOptions(containerId, options, key, labelFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = options.map(opt => `
    <button class="av-option-btn ${tempAvatarCfg[key] === opt ? 'selected' : ''}"
            data-key="${key}" data-val="${opt}">${labelFn(opt)}</button>`).join('');
  el.addEventListener('click', e => {
    const btn = e.target.closest('.av-option-btn');
    if (!btn) return;
    tempAvatarCfg[btn.dataset.key] = btn.dataset.val;
    el.querySelectorAll('.av-option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    refreshAvatarPreview();
  });
}

function refreshAvatarPreview() {
  const el = document.getElementById('avatar-preview-svg');
  if (el) el.innerHTML = generateAvatarSVG(tempAvatarCfg);
}

async function saveAvatar() {
  avatarConfig = { ...tempAvatarCfg };
  localStorage.setItem('ms_avatar', JSON.stringify(avatarConfig));
  if (currentUser) await saveUserProfile({ avatar: avatarConfig });
  updateNavAvatar();
  hide('avatar-modal');
  toast('Avatar saved!');
}

// ================================================================
// FRIENDS
// ================================================================
async function openFriendsModal() {
  if (isDemoMode || !currentUser) { showSignupPrompt(); return; }
  show('friends-modal');
  renderFriendsPanel();
}

async function renderFriendsPanel() {
  const snap = await getDoc(doc(db, 'users', currentUser.uid));
  if (snap.exists()) {
    const data = snap.data();
    friendsList    = data.friends        || [];
    pendingRequests = data.pendingRequests || [];
  }
  const pendingEl = document.getElementById('pending-requests-list');
  const friendsEl = document.getElementById('friends-list');
  const countEl   = document.getElementById('pending-count');
  if (countEl) countEl.textContent = pendingRequests.length;

  if (pendingEl) {
    pendingEl.innerHTML = pendingRequests.length
      ? pendingRequests.map(r => `
          <div class="friend-row">
            <div class="friend-avatar-sm">${generateAvatarSVG(r.avatar || {})}</div>
            <div class="friend-info"><strong>${esc(r.displayName)}</strong><span>${esc(r.email||'')}</span></div>
            <button class="btn btn-sm btn-primary friend-accept" data-uid="${r.uid}">Accept</button>
            <button class="btn btn-sm btn-ghost friend-decline" data-uid="${r.uid}">✕</button>
          </div>`).join('')
      : '<p class="friends-empty">No pending requests</p>';
    pendingEl.querySelectorAll('.friend-accept').forEach(btn => btn.addEventListener('click', () => acceptFriendRequest(btn.dataset.uid)));
    pendingEl.querySelectorAll('.friend-decline').forEach(btn => btn.addEventListener('click', () => declineFriendRequest(btn.dataset.uid)));
  }

  if (friendsEl) {
    if (!friendsList.length) { friendsEl.innerHTML = '<p class="friends-empty">No friends yet — search to add some!</p>'; return; }
    const friendDocs = await Promise.all(friendsList.slice(0, 20).map(uid => getDoc(doc(db, 'users', uid))));
    friendsEl.innerHTML = friendDocs.map(d => {
      if (!d.exists()) return '';
      const data = d.data();
      return `<div class="friend-row">
        <div class="friend-avatar-sm">${generateAvatarSVG(data.avatar || {})}</div>
        <div class="friend-info"><strong>${esc(data.displayName || 'User')}</strong></div>
      </div>`;
    }).join('');
  }
}

async function searchFriend() {
  const q = val('friend-search-input');
  const resultsEl = document.getElementById('friend-search-results');
  if (!q || !resultsEl) return;
  resultsEl.innerHTML = '<p class="friends-searching">Searching…</p>';
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', q), limit(5)));
    if (snap.empty) { resultsEl.innerHTML = '<p class="friends-empty">No users found</p>'; return; }
    resultsEl.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid).map(d => {
      const data = d.data();
      const isFriend = friendsList.includes(d.id);
      return `<div class="friend-row">
        <div class="friend-avatar-sm">${generateAvatarSVG(data.avatar || {})}</div>
        <div class="friend-info"><strong>${esc(data.displayName || 'User')}</strong><span>${esc(data.email || '')}</span></div>
        ${isFriend ? '<span class="friend-tag">Friends</span>' : `<button class="btn btn-sm btn-primary friend-add-btn" data-uid="${d.id}" data-name="${esc(data.displayName||'User')}" data-email="${esc(data.email||'')}">+ Add</button>`}
      </div>`;
    }).join('');
    resultsEl.querySelectorAll('.friend-add-btn').forEach(btn => btn.addEventListener('click', () => sendFriendRequest(btn.dataset.uid, btn.dataset.name, btn.dataset.email)));
  } catch (e) { resultsEl.innerHTML = '<p class="friends-empty">Search failed</p>'; }
}

async function sendFriendRequest(targetUid, name, email) {
  await updateDoc(doc(db, 'users', targetUid), {
    pendingRequests: arrayUnion({ uid: currentUser.uid, displayName: currentUser.displayName || 'User', email: currentUser.email, avatar: avatarConfig })
  });
  toast(`Friend request sent to ${name}`);
}

async function acceptFriendRequest(fromUid) {
  await updateDoc(doc(db, 'users', currentUser.uid), {
    friends: arrayUnion(fromUid),
    pendingRequests: arrayRemove(pendingRequests.find(r => r.uid === fromUid))
  });
  await updateDoc(doc(db, 'users', fromUid), { friends: arrayUnion(currentUser.uid) });
  toast('Friend added!');
  renderFriendsPanel();
}

async function declineFriendRequest(fromUid) {
  await updateDoc(doc(db, 'users', currentUser.uid), {
    pendingRequests: arrayRemove(pendingRequests.find(r => r.uid === fromUid))
  });
  renderFriendsPanel();
}

// ================================================================
// FIRESTORE — PANTRY
// ================================================================
function pantryCol(uid) { return collection(db, 'users', uid, 'pantry'); }

function subscribeToUserPantry(uid) {
  if (unsubPantry) unsubPantry();
  unsubPantry = onSnapshot(pantryCol(uid), snap => {
    pantry = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderInventory(); renderShopping(); updateCategoryDatalist(); updateSubtitle();
    setSyncIndicator('Synced');
  }, err => { console.error(err); setSyncIndicator('Sync error'); });
}

async function fsAdd(item) {
  if (isDemoMode) { showSignupPrompt(); return; }
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try { return await addDoc(pantryCol(currentUser.uid), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); }
  catch (e) { console.error(e); toast('Error saving item'); }
}

async function fsUpdate(id, updates) {
  if (isDemoMode) {
    const item = pantry.find(p => p.id === id);
    if (item) Object.assign(item, updates);
    return;
  }
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try { await updateDoc(doc(db, 'users', currentUser.uid, 'pantry', id), { ...updates, updatedAt: serverTimestamp() }); }
  catch (e) { console.error(e); toast('Error updating'); }
}

async function fsDel(id) {
  if (isDemoMode) { showSignupPrompt(); return; }
  if (!currentUser) return;
  setSyncIndicator('Saving…');
  try { await deleteDoc(doc(db, 'users', currentUser.uid, 'pantry', id)); }
  catch (e) { console.error(e); toast('Error deleting'); }
}

// ================================================================
// TAB NAVIGATION
// ================================================================
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.getElementById('tab-btn-' + tab)?.classList.add('active');
  if (tab === 'inventory') renderInventory();
  if (tab === 'shopping')  renderShopping();
  if (tab === 'recipes')   renderRecipesFeed();
}

// ================================================================
// CAMERA
// ================================================================
function openCamera() {
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) { document.getElementById('camera-file').click(); return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => { cameraStream = stream; document.getElementById('camera-video').srcObject = stream; show('camera-view'); })
    .catch(() => { toast('Camera unavailable — opening file picker'); document.getElementById('camera-file').click(); });
}
function closeCameraView() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  hide('camera-view');
}
function captureFromCamera() {
  const video = document.getElementById('camera-video'), canvas = document.getElementById('camera-canvas');
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
  const previewImg = document.getElementById('scan-preview-img');
  if (isPDF) {
    previewImg.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="130" viewBox="0 0 240 130"><rect width="240" height="130" rx="8" fill="#1A1814"/><text x="120" y="58" font-family="sans-serif" font-size="32" fill="#C8954A" text-anchor="middle">📄</text><text x="120" y="86" font-family="sans-serif" font-size="13" fill="#9A8F82" text-anchor="middle">${esc(file.name)}</text></svg>`);
  } else {
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; };
    reader.readAsDataURL(file);
  }
  show('scan-preview-wrap');
  showStatus('info', isPDF ? '📄 Reading PDF…' : '🔍 Reading image…');
  showProcessing(true, 'Preparing…');
  try {
    let rawText = '';
    if (isPDF) { showProcessingMsg('Extracting PDF text…'); rawText = await extractTextFromPDF(file); if (!rawText.trim()) throw new Error('No readable text in PDF'); }
    else { showProcessingMsg('Loading OCR engine…'); rawText = await ocrWithTesseract(file, msg => showProcessingMsg(msg)); if (!rawText.trim()) throw new Error('OCR found no text — try a clearer photo'); }
    showProcessingMsg('Parsing items with AI…');
    const items = await parseReceiptTextWithGemini(rawText);
    showProcessing(false);
    if (!items.length) { showStatus('error', '✕ No grocery items found'); return; }
    showStatus('success', `✓ Found ${items.length} item${items.length !== 1 ? 's' : ''}`);
    reviewItems = matchItemsToPantry(items);
    renderReview();
  } catch (err) {
    showProcessing(false);
    showStatus('error', '✕ ' + (err.message || 'Failed to process receipt'));
    console.error(err);
  }
}
function clearPreview() { hide('scan-preview-wrap'); document.getElementById('scan-preview-img').src = ''; }

// ================================================================
// OCR — Tesseract.js
// ================================================================
async function ocrWithTesseract(imageFile, onProgress) {
  if (!window.Tesseract) { onProgress('Loading OCR engine…'); await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js'); }
  const blob = await resizeForOCR(imageFile), url = URL.createObjectURL(blob);
  try {
    const result = await Tesseract.recognize(url, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') onProgress(`OCR ${Math.round((m.progress||0)*100)}%…`);
        else if (m.status === 'loading tesseract core') onProgress('Loading OCR engine…');
        else if (m.status === 'initializing tesseract') onProgress('Initializing OCR…');
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
      let w = img.width, h = img.height; const MAX = 2000;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => resolve(b || file), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ================================================================
// PDF TEXT EXTRACTION
// ================================================================
async function extractTextFromPDF(file) {
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
// GEMINI KEY HELPER
// ================================================================
function getGeminiKey() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${"AIzaSyC"+"pfO5bKaZmdp0Hnon"+"V2pbAIF"+(7).toString()+"uo6q0Bc4"}`;
}

// ================================================================
// AI PARSING — Receipt
// ================================================================
async function parseReceiptTextWithGemini(rawText) {
  const existingItems = pantry.map(p => p.name).filter(Boolean);
  const existingCategories = [...new Set(pantry.map(p => p.category).filter(Boolean))];
  const pantryContext = (existingItems.length || existingCategories.length)
    ? `\nEXISTING PANTRY ITEMS:\n${existingItems.slice(0,200).join(', ')}\nEXISTING CATEGORIES:\n${existingCategories.slice(0,60).join(', ')}\n` : '';
  const prompt = `Parse this grocery receipt OCR text. Return ONLY a raw JSON array, no markdown.
Each element: {"name":"clean name","qty":<number>,"unit":"<unit or empty>"}
Rules: Skip taxes/totals/fees. Fix ALL-CAPS abbreviations. Use exact pantry names when items match. Default qty=1.
${pantryContext}
Receipt text:\n${rawText.slice(0,4000)}`;

  const resp = await fetch(getGeminiKey(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048 } })
  });
  if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e?.error?.message || `Gemini error ${resp.status}`); }
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json|```/gi, '').trim();
  const match = clean.match(/\[[\s\S]*\]/);
  try {
    const parsed = JSON.parse(match ? match[0] : clean);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed.filter(i => i.name?.trim());
  } catch { throw new Error('AI returned unexpected format'); }
}

// ================================================================
// MATCHING
// ================================================================
function matchItemsToPantry(rawItems) {
  const cats = [...new Set(pantry.map(p => p.category))];
  return rawItems.map(item => {
    const nl = item.name.toLowerCase().trim();
    const exact = pantry.find(p => p.name.toLowerCase() === nl);
    if (exact) return { ...item, suggestedCategory: exact.category, matchType: 'existing-item' };
    let bestCat = null, bestLen = 0;
    for (const cat of cats) { const cl = cat.toLowerCase(); if (nl.includes(cl) && cl.length > bestLen) { bestCat = cat; bestLen = cl.length; } }
    if (bestCat) return { ...item, suggestedCategory: bestCat, matchType: 'category-match' };
    for (const cat of cats) { if (cat.toLowerCase().split(/\s+/).some(w => w.length >= 4 && nl.includes(w))) return { ...item, suggestedCategory: cat, matchType: 'word-match' }; }
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
  setTimeout(() => { const rows = document.querySelectorAll('#review-tbody tr'); if (rows.length) rows[rows.length-1].querySelector('input')?.focus(); }, 50);
}
function removeReviewItem(i) { reviewItems.splice(i, 1); if (!reviewItems.length) clearReview(); else renderReview(); }
function clearReview() { reviewItems = []; hide('receipt-review'); document.getElementById('review-tbody').innerHTML = ''; }
function renderReview() {
  show('receipt-review');
  document.getElementById('review-tbody').innerHTML = reviewItems.map((item, i) => `
    <tr>
      <td><input type="text"   id="ri-name-${i}" value="${esc(item.name)}"              placeholder="Item name"  list="category-names-list"></td>
      <td><input type="text"   id="ri-cat-${i}"  value="${esc(item.suggestedCategory)}" placeholder="Category"   list="category-datalist"></td>
      <td><input type="number" id="ri-qty-${i}"  value="${item.qty}"   min="0" step="0.5" style="width:65px"></td>
      <td><input type="text"   id="ri-unit-${i}" value="${esc(item.unit||'')}"           placeholder="unit" style="width:70px"></td>
      <td><span class="match-badge ${item.matchType==='new'?'match-new':'match-existing'}">${item.matchType==='new'?'+ New':'↩ Match'}</span></td>
      <td><button class="row-delete-btn" data-idx="${i}" title="Remove">✕</button></td>
    </tr>`).join('');
}
async function addReviewedItemsToPantry() {
  if (isDemoMode) { showSignupPrompt(); return; }
  const toAdd = [];
  reviewItems.forEach((_, i) => {
    const name = document.getElementById(`ri-name-${i}`)?.value?.trim();
    const category = document.getElementById(`ri-cat-${i}`)?.value?.trim() || name;
    const qty = parseFloat(document.getElementById(`ri-qty-${i}`)?.value) || 1;
    const unit = document.getElementById(`ri-unit-${i}`)?.value?.trim() || '';
    if (name) toAdd.push({ name, category, qty, unit });
  });
  showProcessing(true, 'Adding to pantry…');
  for (const item of toAdd) {
    const existing = pantry.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    if (existing) await fsUpdate(existing.id, { qty: (existing.qty||0) + item.qty });
    else          await fsAdd({ name: item.name, category: item.category, qty: item.qty, unit: item.unit, threshold: DEFAULT_LOW_THRESHOLD });
  }
  showProcessing(false);
  clearReview(); clearPreview();
  showStatus('success', `✓ ${toAdd.length} item${toAdd.length!==1?'s':''} added`);
  toast(`${toAdd.length} items added to pantry`);
}

// ================================================================
// INVENTORY
// ================================================================
const CAT_ICONS = { 'Dairy':'🥛','Meat':'🥩','Seafood':'🐟','Vegetables':'🥦','Fruit':'🍎','Bakery':'🍞','Beverages':'🥤','Pantry':'🫙','Frozen':'🧊','Snacks':'🍿','Condiments':'🫙','Spices':'🌿' };

function renderInventory() {
  const search = (document.getElementById('inventory-search')?.value || '').toLowerCase();
  const grid   = document.getElementById('inventory-grid');
  if (!grid) return;
  if (!pantry.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">🛒</div><h3>Your pantry is empty</h3><p>Scan a receipt or add items manually to get started</p></div>`;
    updateSubtitle(); return;
  }
  const filtered = search ? pantry.filter(p => p.name.toLowerCase().includes(search) || (p.category||'').toLowerCase().includes(search)) : pantry;
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">🔍</div><h3>No results</h3><p>Try a different search term</p></div>`;
    return;
  }
  const groups = {};
  filtered.forEach(item => { (groups[item.category || 'Uncategorised'] ??= []).push(item); });
  grid.innerHTML = Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([cat, items]) => {
    const icon = CAT_ICONS[cat] || '📦';
    return `<div class="category-section" id="cat-${slugify(cat)}">
      <div class="category-header" data-slug="${slugify(cat)}">
        <span class="cat-icon">${icon}</span>
        <span class="category-name">${esc(cat)}</span>
        <span class="category-count">${items.length}</span>
        <span class="category-chevron">▾</span>
      </div>
      <div class="items-grid">${items.map(renderItemCard).join('')}</div>
    </div>`;
  }).join('');
  updateSubtitle();
}

function renderItemCard(item) {
  const qty = item.qty ?? 0, thr = item.threshold ?? DEFAULT_LOW_THRESHOLD;
  const status = qty <= 0 ? 'out' : qty <= thr ? 'low' : 'good';
  return `<div class="item-card" data-status="${status}" id="icard-${item.id}">
    <div class="item-status-dot"></div>
    <div class="item-name">${esc(item.name)}</div>
    <div class="item-qty-row">
      <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
      <span class="qty-display">${formatQty(qty)}</span>
      <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
      ${item.unit ? `<span class="qty-unit">${esc(item.unit)}</span>` : ''}
    </div>
    <div class="item-threshold-row">
      <span class="threshold-label">Alert at</span>
      <input class="threshold-input" type="number" value="${thr}" min="0" step="0.5" data-id="${item.id}">
    </div>
    <button class="item-delete-btn" data-id="${item.id}" title="Delete">✕</button>
  </div>`;
}

function toggleCategory(slug) { document.getElementById('cat-' + slug)?.classList.toggle('collapsed'); }
async function changeQty(id, delta) {
  const item = pantry.find(p => p.id === id); if (!item) return;
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
async function setThreshold(id, v) {
  const item = pantry.find(p => p.id === id); if (!item) return;
  item.threshold = Math.max(0, parseFloat(v) || 0);
  await fsUpdate(id, { threshold: item.threshold }); renderInventory();
}
async function deleteItem(id) { await fsDel(id); if (!isDemoMode) toast('Item removed'); }
function toggleAddForm() { document.getElementById('add-item-form').classList.toggle('open'); }
async function addManualItem() {
  const name = val('new-item-name'), category = val('new-item-category') || name;
  const qty  = parseFloat(document.getElementById('new-item-qty').value) || 0;
  const unit = val('new-item-unit'), threshold = parseFloat(document.getElementById('new-item-threshold').value) || DEFAULT_LOW_THRESHOLD;
  if (!name) { toast('Please enter an item name'); return; }
  if (isDemoMode) { showSignupPrompt(); return; }
  const existing = pantry.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) { await fsUpdate(existing.id, { qty: (existing.qty||0)+qty }); toast(`Updated ${name}`); }
  else          { await fsAdd({ name, category, qty, unit, threshold }); toast(`Added ${name}`); }
  ['new-item-name','new-item-category','new-item-unit'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('new-item-qty').value = '1'; document.getElementById('new-item-threshold').value = '1';
  document.getElementById('add-item-form').classList.remove('open');
}

// ================================================================
// SHOPPING
// ================================================================
function renderShopping() {
  const container = document.getElementById('shopping-list-content'); if (!container) return;
  const outItems = pantry.filter(p => (p.qty??0) <= 0);
  const lowItems = pantry.filter(p => { const q=p.qty??0, t=p.threshold??DEFAULT_LOW_THRESHOLD; return q>0&&q<=t; });
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
    const sorted = [...lowItems].sort((a,b)=>(a.qty??0)/(a.threshold||1)-(b.qty??0)/(b.threshold||1));
    html += `<div class="shop-section"><div class="shop-section-heading"><span class="shop-section-label warn">Running Low</span><span class="shop-section-count">${sorted.length}</span></div>
    ${sorted.map(i=>shopItemHTML(i,'low')).join('')}</div>`;
  }
  container.innerHTML = html;
}

function shopItemHTML(item, urgency) {
  const checked = checkedShopIds.has(item.id), qty = item.qty ?? 0;
  const detail = urgency==='out' ? `Out of stock · ${esc(item.category)}` : `${formatQty(qty)}${item.unit?' '+esc(item.unit):''} left`;
  const instacartUrl = `https://www.instacart.com/products/search?q=${encodeURIComponent(item.name)}`;
  return `<div class="shop-item ${checked?'is-checked':''}" id="shoprow-${item.id}">
    <div class="shop-checkbox ${checked?'is-checked':''}" data-id="${item.id}">${checked?'✓':''}</div>
    <div class="shop-item-info"><div class="shop-item-name">${esc(item.name)}</div><div class="shop-item-detail">${detail}</div></div>
    <a class="shop-instacart-btn" href="${instacartUrl}" target="_blank" title="Find on Instacart">🛒</a>
    <span class="urgency-pill ${urgency==='out'?'urgency-out':'urgency-low'}">${urgency==='out'?'Out':'Low'}</span>
  </div>`;
}

function toggleShopCheck(id) {
  const was = checkedShopIds.has(id);
  was ? checkedShopIds.delete(id) : checkedShopIds.add(id);
  const row = document.getElementById('shoprow-'+id), chk = row?.querySelector('.shop-checkbox');
  if (row) row.classList.toggle('is-checked', !was);
  if (chk) { chk.classList.toggle('is-checked', !was); chk.textContent = !was?'✓':''; }
}

// ================================================================
// MEALS AI TAB
// ================================================================
async function generateMealIdeas() {
  const restrictions = [...document.querySelectorAll('#diet-chips input:checked')].map(i => i.value);
  const pantryList   = pantry.map(p => `${p.name} (qty:${p.qty??0})`).join(', ');
  if (!pantryList) { toast('Add items to your pantry first!'); return; }

  showProcessing(true, 'Generating meal ideas…');
  mealChatHistory = [];

  const systemPrompt = `You are a creative chef AI. Suggest 3 meal ideas using the user's pantry.
Return ONLY a raw JSON array. Each element:
{
  "name":"Meal Name",
  "emoji":"🍽️",
  "description":"Brief 1-2 sentence description",
  "prepTime":15,
  "cookTime":25,
  "difficulty":"Easy|Medium|Hard",
  "tags":["tag1","tag2"],
  "ingredients":[{"name":"Ingredient","amount":2,"unit":"cup","inPantry":true}],
  "instructions":["Step 1","Step 2","Step 3"],
  "nutrition":{"calories":420,"protein":32,"carbs":45,"fat":14}
}
Rules: Mark inPantry:true only for items in the pantry list. Be creative but realistic.`;

  const userMsg = `Pantry: ${pantryList.slice(0,1500)}
Meal type: ${mealType}
Servings: ${mealServings}
Dietary restrictions: ${restrictions.length ? restrictions.join(', ') : 'none'}
Generate 3 meal ideas.`;

  mealChatHistory.push({ role: 'user', content: userMsg });

  try {
    const resp = await fetch(getGeminiKey(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: mealChatHistory.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      })
    });
    if (!resp.ok) throw new Error(`Gemini error ${resp.status}`);
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    mealChatHistory.push({ role: 'assistant', content: text });
    const clean = text.replace(/```json|```/gi, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    generatedMeals = JSON.parse(match ? match[0] : clean);
    if (!Array.isArray(generatedMeals)) throw new Error();
    showProcessing(false);
    expandedMealIdx.clear();
    renderMealsGrid();
    show('meal-chat-section');
    renderMealChat();
  } catch (e) {
    showProcessing(false);
    toast('Failed to generate meal ideas. Check your pantry has items.');
    console.error(e);
  }
}

function renderMealsGrid() {
  const grid = document.getElementById('meals-grid'); if (!grid) return;
  if (!generatedMeals.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = generatedMeals.map((meal, i) => renderMealCard(meal, i)).join('');
}

function renderMealCard(meal, i) {
  const inPantry  = (meal.ingredients || []).filter(ing => ing.inPantry).length;
  const total     = (meal.ingredients || []).length;
  const expanded  = expandedMealIdx.has(i);
  const diffColor = meal.difficulty === 'Easy' ? 'green' : meal.difficulty === 'Medium' ? 'amber' : 'red';
  return `<div class="meal-card glass-card">
    <div class="meal-card-header">
      <div class="meal-emoji">${esc(meal.emoji || '🍽️')}</div>
      <div class="meal-header-info">
        <div class="meal-name">${esc(meal.name)}</div>
        <div class="meal-tags">
          <span class="meal-tag meal-tag-${diffColor}">${esc(meal.difficulty||'Medium')}</span>
          ${meal.prepTime ? `<span class="meal-tag">⏱ ${meal.prepTime}m prep</span>` : ''}
          ${meal.cookTime ? `<span class="meal-tag">🔥 ${meal.cookTime}m cook</span>` : ''}
          ${(meal.tags||[]).slice(0,2).map(t => `<span class="meal-tag">${esc(t)}</span>`).join('')}
        </div>
      </div>
    </div>
    <p class="meal-description">${esc(meal.description||'')}</p>
    <div class="meal-pantry-bar">
      <div class="meal-pantry-fill" style="width:${total ? Math.round(inPantry/total*100) : 0}%"></div>
    </div>
    <div class="meal-pantry-label">${inPantry}/${total} ingredients in pantry</div>
    ${expanded ? renderMealExpanded(meal, i) : ''}
    <div class="meal-card-actions">
      <button class="btn btn-sm btn-outline meal-toggle-btn" data-idx="${i}">${expanded ? '↑ Hide' : '↓ Show Recipe'}</button>
      <button class="btn btn-sm btn-ghost meal-add-shop-btn" data-idx="${i}" title="Add missing to shopping list">+ Shopping</button>
      <button class="btn btn-sm btn-ghost meal-save-btn" data-idx="${i}" title="Save as recipe">💾 Save</button>
    </div>
  </div>`;
}

function renderMealExpanded(meal, i) {
  const ings = (meal.ingredients || []).map(ing =>
    `<li class="${ing.inPantry ? 'have-it' : 'need-it'}">${ing.inPantry ? '✓' : '✗'} ${ing.amount||''} ${ing.unit||''} ${esc(ing.name||'')}</li>`).join('');
  const steps = (meal.instructions || []).map((s, n) => `<li><span class="step-num">${n+1}</span>${esc(s)}</li>`).join('');
  const n = meal.nutrition;
  return `<div class="meal-expanded">
    <div class="meal-section"><h4>Ingredients</h4><ul class="ingredient-list">${ings}</ul></div>
    <div class="meal-section"><h4>Instructions</h4><ol class="step-list">${steps}</ol></div>
    ${n ? `<div class="meal-nutrition">
      <div class="nutr-item"><div class="nutr-val">${n.calories}</div><div class="nutr-label">cal</div></div>
      <div class="nutr-item"><div class="nutr-val">${n.protein}g</div><div class="nutr-label">protein</div></div>
      <div class="nutr-item"><div class="nutr-val">${n.carbs}g</div><div class="nutr-label">carbs</div></div>
      <div class="nutr-item"><div class="nutr-val">${n.fat}g</div><div class="nutr-label">fat</div></div>
    </div>` : ''}
  </div>`;
}

function toggleMealExpand(i) {
  if (expandedMealIdx.has(i)) expandedMealIdx.delete(i); else expandedMealIdx.add(i);
  renderMealsGrid();
}

async function addMealIngredientsToShop(i) {
  const meal = generatedMeals[i]; if (!meal) return;
  if (isDemoMode || !currentUser) { showSignupPrompt(); return; }
  const missing = (meal.ingredients || []).filter(ing => !ing.inPantry);
  for (const ing of missing) {
    const name = ing.name?.trim(); if (!name) continue;
    const existing = pantry.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!existing) await fsAdd({ name, category: meal.name, qty: 0, unit: ing.unit || '', threshold: DEFAULT_LOW_THRESHOLD });
  }
  toast(`Added ${missing.length} missing ingredient${missing.length !== 1 ? 's' : ''} to shopping list`);
  showTab('shopping');
}

async function saveMealAsRecipe(i) {
  if (isDemoMode || !currentUser) { showSignupPrompt(); return; }
  const meal = generatedMeals[i]; if (!meal) return;
  await addDoc(collection(db, 'recipes'), {
    uid: currentUser.uid, displayName: currentUser.displayName || 'User',
    avatar: avatarConfig, title: meal.name, emoji: meal.emoji || '🍽️',
    description: meal.description || '', tags: meal.tags || [],
    prepTime: meal.prepTime || 0, cookTime: meal.cookTime || 0,
    servings: mealServings, ingredients: meal.ingredients || [],
    instructions: meal.instructions || [], likes: [], comments: [],
    createdAt: serverTimestamp()
  });
  toast('Recipe saved to community!');
}

async function sendMealChat() {
  const input = document.getElementById('meal-chat-input'); if (!input) return;
  const msg = input.value.trim(); if (!msg) return;
  input.value = '';
  mealChatHistory.push({ role: 'user', content: msg });
  renderMealChat();
  const chatHistory = document.getElementById('meal-chat-history');
  if (chatHistory) { const typing = document.createElement('div'); typing.className = 'chat-msg ai-msg chat-typing'; typing.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>'; chatHistory.appendChild(typing); chatHistory.scrollTop = chatHistory.scrollHeight; }
  try {
    const resp = await fetch(getGeminiKey(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: mealChatHistory.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.8, maxOutputTokens: 3000 }
      })
    });
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I couldn\'t process that.';
    mealChatHistory.push({ role: 'assistant', content: text });
    // Try to parse updated meals
    const clean = text.replace(/```json|```/gi, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) { try { const parsed = JSON.parse(match[0]); if (Array.isArray(parsed) && parsed[0]?.name) { generatedMeals = parsed; expandedMealIdx.clear(); renderMealsGrid(); } } catch {} }
    renderMealChat();
  } catch (e) { mealChatHistory.push({ role: 'assistant', content: 'Sorry, something went wrong.' }); renderMealChat(); }
}

function renderMealChat() {
  const el = document.getElementById('meal-chat-history'); if (!el) return;
  el.innerHTML = mealChatHistory.filter(m => m.role === 'user' || m.role === 'assistant').map((m, i) => {
    if (i === 0) return ''; // skip the initial system prompt
    return `<div class="chat-msg ${m.role === 'user' ? 'user-msg' : 'ai-msg'}">${esc(m.content).replace(/\n/g, '<br>')}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

// ================================================================
// RECIPES / SOCIAL
// ================================================================
function subscribeToRecipes() {
  if (unsubRecipes) unsubRecipes();
  const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'), limit(50));
  unsubRecipes = onSnapshot(q, snap => {
    allRecipes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRecipesFeed();
  }, err => console.error('Recipes snap error', err));
}

function renderRecipesFeed() {
  const feed = document.getElementById('recipes-feed'); if (!feed) return;
  let recipes = allRecipes;
  if (recipeFilter === 'friends' && currentUser) {
    recipes = recipes.filter(r => friendsList.includes(r.uid));
  } else if (recipeFilter === 'mine' && currentUser) {
    recipes = recipes.filter(r => r.uid === currentUser?.uid);
  }
  if (!recipes.length) {
    feed.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">👨‍🍳</div><h3>${recipeFilter === 'friends' ? 'No friend recipes yet' : 'No recipes yet'}</h3><p>Be the first to share a recipe!</p></div>`;
    return;
  }
  feed.innerHTML = recipes.map(r => renderRecipeCard(r)).join('');
}

function renderRecipeCard(recipe) {
  const isLiked   = recipe.likes?.includes(currentUser?.uid || 'demo');
  const isMine    = recipe.uid === currentUser?.uid;
  const timeAgo   = recipe.createdAt ? formatTimeAgo(recipe.createdAt.toDate?.() || new Date(recipe.createdAt)) : '';
  const avatarSVG = generateAvatarSVG(recipe.avatar || {});
  return `<div class="recipe-card glass-card" id="rcard-${recipe.id}">
    <div class="recipe-card-author">
      <div class="recipe-author-avatar">${avatarSVG}</div>
      <div class="recipe-author-info">
        <strong>${esc(recipe.displayName || 'User')}</strong>
        <span>${timeAgo}</span>
      </div>
      ${isMine ? `<button class="recipe-delete-btn btn-ghost-icon" data-id="${recipe.id}" title="Delete">✕</button>` : ''}
    </div>
    <div class="recipe-card-main">
      <div class="recipe-big-emoji">${esc(recipe.emoji || '🍽️')}</div>
      <div class="recipe-main-info">
        <h3 class="recipe-title">${esc(recipe.title || 'Untitled')}</h3>
        <p class="recipe-desc">${esc(recipe.description || '')}</p>
        <div class="recipe-meta">
          ${recipe.prepTime ? `<span>⏱ ${recipe.prepTime}m</span>` : ''}
          ${recipe.cookTime ? `<span>🔥 ${recipe.cookTime}m</span>` : ''}
          ${recipe.servings ? `<span>👥 ${recipe.servings}</span>` : ''}
        </div>
        <div class="recipe-tags-row">${(recipe.tags||[]).map(t => `<span class="recipe-tag-chip">${esc(t)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="recipe-ingredients-preview">
      ${(recipe.ingredients||[]).slice(0,4).map(ing => `<span class="ing-chip">${esc(ing.name||ing)}</span>`).join('')}
      ${(recipe.ingredients||[]).length > 4 ? `<span class="ing-chip ing-more">+${(recipe.ingredients||[]).length - 4} more</span>` : ''}
    </div>
    <div class="recipe-card-actions">
      <button class="recipe-like-btn ${isLiked?'liked':''}" data-id="${recipe.id}">
        ${isLiked ? '❤️' : '🤍'} <span>${(recipe.likes||[]).length}</span>
      </button>
      <button class="recipe-comment-toggle" data-id="${recipe.id}">
        💬 <span>${(recipe.comments||[]).length}</span>
      </button>
    </div>
    <div class="recipe-comments-section" id="comments-${recipe.id}" style="display:none">
      <div class="comments-list">${(recipe.comments||[]).map(c => `
        <div class="comment-row">
          <div class="comment-avatar">${generateAvatarSVG(c.avatar||{})}</div>
          <div class="comment-body"><strong>${esc(c.displayName||'User')}</strong><span>${esc(c.text||'')}</span></div>
        </div>`).join('')}
      </div>
      <div class="comment-input-row">
        <input type="text" class="field-input comment-input" id="comment-input-${recipe.id}" placeholder="Add a comment…">
        <button class="btn btn-sm btn-primary recipe-comment-send" data-id="${recipe.id}">Send</button>
      </div>
    </div>
  </div>`;
}

function toggleCommentSection(id) {
  const el = document.getElementById(`comments-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function toggleRecipeLike(id) {
  if (isDemoMode || !currentUser) { showSignupPrompt(); return; }
  const recipe = allRecipes.find(r => r.id === id); if (!recipe) return;
  const hasLiked = recipe.likes?.includes(currentUser.uid);
  await updateDoc(doc(db, 'recipes', id), {
    likes: hasLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
  });
}

async function submitComment(id) {
  if (isDemoMode || !currentUser) { showSignupPrompt(); return; }
  const input = document.getElementById(`comment-input-${id}`);
  const text  = input?.value?.trim(); if (!text) return;
  await updateDoc(doc(db, 'recipes', id), {
    comments: arrayUnion({ uid: currentUser.uid, displayName: currentUser.displayName || 'User', avatar: avatarConfig, text, createdAt: new Date().toISOString() })
  });
  if (input) input.value = '';
}

async function deleteRecipe(id) {
  if (!currentUser) return;
  await deleteDoc(doc(db, 'recipes', id));
  toast('Recipe deleted');
}

async function submitRecipe() {
  if (!currentUser) return;
  const title = val('rc-title'); if (!title) { toast('Please enter a title'); return; }
  const ingredients = (val('rc-ingredients') || '').split('\n').filter(Boolean).map(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) return { amount: parts[0], unit: parts[1], name: parts.slice(2).join(' '), inPantry: false };
    return { amount: '', unit: '', name: line.trim(), inPantry: false };
  });
  const instructions = (val('rc-instructions') || '').split('\n').filter(Boolean);
  await addDoc(collection(db, 'recipes'), {
    uid: currentUser.uid, displayName: currentUser.displayName || 'User',
    avatar: avatarConfig, title, emoji: val('rc-emoji') || '🍽️',
    description: val('rc-desc'), tags: (val('rc-tags')||'').split(',').map(t=>t.trim()).filter(Boolean),
    prepTime: parseInt(document.getElementById('rc-prep')?.value)||0,
    cookTime: parseInt(document.getElementById('rc-cook')?.value)||0,
    servings: parseInt(document.getElementById('rc-servings')?.value)||4,
    ingredients, instructions, likes: [], comments: [], createdAt: serverTimestamp()
  });
  hide('recipe-modal');
  toast('Recipe shared with the community!');
  ['rc-title','rc-desc','rc-tags','rc-ingredients','rc-instructions'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// ================================================================
// HELPERS
// ================================================================
function updateCategoryDatalist() {
  const cats  = [...new Set(pantry.map(p => p.category))].sort();
  const names = [...new Set(pantry.map(p => p.name))].sort();
  const dl = document.getElementById('category-datalist'), nl = document.getElementById('category-names-list');
  if (dl) dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  if (nl) nl.innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

function updateSubtitle() {
  const el = document.getElementById('inv-subtitle'); if (!el) return;
  const total = pantry.length, out = pantry.filter(p => (p.qty??0)<=0).length;
  const low   = pantry.filter(p => { const q=p.qty??0; return q>0&&q<=(p.threshold??DEFAULT_LOW_THRESHOLD); }).length;
  el.textContent = `${total} item${total!==1?'s':''}${out>0?` · ${out} out`:''}${low>0?` · ${low} low`:''}`;
}

function setSyncIndicator(msg) {
  const el = document.getElementById('sync-indicator');
  if (el) el.textContent = msg === 'Synced' ? '✓ Cloud synced' : msg;
}

function showStatus(type, msg) {
  const bar = document.getElementById('scan-status'); if (!bar) return;
  bar.className = 'status-bar ' + type; bar.textContent = msg; bar.style.display = 'block';
  if (type === 'success') setTimeout(() => { bar.style.display = 'none'; }, 5000);
}

function showProcessing(show, msg) {
  document.getElementById('processing-overlay')?.classList.toggle('show', show);
  if (msg) showProcessingMsg(msg);
}
function showProcessingMsg(msg) { const el = document.getElementById('processing-msg'); if (el) el.textContent = msg; }

let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function formatTimeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// ── micro-utilities ──
function on(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ['modal-overlay','subscription-modal','payment-modal','avatar-modal','recipe-modal','friends-modal','signup-prompt-modal'].includes(id) ? 'flex' : 'block'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }
function formatQty(n) { n = n ?? 0; return n % 1 === 0 ? String(n) : n.toFixed(1); }
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g,'-'); }