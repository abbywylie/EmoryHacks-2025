// theme-loader.js
// Load and apply user's equipped theme across all pages

import { auth, db } from './script.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Theme definitions (must match gatcha.js)
const themes = {
    "theme-ocean": {
        cssVariables: {
            "--primary-color": "#0ea5e9",
            "--secondary-color": "#06b6d4",
            "--accent-color": "#22d3ee",
            "--bg-gradient-start": "#0c4a6e",
            "--bg-gradient-end": "#075985"
        }
    },
    "theme-forest": {
        cssVariables: {
            "--primary-color": "#10b981",
            "--secondary-color": "#059669",
            "--accent-color": "#34d399",
            "--bg-gradient-start": "#064e3b",
            "--bg-gradient-end": "#065f46"
        }
    },
    "theme-sunset": {
        cssVariables: {
            "--primary-color": "#f59e0b",
            "--secondary-color": "#d97706",
            "--accent-color": "#fbbf24",
            "--bg-gradient-start": "#78350f",
            "--bg-gradient-end": "#92400e"
        }
    },
    "theme-purple": {
        cssVariables: {
            "--primary-color": "#a855f7",
            "--secondary-color": "#9333ea",
            "--accent-color": "#c084fc",
            "--bg-gradient-start": "#581c87",
            "--bg-gradient-end": "#6b21a8"
        }
    }
};

export function applyTheme(themeId) {
    const theme = themes[themeId];
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

export function removeTheme() {
    const root = document.documentElement;
    root.style.removeProperty('--primary-color');
    root.style.removeProperty('--secondary-color');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--bg-gradient-start');
    root.style.removeProperty('--bg-gradient-end');
    document.body.style.background = 'radial-gradient(circle at top, #0f172a, #020617 55%)';
}

// Load and apply user's equipped theme
export async function loadUserTheme(userId) {
    try {
        const prefsRef = doc(db, 'users', userId, 'preferences', 'settings');
        const prefsSnap = await getDoc(prefsRef);
        
        if (prefsSnap.exists() && prefsSnap.data().equippedTheme) {
            const themeId = prefsSnap.data().equippedTheme;
            applyTheme(themeId);
        }
    } catch (error) {
        console.error("Error loading user theme:", error);
    }
}

// Load and apply user's equipped icon to navigation
export async function loadUserIcon(userId) {
    try {
        const prefsRef = doc(db, 'users', userId, 'preferences', 'settings');
        const prefsSnap = await getDoc(prefsRef);
        
        if (prefsSnap.exists() && prefsSnap.data().equippedIcon) {
            const equippedIconId = prefsSnap.data().equippedIcon;
            const iconSrc = `rewards/icons/${equippedIconId.replace('icon-', '')}.png`;
            
            // Update profile picture in navigation
            const profileImg = document.querySelector('#userInfo img[onclick*="profile.html"]');
            if (profileImg) {
                profileImg.src = iconSrc;
                profileImg.style.borderRadius = '50%';
            }
        }
    } catch (error) {
        console.error("Error loading user icon:", error);
    }
}

// Initialize theme on page load
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserTheme(user.uid);
        await loadUserIcon(user.uid);
    }
});

