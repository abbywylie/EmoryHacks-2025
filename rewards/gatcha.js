// Minimal working gacha logic with:
// - machine shakes slow then fast
// - multiple balls bouncing and one random ball popping out
// - reward shown in a popup modal
// - Firebase integration for inventory and equipped items

import { auth, db } from '../script.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Avatar pool - names match the PNG filenames in icons/ folder
const rewardPool = [
    "Berry Bubble",
    "Blush Marble",
    "Citrus Puff",
    "Cloud Pop",
    "Frost Orb",
    "Glow Pearl",
    "Magenta Marble",
    "Mint Puff",
    "Moon Pearl",
    "Nebula Dot",
    "Pastel Blob",
    "Rose Pop",
    "Sky Dot",
    "Soft Orb",
    "Sun Bubble"
].map(name => ({
    name: name,
    type: "avatar",
    rarity: "common",
    iconSrc: `icons/${name}.png`
}));

// Add theme rewards
const themePool = [
    {
        name: "Ocean Breeze",
        type: "theme",
        rarity: "rare",
        iconSrc: "icons/Ocean Breeze.png",
        cssVariables: {
            "--primary-color": "#0ea5e9",
            "--secondary-color": "#06b6d4",
            "--accent-color": "#22d3ee",
            "--bg-gradient-start": "#0c4a6e",
            "--bg-gradient-end": "#075985"
        }
    },
    {
        name: "Forest Green",
        type: "theme",
        rarity: "rare",
        iconSrc: "icons/Forest Green.png",
        cssVariables: {
            "--primary-color": "#10b981",
            "--secondary-color": "#059669",
            "--accent-color": "#34d399",
            "--bg-gradient-start": "#064e3b",
            "--bg-gradient-end": "#065f46"
        }
    },
    {
        name: "Sunset Glow",
        type: "theme",
        rarity: "epic",
        iconSrc: "icons/Sunset Glow.png",
        cssVariables: {
            "--primary-color": "#f59e0b",
            "--secondary-color": "#d97706",
            "--accent-color": "#fbbf24",
            "--bg-gradient-start": "#78350f",
            "--bg-gradient-end": "#92400e"
        }
    },
    {
        name: "Purple Dream",
        type: "theme",
        rarity: "epic",
        iconSrc: "icons/Purple Dream.png",
        cssVariables: {
            "--primary-color": "#a855f7",
            "--secondary-color": "#9333ea",
            "--accent-color": "#c084fc",
            "--bg-gradient-start": "#581c87",
            "--bg-gradient-end": "#6b21a8"
        }
    }
];

// Combine all rewards - this is our reference pool
const allRewardPool = [...rewardPool, ...themePool];

let tickets = 0;
let inventory = [];
let equippedIcon = null;
let equippedTheme = null;
let currentUserId = null;

// Load user inventory and equipped items from Firestore
async function loadUserInventory(userId) {
    try {
        const inventoryRef = doc(db, 'users', userId, 'rewards', 'inventory');
        const inventorySnap = await getDoc(inventoryRef);

        if (inventorySnap.exists()) {
            const data = inventorySnap.data();
            inventory = data.items || []; // Array of item name strings
            equippedIcon = data.equippedIcon || null; // Item name string
            equippedTheme = data.equippedTheme || null; // Item name string

            // Apply equipped theme
            if (equippedTheme) {
                applyTheme(equippedTheme);
            }
        } else {
            // Initialize inventory
            await setDoc(inventoryRef, {
                items: [],
                equippedIcon: null,
                equippedTheme: null
            });
        }
    } catch (error) {
        console.error("Error loading inventory:", error);
    }
}

// Save inventory to Firestore
async function saveInventory(userId) {
    try {
        const inventoryRef = doc(db, 'users', userId, 'rewards', 'inventory');
        await updateDoc(inventoryRef, {
            items: inventory,
            equippedIcon: equippedIcon,
            equippedTheme: equippedTheme
        });
    } catch (error) {
        console.error("Error saving inventory:", error);
    }
}

// Equip an item (itemName is the string name of the item)
async function equipItem(itemName, itemType) {
    if (!currentUserId) return;

    if (itemType === 'avatar') {
        equippedIcon = itemName;
    } else if (itemType === 'theme') {
        equippedTheme = itemName;
        applyTheme(itemName);
    }

    await saveInventory(currentUserId);
    renderInventory();

    // Save equipped icon to user preferences for profile page
    const prefsRef = doc(db, 'users', currentUserId, 'preferences', 'settings');
    await setDoc(prefsRef, {
        equippedIcon: equippedIcon,
        equippedTheme: equippedTheme
    }, { merge: true });
}

// Unequip an item
async function unequipItem(itemType) {
    if (!currentUserId) return;

    if (itemType === 'avatar') {
        equippedIcon = null;
    } else if (itemType === 'theme') {
        equippedTheme = null;
        removeTheme();
    }

    await saveInventory(currentUserId);
    renderInventory();

    const prefsRef = doc(db, 'users', currentUserId, 'preferences', 'settings');
    await setDoc(prefsRef, {
        equippedIcon: equippedIcon,
        equippedTheme: equippedTheme
    }, { merge: true });
}

// Apply theme CSS variables (themeName is the string name)
function applyTheme(themeName) {
    const theme = getItemByName(themeName);
    if (!theme || !theme.cssVariables) return;

    const root = document.documentElement;
    Object.entries(theme.cssVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    // Update background gradient
    if (theme.cssVariables['--bg-gradient-start'] && theme.cssVariables['--bg-gradient-end']) {
        document.body.style.background = `radial-gradient(circle at top, ${theme.cssVariables['--bg-gradient-start']}, ${theme.cssVariables['--bg-gradient-end']} 55%)`;
    }
}

// Remove theme (reset to default)
function removeTheme() {
    const root = document.documentElement;
    root.style.removeProperty('--primary-color');
    root.style.removeProperty('--secondary-color');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--bg-gradient-start');
    root.style.removeProperty('--bg-gradient-end');
    document.body.style.background = 'radial-gradient(circle at top, #0f172a, #020617 55%)';
}

document.addEventListener("DOMContentLoaded", () => {
    const ticketCountEl = document.getElementById("ticket-count");
    const rollBtn = document.getElementById("roll-btn");
    const machineEl = document.getElementById("machine");
    const gumballs = document.querySelectorAll(".gumball");
    const inventoryGridEl = document.getElementById("inventory-grid");
    const homeLink = document.getElementById("home-link");

    // Home link click handler
    if (homeLink) {
        homeLink.addEventListener("click", () => {
            window.location.href = "../index.html";
        });
    }

    const rewardModal = document.getElementById("reward-modal");
    const modalCloseBtn = document.getElementById("modal-close");
    const modalBackdrop = document.getElementById("reward-backdrop");
    const modalRewardBody = document.getElementById("modal-reward-body");

    // Monitor auth state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            await loadUserInventory(user.uid);
            const userRef = doc(db, "Users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                tickets = data.points ?? 0;
                updateTickets
            } else {
                console.warn("User document not found, initializing with 0 tickets");
            }
            renderInventory();
        } else {
            currentUserId = null;
            inventory = [];
            equippedIcon = null;
            equippedTheme = null;
        }
    });

    function updateTickets() {
        if (ticketCountEl) ticketCountEl.textContent = tickets;
    }

    function renderInventory() {
        if (!inventoryGridEl) return;

        if (inventory.length === 0) {
            inventoryGridEl.innerHTML =
                '<div class="inventory-item"><span class="inventory-name">No rewards yet</span></div>';
            return;
        }

        inventoryGridEl.innerHTML = inventory
            .map(
                (itemName) => {
                    // Fetch item details from name
                    const item = getItemByName(itemName);
                    if (!item) return ''; // Skip if item not found

                    const isEquipped = (item.type === 'avatar' && equippedIcon === itemName) ||
                        (item.type === 'theme' && equippedTheme === itemName);
                    return `
          <div class="inventory-item ${isEquipped ? 'equipped' : ''}">
            <div class="inventory-item-header">
              <div class="inventory-icon">
                <img src="${item.iconSrc}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: contain;">
              </div>
              <div class="inventory-info">
                <div class="inventory-name">${item.name} ${isEquipped ? '✓' : ''}</div>
                <div class="inventory-type">${item.type} · ${item.rarity}</div>
              </div>
            </div>
            <div class="inventory-actions">
              ${isEquipped
                            ? `<button class="equip-btn unequip" data-item-name="${item.name}" data-item-type="${item.type}">Unequip</button>`
                            : `<button class="equip-btn" data-item-name="${item.name}" data-item-type="${item.type}">Equip</button>`
                        }
            </div>
          </div>
        `;
                }
            )
            .join("");

        // Add event listeners to equip buttons
        document.querySelectorAll('.equip-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const itemName = btn.dataset.itemName;
                const itemType = btn.dataset.itemType;

                if (btn.classList.contains('unequip')) {
                    await unequipItem(itemType);
                } else {
                    await equipItem(itemName, itemType);
                }
            });
        });
    }

    function makeRewardPillHTML(reward) {
        return `
      <div class="reward-pill">
        <div class="reward-icon">
          <img src="${reward.iconSrc}" alt="${reward.name}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        <div class="reward-meta">
          <span class="reward-name">${reward.name}</span>
          <span class="reward-type">${reward.type} · ${reward.rarity}</span>
        </div>
      </div>
    `;
    }

    function openRewardModal(reward) {
        if (!rewardModal) return;
        modalRewardBody.innerHTML = makeRewardPillHTML(reward);
        rewardModal.classList.remove("hidden");
    }

    function closeRewardModal() {
        if (!rewardModal) return;
        rewardModal.classList.add("hidden");
    }

    async function rollReward() {
        if (tickets <= 0) {
            alert("No tickets left – earn more by finishing study sessions!");
            return null;
        }

        tickets--;
        updateTickets();
        if (currentUserId) {
            const userRef = doc(db, "Users", currentUserId);
            await updateDoc(userRef, {
                points: tickets
            });
        }

        // Randomly choose between icon and theme (80% icon, 20% theme)
        const isTheme = Math.random() < 0.2;
        const pool = isTheme ? themePool : rewardPool;
        const idx = Math.floor(Math.random() * pool.length);
        const reward = pool[idx];

        // Add to inventory if not already (store just the name string)
        if (!inventory.includes(reward.name)) {
            inventory.push(reward.name);

            // Save to Firestore if logged in
            if (currentUserId) {
                await saveInventory(currentUserId);
            }

            renderInventory();
        }

        return reward;
    }

    // Close modal handlers
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", closeRewardModal);
    }
    if (modalBackdrop) {
        modalBackdrop.addEventListener("click", closeRewardModal);
    }

    // Click handler for roll
    rollBtn.addEventListener("click", async () => {
        if (tickets <= 0) {
            alert("No tickets left – earn more by finishing study sessions!");
            return;
        }

        rollBtn.disabled = true;

        // reset all ball classes
        gumballs.forEach((ball) => {
            ball.classList.remove("bounce-slow", "bounce-fast", "pop-out");
        });
        machineEl.classList.remove("shake-slow", "shake-fast");

        // Phase 1: slow shake + slow bounce
        void machineEl.offsetWidth;
        machineEl.classList.add("shake-slow");
        gumballs.forEach((ball) => ball.classList.add("bounce-slow"));

        // After ~1.5s, go faster
        setTimeout(() => {
            machineEl.classList.remove("shake-slow");
            gumballs.forEach((ball) => ball.classList.remove("bounce-slow"));

            void machineEl.offsetWidth;
            machineEl.classList.add("shake-fast");
            gumballs.forEach((ball) => ball.classList.add("bounce-fast"));
        }, 1500);

        // After ~2.5s total, stop + pop one random ball + show reward
        setTimeout(async () => {
            machineEl.classList.remove("shake-fast");
            gumballs.forEach((ball) => ball.classList.remove("bounce-fast"));

            if (gumballs.length > 0) {
                const randomIndex = Math.floor(Math.random() * gumballs.length);
                const chosenBall = gumballs[randomIndex];

                // pop that one out
                chosenBall.classList.remove("pop-out");
                void chosenBall.offsetWidth;
                chosenBall.classList.add("pop-out");
            }

            const reward = await rollReward();
            if (reward) {
                openRewardModal(reward);
            }

            rollBtn.disabled = false;
        }, 2500);
    });

    // initial render
    updateTickets();
    // renderInventory will be called after auth state is determined
});
