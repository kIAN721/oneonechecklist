import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
    initializeFirestore,
    doc,
    setDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ======================================
// 1. FIREBASE CLOUD CONFIG
// ======================================
const firebaseConfig = {
    apiKey: "AIzaSyCW4hXkBZwElR2FmvqiOyRbETzyiXrXips",
    authDomain: "my-little-guguchecklist.firebaseapp.com",
    projectId: "my-little-guguchecklist",
    storageBucket: "my-little-guguchecklist.firebasestorage.app",
    messagingSenderId: "630691137594",
    appId: "1:630691137594:web:74823b1c884ef29e1f0d03"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});

const sharedDocRef = doc(db, "rooms", "ship_voyage_main");
const STORAGE_KEY = "ship_voyage_checklist_v1";
const CAT_STORAGE_KEY = "ship_voyage_categories_v1";

// ======================================
// 2. SOUND EFFECTS (WEB AUDIO API)
// ======================================
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTone(freq, type, startTime, duration, maxGain = 0.14) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

function playCheckSound(isAllDone = false) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (isAllDone) {
        playTone(523.25, "triangle", now,        0.16, 0.13);
        playTone(659.25, "triangle", now + 0.09, 0.16, 0.13);
        playTone(783.99, "triangle", now + 0.18, 0.18, 0.13);
        playTone(1046.50, "sine",    now + 0.27, 0.42, 0.16);
    } else {
        playTone(659.25, "sine",     now,        0.16, 0.13);
        playTone(987.77, "triangle", now + 0.08, 0.26, 0.14);
    }
}

function playUncheckSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(523.25, "sine", now,        0.12, 0.09);
    playTone(392.00, "sine", now + 0.06, 0.16, 0.08);
}

// ======================================
// 3. DETAILED CATEGORIES & DEFAULT ITEMS
// ======================================
const defaultCategories = [
    { key: 'documents',   name: 'Documents & Certificates', icon: 'fa-id-card',        isDefault: true },
    { key: 'ppe',         name: 'Workwear & Deck PPE',      icon: 'fa-helmet-safety',  isDefault: true },
    { key: 'clothing',    name: 'Casual & Cold Gear',       icon: 'fa-shirt',          isDefault: true },
    { key: 'cabin',       name: 'Cabin & Bedding',          icon: 'fa-bed',            isDefault: true },
    { key: 'medical',     name: 'Medicine & First Aid',     icon: 'fa-kit-medical',    isDefault: true },
    { key: 'toiletries',  name: 'Toiletries & Grooming',    icon: 'fa-pump-soap',      isDefault: true },
    { key: 'electronics', name: 'Electronics & Media',      icon: 'fa-plug',           isDefault: true },
    { key: 'operational', name: 'Deck Tools & Navigation',  icon: 'fa-toolbox',        isDefault: true },
    { key: 'galley',      name: 'Snacks, Cash & Port Gear', icon: 'fa-mug-hot',        isDefault: true }
];

const defaultItems = [
    // Documents & Certificates
    { id: '1', text: 'Seaman’s Book (CDC) & Valid Passport', category: 'documents', completed: false },
    { id: '2', text: 'Valid Visas, Flag State Docs & Yellow Fever (ICCV)', category: 'documents', completed: false },
    { id: '3', text: 'Employment Contract & Joining Letter', category: 'documents', completed: false },
    { id: '4', text: 'STCW Certificates & Medical Fitness Certificate', category: 'documents', completed: false },
    { id: '23', text: 'Passport Photos & Spare Photocopies of All IDs', category: 'documents', completed: false },

    // Workwear & Deck PPE
    { id: '5', text: 'Safety Boots / Steel-toe Work Shoes', category: 'ppe', completed: false },
    { id: '6', text: 'Boiler Suits / Coveralls & High-Vis Vest', category: 'ppe', completed: false },
    { id: '24', text: 'Heavy-Duty Work Gloves & Safety Goggles', category: 'ppe', completed: false },

    // Casual & Cold Gear
    { id: '7', text: 'Heavy Jacket, Beanie & Thermal Base Layers', category: 'clothing', completed: false },
    { id: '8', text: 'Casual T-Shirts, Shorts & Jeans for Off-Duty', category: 'clothing', completed: false },
    { id: '9', text: 'Plenty of Underwear & Thick Work Socks', category: 'clothing', completed: false },
    { id: '10', text: 'Non-Slip Slide Sandals / Cabin Slippers', category: 'clothing', completed: false },

    // Cabin & Bedding
    { id: '20', text: 'Padlocks / Combination Locks for Cabin Locker', category: 'cabin', completed: false },
    { id: '25', text: 'Quick-Dry Bath Towel & Face Towel', category: 'cabin', completed: false },
    { id: '26', text: 'Laundry Bag & Clothes Hangers / Clips', category: 'cabin', completed: false },

    // Medicine & First Aid
    { id: '11', text: 'Personal Medications (Full Contract Duration + Extra)', category: 'medical', completed: false },
    { id: '12', text: 'Seasickness Pills, Painkillers & Cold Medicine', category: 'medical', completed: false },
    { id: '27', text: 'Plasters, Antiseptic Cream, Eye Drops & Vitamins', category: 'medical', completed: false },

    // Toiletries & Grooming
    { id: '13', text: 'Shampoo, Body Wash, Toothbrush & Toothpaste (Multipack)', category: 'toiletries', completed: false },
    { id: '14', text: 'Polarized Sunglasses, Lip Balm & UV Sunscreen', category: 'toiletries', completed: false },
    { id: '28', text: 'Nail Clipper, Razor / Trimmer & Extra Blades', category: 'toiletries', completed: false },

    // Electronics & Media
    { id: '15', text: 'Smartphone & Extra Braided Charger Cables', category: 'electronics', completed: false },
    { id: '16', text: 'Universal Travel Adapter & Multi-Socket Extension Cord', category: 'electronics', completed: false },
    { id: '17', text: 'High-Capacity Power Bank & Earbuds/Headphones', category: 'electronics', completed: false },
    { id: '18', text: 'External Hard Drive (Offline Movies, Music & Courses)', category: 'electronics', completed: false },

    // Deck Tools & Navigation
    { id: '19', text: 'Multitool / Rigging Knife (Pack in Checked Baggage!)', category: 'operational', completed: false },
    { id: '21', text: 'Waterproof Pocket Notebook & Permanent Markers/Pens', category: 'operational', completed: false },
    { id: '29', text: 'Rechargeable LED Flashlight / Headlamp', category: 'operational', completed: false },

    // Snacks, Cash & Port Gear
    { id: '22', text: 'USD Cash (Crisp New Notes) & International Card for Ports', category: 'galley', completed: false },
    { id: '30', text: 'Insulated Tumbler / Thermos Flask for Watchkeeping', category: 'galley', completed: false },
    { id: '31', text: '3-in-1 Coffee/Tea Mix, Instant Noodles & Favorite Snacks', category: 'galley', completed: false }
];

// Upgrade existing items cleanly if they match specific PPE/Cabin/Medical/Galley keywords
function autoUpgradeCategories(itemList) {
    itemList.forEach(item => {
        const t = (item.text || "").toLowerCase();
        if (item.category === 'clothing' && (t.includes('safety boots') || t.includes('steel-toe') || t.includes('coveralls') || t.includes('high-vis'))) {
            item.category = 'ppe';
        } else if (item.category === 'toiletries' && (t.includes('medication') || t.includes('motion sickness') || t.includes('first-aid') || t.includes('pills'))) {
            item.category = 'medical';
        } else if (item.category === 'operational' && (t.includes('padlock') || t.includes('locker'))) {
            item.category = 'cabin';
        } else if (item.category === 'operational' && (t.includes('currencies') || t.includes('usd cash'))) {
            item.category = 'galley';
        }
    });
}

function mergeCategories(savedCats) {
    const merged = [...defaultCategories];
    if (Array.isArray(savedCats)) {
        savedCats.forEach(cat => {
            if (cat && cat.key && !merged.some(m => m.key === cat.key)) {
                merged.push(cat);
            }
        });
    }
    return merged;
}

function loadLocalCategories() {
    try {
        const saved = localStorage.getItem(CAT_STORAGE_KEY);
        if (saved) return mergeCategories(JSON.parse(saved));
    } catch (e) {
        console.warn(e);
    }
    return [...defaultCategories];
}

function loadLocalItems() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn(e);
    }
    return JSON.parse(JSON.stringify(defaultItems));
}

let categories = loadLocalCategories();
let items = loadLocalItems();
let activeCategory = 'all';
let editingItemId = null;

function sortItems(listToSort) {
    const orderKeys = categories.map(c => c.key);
    listToSort.sort((a, b) => {
        const catA = orderKeys.indexOf(a.category);
        const catB = orderKeys.indexOf(b.category);
        const validA = catA === -1 ? 999 : catA;
        const validB = catB === -1 ? 999 : catB;
        if (validA !== validB) return validA - validB;
        if (Boolean(a.completed) !== Boolean(b.completed)) {
            return a.completed ? 1 : -1;
        }
        return (a.text || "").localeCompare(b.text || "", undefined, { numeric: true, sensitivity: "base" });
    });
}

// DOM Elements
const container = document.getElementById('checklist-container');
const tabsContainer = document.getElementById('category-tabs');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const progressBar = document.getElementById('progress-bar');
const customInput = document.getElementById('custom-item-input');
const customCategory = document.getElementById('custom-item-category');
const addItemBtn = document.getElementById('add-item-btn');
const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const syncStatus = document.getElementById('sync-status');

// Category Modal Elements
const catModal = document.getElementById('category-modal');
const openCatModalBtn = document.getElementById('open-cat-modal-btn');
const cancelCatBtn = document.getElementById('cancel-cat-btn');
const saveCatBtn = document.getElementById('save-cat-btn');
const newCatNameInput = document.getElementById('new-cat-name');
const newCatIconSelect = document.getElementById('new-cat-icon');

// Edit Item Modal Elements
const editModal = document.getElementById('edit-item-modal');
const editItemText = document.getElementById('edit-item-text');
const editItemCat = document.getElementById('edit-item-category');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');

function setSyncStatus(state, msg) {
    if (syncStatus) {
        syncStatus.className = `sync-badge ${state}`;
        const icon = state === 'synced' ? 'fa-cloud' : (state === 'syncing' ? 'fa-rotate fa-spin' : 'fa-hard-drive');
        syncStatus.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    }
}

setSyncStatus('syncing', 'Connecting...');

// ======================================
// 4. CLOUD SAVE & REAL-TIME SNAPSHOT
// ======================================
async function saveAndSync() {
    sortItems(items);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(categories));
    } catch (e) {
        console.warn(e);
    }

    renderAll();

    try {
        setSyncStatus('syncing', 'Saving...');
        await setDoc(sharedDocRef, {
            items,
            categories,
            updatedAt: new Date().toISOString()
        });
        setSyncStatus('synced', 'Cloud Synced ⚓');
    } catch (err) {
        console.error("Cloud Sync Error:", err);
        setSyncStatus('offline', 'Offline (Saved Locally)');
    }
}

onSnapshot(
    sharedDocRef,
    snapshot => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            let needsUpgradeSave = false;

            if (Array.isArray(data.categories) && data.categories.length > 0) {
                categories = mergeCategories(data.categories);
            } else {
                categories = mergeCategories(categories);
                needsUpgradeSave = true;
            }

            if (Array.isArray(data.items) && data.items.length > 0) {
                items = data.items;
                // If migrating from the old 5-category setup for the first time,
                // neatly sort default PPE/Medical/Cabin/Galley items into the new categories
                if (!data.categories) {
                    autoUpgradeCategories(items);
                    needsUpgradeSave = true;
                }
            }

            sortItems(items);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(categories));
            renderAll();
            setSyncStatus('synced', 'Cloud Synced ⚓');

            if (needsUpgradeSave) {
                saveAndSync();
            }
        } else {
            saveAndSync();
        }
    },
    err => {
        console.error("Snapshot Error:", err);
        setSyncStatus('offline', 'Offline (Saved Locally)');
    }
);

// ======================================
// 5. RENDER TABS, DROPDOWNS & CHECKLIST
// ======================================
function renderTabsAndSelects() {
    // 1. Render Filter Tabs
    tabsContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `tab-btn ${activeCategory === 'all' ? 'active' : ''}`;
    allBtn.innerHTML = `<span>All Items</span> <span class="tab-count">${items.length}</span>`;
    allBtn.addEventListener('click', () => {
        activeCategory = 'all';
        renderAll();
    });
    tabsContainer.appendChild(allBtn);

    categories.forEach(cat => {
        const count = items.filter(i => i.category === cat.key).length;
        const btn = document.createElement('button');
        btn.className = `tab-btn ${activeCategory === cat.key ? 'active' : ''}`;
        btn.innerHTML = `
            <i class="fa-solid ${cat.icon}"></i>
            <span>${cat.name}</span>
            <span class="tab-count">${count}</span>
        `;
        btn.addEventListener('click', () => {
            activeCategory = cat.key;
            renderAll();
        });
        tabsContainer.appendChild(btn);
    });

    // 2. Render Category Dropdowns (Add bar + Edit modal)
    const currentSelected = customCategory.value;
    customCategory.innerHTML = '';
    editItemCat.innerHTML = '';

    categories.forEach(cat => {
        const opt1 = document.createElement('option');
        opt1.value = cat.key;
        opt1.textContent = cat.name;
        customCategory.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = cat.key;
        opt2.textContent = cat.name;
        editItemCat.appendChild(opt2);
    });

    if (categories.some(c => c.key === currentSelected)) {
        customCategory.value = currentSelected;
    } else if (activeCategory !== 'all') {
        customCategory.value = activeCategory;
    }
}

function renderChecklist() {
    sortItems(items);
    container.innerHTML = '';

    const filteredItems = activeCategory === 'all'
        ? items
        : items.filter(item => item.category === activeCategory);

    const catsToDisplay = activeCategory === 'all'
        ? categories
        : categories.filter(c => c.key === activeCategory);

    catsToDisplay.forEach(cat => {
        const catItems = filteredItems.filter(item => item.category === cat.key);
        // On "All Items" view, hide empty categories to keep the page clean
        if (catItems.length === 0 && activeCategory === 'all') return;

        const section = document.createElement('div');
        section.className = 'category-section';

        const doneCount = catItems.filter(i => i.completed).length;
        const header = document.createElement('div');
        header.className = 'category-header';

        const deleteCatButtonHtml = !cat.isDefault
            ? `<button class="del-cat-btn" data-catkey="${cat.key}" title="Delete custom category"><i class="fa-solid fa-xmark"></i></button>`
            : '';

        header.innerHTML = `
            <span style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid ${cat.icon}"></i> ${cat.name}
            </span>
            <div class="cat-header-actions">
                <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
                    ${doneCount} / ${catItems.length} packed
                </span>
                ${deleteCatButtonHtml}
            </div>
        `;
        section.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'item-list';

        if (catItems.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.style.padding = '12px 0';
            emptyLi.style.color = 'var(--text-muted)';
            emptyLi.style.fontSize = '0.9rem';
            emptyLi.textContent = 'No items in this category yet. Use the bar above to add one!';
            ul.appendChild(emptyLi);
        } else {
            catItems.forEach(item => {
                const li = document.createElement('li');
                li.className = `item-row ${item.completed ? 'completed' : ''}`;
                li.innerHTML = `
                    <label class="item-label">
                        <input type="checkbox" ${item.completed ? 'checked' : ''} data-id="${item.id}">
                        <span>${item.text}</span>
                    </label>
                    <div style="display:flex; gap:6px;">
                        <button class="delete-btn edit-btn" data-id="${item.id}" title="Edit Item or Move Category"><i class="fa-solid fa-pen"></i></button>
                        <button class="delete-btn remove-btn" data-id="${item.id}" title="Delete Item"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;
                ul.appendChild(li);
            });
        }

        section.appendChild(ul);
        container.appendChild(section);
    });

    updateProgress();
    attachEventListeners();
}

function renderAll() {
    renderTabsAndSelects();
    renderChecklist();
}

function updateProgress() {
    const total = items.length;
    const completed = items.filter(i => i.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    progressText.textContent = `${completed} / ${total} Completed`;
    progressPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
}

// ======================================
// 6. INTERACTIONS & MODALS
// ======================================
function attachEventListeners() {
    // Check / Uncheck item
    document.querySelectorAll('.item-label input[type="checkbox"]').forEach(box => {
        box.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const item = items.find(i => i.id === id);
            if (item) {
                item.completed = e.target.checked;
                if (item.completed) {
                    const allDone = items.length > 0 && items.every(i => i.completed);
                    playCheckSound(allDone);
                } else {
                    playUncheckSound();
                }
                saveAndSync();
            }
        });
    });

    // Open Edit Item Modal (allows changing text AND category)
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const item = items.find(i => i.id === id);
            if (!item) return;

            editingItemId = id;
            editItemText.value = item.text;
            editItemCat.value = item.category;
            editModal.classList.add('show');
            editItemText.focus();
        });
    });

    // Delete Item
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const item = items.find(i => i.id === id);
            if (item && confirm(`Delete "${item.text}"?`)) {
                items = items.filter(i => i.id !== id);
                saveAndSync();
            }
        });
    });

    // Delete Custom Category
    document.querySelectorAll('.del-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const catKey = e.currentTarget.getAttribute('data-catkey');
            const cat = categories.find(c => c.key === catKey);
            if (!cat) return;

            if (confirm(`Delete custom category "${cat.name}"? (Any items inside will be moved to Documents & Certificates)`)) {
                items.forEach(i => {
                    if (i.category === catKey) i.category = 'documents';
                });
                categories = categories.filter(c => c.key !== catKey);
                if (activeCategory === catKey) activeCategory = 'all';
                saveAndSync();
            }
        });
    });
}

// Add Custom Item
addItemBtn.addEventListener('click', () => {
    const text = customInput.value.trim();
    if (!text) return;

    items.push({
        id: "ship_" + Date.now(),
        text: text,
        category: customCategory.value,
        completed: false
    });

    customInput.value = '';
    playCheckSound(false);
    saveAndSync();
});

customInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addItemBtn.click();
});

// Create New Category Modal Logic
openCatModalBtn.addEventListener('click', () => {
    newCatNameInput.value = '';
    catModal.classList.add('show');
    newCatNameInput.focus();
});

cancelCatBtn.addEventListener('click', () => {
    catModal.classList.remove('show');
});

saveCatBtn.addEventListener('click', () => {
    const name = newCatNameInput.value.trim();
    if (!name) return;

    const key = 'custom_' + Date.now();
    const icon = newCatIconSelect.value || 'fa-box-open';

    categories.push({
        key,
        name,
        icon,
        isDefault: false
    });

    activeCategory = key;
    customCategory.value = key;
    catModal.classList.remove('show');
    playCheckSound(false);
    saveAndSync();
});

newCatNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveCatBtn.click();
});

// Edit Item Modal Logic
cancelEditBtn.addEventListener('click', () => {
    editModal.classList.remove('show');
    editingItemId = null;
});

saveEditBtn.addEventListener('click', () => {
    if (!editingItemId) return;
    const item = items.find(i => i.id === editingItemId);
    const newText = editItemText.value.trim();
    if (item && newText) {
        item.text = newText;
        item.category = editItemCat.value;
        playCheckSound(false);
        saveAndSync();
    }
    editModal.classList.remove('show');
    editingItemId = null;
});

editItemText.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveEditBtn.click();
});

// Reset Checklist (Uncheck All or Add Missing Default Items)
resetBtn.addEventListener('click', () => {
    if (confirm('Uncheck ALL items? (Click Cancel if you want to add the new expanded ship default items without losing your custom items)')) {
        items.forEach(i => { i.completed = false; });
        playUncheckSound();
        saveAndSync();
    } else if (confirm('Add any missing default ship items to your current list? (Your custom added items will stay safe!)')) {
        const existingTexts = new Set(items.map(i => (i.text || "").toLowerCase()));
        defaultItems.forEach(defItem => {
            if (!existingTexts.has(defItem.text.toLowerCase())) {
                items.push({ ...defItem, id: 'def_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) });
            }
        });
        playCheckSound(false);
        saveAndSync();
    }
});

// Export Progress as text file
exportBtn.addEventListener('click', () => {
    sortItems(items);
    let output = "=== VOYAGE PACKING CHECKLIST ===\n\n";
    categories.forEach(cat => {
        const catItems = items.filter(i => i.category === cat.key);
        if (catItems.length > 0) {
            output += `[${cat.name}]\n`;
            catItems.forEach(i => {
                output += `${i.completed ? '[x]' : '[ ]'} ${i.text}\n`;
            });
            output += "\n";
        }
    });

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ship_voyage_checklist.txt';
    a.click();
    URL.revokeObjectURL(url);
});

// Initial Render
renderAll();