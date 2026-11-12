import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
    initializeFirestore,
    doc,
    setDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ======================================
// 1. FIREBASE CLOUD CONFIG (SAME PROJECT, SEPARATE ROOM)
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

// Uses the "rooms" collection so your existing Firebase rules allow it,
// but saves under "ship_voyage_main" so it stays 100% separate from "gugu_shared_main"!
const sharedDocRef = doc(db, "rooms", "ship_voyage_main");
const STORAGE_KEY = "ship_voyage_checklist_v1";

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
        playTone(523.25, "triangle", now,        0.16, 0.13); // C5
        playTone(659.25, "triangle", now + 0.09, 0.16, 0.13); // E5
        playTone(783.99, "triangle", now + 0.18, 0.18, 0.13); // G5
        playTone(1046.50, "sine",    now + 0.27, 0.42, 0.16); // C6
    } else {
        playTone(659.25, "sine",     now,        0.16, 0.13); // E5
        playTone(987.77, "triangle", now + 0.08, 0.26, 0.14); // B5
    }
}

function playUncheckSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(523.25, "sine", now,        0.12, 0.09); // C5
    playTone(392.00, "sine", now + 0.06, 0.16, 0.08); // G4
}

// ======================================
// 3. DEFAULT VOYAGE ITEMS & CATEGORIES
// ======================================
const defaultItems = [
    { id: '1', text: 'Seaman’s Book / CDC & Passport', category: 'documents', completed: false },
    { id: '2', text: 'Valid Visas & Vaccination Card (ICCV)', category: 'documents', completed: false },
    { id: '3', text: 'Contract / Letter of Employment', category: 'documents', completed: false },
    { id: '4', text: 'Safety Familiarization & STCW Certificates', category: 'documents', completed: false },
    
    { id: '5', text: 'Safety Boots / Steel-toe Work Shoes', category: 'clothing', completed: false },
    { id: '6', text: 'Coveralls / Workwear & High-Vis Vest', category: 'clothing', completed: false },
    { id: '7', text: 'Heavy Jackets / Thermal Wear (Cold Weather Runs)', category: 'clothing', completed: false },
    { id: '8', text: 'Casual Clothes for Off-Duty Hours', category: 'clothing', completed: false },
    { id: '9', text: 'Underwear & Heavy Socks', category: 'clothing', completed: false },
    { id: '10', text: 'Slide Sandals / Slippers for Cabin', category: 'clothing', completed: false },

    { id: '11', text: 'Personal Medications (sufficient for duration + extra)', category: 'toiletries', completed: false },
    { id: '12', text: 'Motion Sickness Patches / Pills', category: 'toiletries', completed: false },
    { id: '13', text: 'Shampoo, Soap, Toothbrush & Toothpaste', category: 'toiletries', completed: false },
    { id: '14', text: 'Sunglasses & UV Sunscreen', category: 'toiletries', completed: false },

    { id: '15', text: 'Smartphone & Heavy-Duty Charger Cable', category: 'electronics', completed: false },
    { id: '16', text: 'Universal Plug Adapter', category: 'electronics', completed: false },
    { id: '17', text: 'Power Bank', category: 'electronics', completed: false },
    { id: '18', text: 'Offline Music/Movie Downloads & E-reader', category: 'electronics', completed: false },

    { id: '19', text: 'Multitool / Pocket Knife (checked baggage rule applies)', category: 'operational', completed: false },
    { id: '20', text: 'Padlocks for Cabin Locker / Luggage', category: 'operational', completed: false },
    { id: '21', text: 'Notebook and Waterproof Pens', category: 'operational', completed: false },
    { id: '22', text: 'Local Currencies / USD Cash for Ports', category: 'operational', completed: false }
];

const categoryOrder = ['documents', 'clothing', 'toiletries', 'electronics', 'operational'];

const categoryNames = {
    documents: { name: 'Documents & ID', icon: 'fa-id-card' },
    clothing: { name: 'Clothing & Gear', icon: 'fa-shirt' },
    toiletries: { name: 'Toiletries & Health', icon: 'fa-kit-medical' },
    electronics: { name: 'Electronics', icon: 'fa-plug' },
    operational: { name: 'Operational & Tools', icon: 'fa-toolbox' }
};

function sortItems(listToSort) {
    listToSort.sort((a, b) => {
        const catA = categoryOrder.indexOf(a.category);
        const catB = categoryOrder.indexOf(b.category);
        if (catA !== catB) return catA - catB;
        if (Boolean(a.completed) !== Boolean(b.completed)) {
            return a.completed ? 1 : -1;
        }
        return (a.text || "").localeCompare(b.text || "", undefined, { numeric: true, sensitivity: "base" });
    });
}

function loadLocalItems() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                sortItems(parsed);
                return parsed;
            }
        }
    } catch (e) {
        console.warn(e);
    }
    const copy = JSON.parse(JSON.stringify(defaultItems));
    sortItems(copy);
    return copy;
}

let items = loadLocalItems();
let activeCategory = 'all';

// DOM Elements
const container = document.getElementById('checklist-container');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const progressBar = document.getElementById('progress-bar');
const customInput = document.getElementById('custom-item-input');
const customCategory = document.getElementById('custom-item-category');
const addItemBtn = document.getElementById('add-item-btn');
const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const tabs = document.querySelectorAll('.tab-btn');
const subtitle = document.querySelector('.subtitle');
const syncStatus = document.getElementById('sync-status');

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
    } catch (e) {
        console.warn(e);
    }

    render();

    try {
        setSyncStatus('syncing', 'Saving...');
        await setDoc(sharedDocRef, {
            items,
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
            if (Array.isArray(data.items) && data.items.length > 0) {
                items = data.items;
                sortItems(items);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
                render();
                setSyncStatus('synced', 'Cloud Synced ⚓');
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
// 5. RENDER UI & EVENT LISTENERS
// ======================================
function render() {
    sortItems(items);
    container.innerHTML = '';
    
    const filteredItems = activeCategory === 'all' 
        ? items 
        : items.filter(item => item.category === activeCategory);

    const categoriesToDisplay = activeCategory === 'all' 
        ? Object.keys(categoryNames) 
        : [activeCategory];

    categoriesToDisplay.forEach(catKey => {
        const catItems = filteredItems.filter(item => item.category === catKey);
        if (catItems.length === 0 && activeCategory !== 'all') return;

        const section = document.createElement('div');
        section.className = 'category-section';

        const doneCount = catItems.filter(i => i.completed).length;
        const header = document.createElement('div');
        header.className = 'category-header';
        header.style.justifyContent = 'space-between';
        header.innerHTML = `
            <span style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid ${categoryNames[catKey].icon}"></i> ${categoryNames[catKey].name}
            </span>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
                ${doneCount} / ${catItems.length} packed
            </span>
        `;
        section.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'item-list';

        if (catItems.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.style.padding = '10px 0';
            emptyLi.style.color = 'var(--text-muted)';
            emptyLi.style.fontSize = '0.9rem';
            emptyLi.textContent = 'No items in this category.';
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
                        <button class="delete-btn edit-btn" data-id="${item.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="delete-btn remove-btn" data-id="${item.id}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
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

function updateProgress() {
    const total = items.length;
    const completed = items.filter(i => i.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    progressText.textContent = `${completed} / ${total} Completed`;
    progressPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
}

function attachEventListeners() {
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

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const item = items.find(i => i.id === id);
            if (!item) return;
            const newText = prompt('Edit item:', item.text);
            if (newText !== null && newText.trim() !== '') {
                item.text = newText.trim();
                playCheckSound(false);
                saveAndSync();
            }
        });
    });

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

// Category Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        activeCategory = e.target.getAttribute('data-category');
        render();
    });
});

// Reset Checklist (Uncheck All or Restore Defaults)
resetBtn.addEventListener('click', () => {
    if (confirm('Uncheck ALL items? (Click Cancel if you want to restore deleted default items instead)')) {
        items.forEach(i => { i.completed = false; });
        playUncheckSound();
        saveAndSync();
    } else if (confirm('Restore default ship checklist items?')) {
        items = JSON.parse(JSON.stringify(defaultItems));
        playUncheckSound();
        saveAndSync();
    }
});

// Export Progress as text file
exportBtn.addEventListener('click', () => {
    sortItems(items);
    let output = "=== VOYAGE PACKING CHECKLIST ===\n\n";
    Object.keys(categoryNames).forEach(catKey => {
        const catItems = items.filter(i => i.category === catKey);
        if (catItems.length > 0) {
            output += `[${categoryNames[catKey].name}]\n`;
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
render();