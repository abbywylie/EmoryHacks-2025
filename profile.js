// Import Firebase Auth functions from script.js
import { signInWithGoogle, auth, db } from "./script.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { applyTheme } from "./rewards/gatcha.js";


const firebaseConfig = {
    apiKey: "AIzaSyAkZiKfWJjMv-rcl-QIZb14m8BJhCbiB18",
    authDomain: "hackathon2025-8af8d.firebaseapp.com",
    projectId: "hackathon2025-8af8d",
    storageBucket: "hackathon2025-8af8d.firebasestorage.app",
    messagingSenderId: "1046790183508",
    appId: "1:1046790183508:web:e45a9c8c6352c2a70a6bc1",
    measurementId: "G-Y5HPZKDKQD"
};

async function handleCredentialResponse(response) {
    // Google sends back a JWT token
    const jwt = response.credential;

    console.log("JWT ID Token:", jwt);

    try {
        // Sign in with Firebase using the credential
        const user = await signInWithGoogle(jwt);
        console.log("Signed in with Firebase:", user);

        window.location.replace("index.html");
    } catch (error) {
        console.error("Error signing in:", error);
        alert("Failed to sign in. Please try again.");
    }
}
export async function loadIndexPage() {
    // if (localStorage.getItem("logged-in") == null){
    //     return;
    // }

    // Use Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userInfoEl = document.getElementById("userInfo");
            if (userInfoEl) {
                // Try to load equipped icon
                let iconSrc = '/img/profile-btn.png';
                try {
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
                    const { db } = await import('./script.js');
                    const prefsRef = doc(db, 'Users', user.uid, 'preferences', 'settings');
                    const prefsSnap = await getDoc(prefsRef);

                    if (prefsSnap.exists() && prefsSnap.data().equippedIcon) {
                        const equippedIconId = prefsSnap.data().equippedIcon;
                        iconSrc = `rewards/icons/${equippedIconId.replace('icon-', '')}.png`;
                    }
                } catch (error) {
                    console.error("Error loading equipped icon:", error);
                }

                userInfoEl.innerHTML = `
                    <p class="right-aligned">Welcome, <strong>${user.displayName || user.email}</strong><input type="image" src="${iconSrc}" id="nav-profile-img" style="width:50px; height:50px; border-radius:50%; object-fit:cover;" onclick='window.location.replace("profile.html")'/></p>
                `;
            }

            const signInEl = document.getElementById("signIn");
            if (signInEl) {
                signInEl.remove();
            }
        }
    });
}
export function loadProfilePage() {
    console.log("Logged in :thumbsup:");

    // Use Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.error("No user found");
            return;
        }

        const profileNameEl = document.getElementById("profile-name");
        const profilePictureEl = document.getElementById("profile-picture");
        const profileEmailEl = document.getElementById("profile-email");

        if (profileNameEl) {
            profileNameEl.innerHTML = user.displayName || user.email || "Your Name";
        }

        // Load equipped icon from Firestore
        try {
            const userInfo = (await getDoc(doc(db, 'Users', user.uid))).data();

            const rewards = userInfo.rewards;
            const equippedIcon = rewards.equippedIcon;

            let iconSrc = `./rewards/icons/${equippedIcon}.png`;

            if (profilePictureEl) {
                if (iconSrc) {
                    profilePictureEl.innerHTML = `<img src="${iconSrc}" style="height: 100%; width: 100%; border-radius:50%; opacity: 1; object-fit: cover;"/>`
                } else if (user.photoURL) {
                    profilePictureEl.innerHTML = `<img src="${user.photoURL}" style="height: 100%; width: 100%; border-radius:50%; opacity: 1"/>`
                } else {
                    profilePictureEl.innerHTML = `<img src="/img/profile-btn.png" style="height: 100%; width: 100%; border-radius:50%; opacity: 1"/>`
                }
            }

            const pictureSelection = document.getElementById("profile-picture-selection")
            const selectionContainer = pictureSelection.querySelector("div");

            const items = rewards.items;
            const icons = [];

            // Filter obtained avatars from inventory
            for (var i of items) {
                if (i.includes("icon-")) {
                    icons.push(i);
                }
            }

            console.log("Available icons:", icons);
            console.log("Picture selection element:", pictureSelection);

            // Clear previous options and add current ones
            selectionContainer.innerHTML = "";
            
            for (var i of icons) {
                const reformattedIconName = i.replace("icon-", "").replace(" ", "%20");
                const isEquipped = equippedIcon === i ? "equipped" : "";
                selectionContainer.insertAdjacentHTML("beforeend", `<img src="./rewards/icons/${reformattedIconName}.png" class="profile-option ${isEquipped}" data-icon-id="${i}" style="width:80px; height:80px; border-radius:50%; cursor:pointer; border: ${equippedIcon === i ? '3px solid #3b82f6' : '3px solid transparent'}; transition: all 0.2s ease;"></img>`);
            }

            // Make the profile picture clickable to toggle selection panel
            if (profilePictureEl) {
                profilePictureEl.style.cursor = "pointer";
                
                // Remove any existing listeners by cloning the element
                const newProfilePictureEl = profilePictureEl.cloneNode(true);
                profilePictureEl.parentNode.replaceChild(newProfilePictureEl, profilePictureEl);
                
                newProfilePictureEl.addEventListener("click", function(e) {
                    console.log("Profile picture clicked!");
                    if (pictureSelection.style.display === "none" || pictureSelection.style.display === "") {
                        pictureSelection.style.display = "block";
                        console.log("Showing avatar selection");
                    } else {
                        pictureSelection.style.display = "none";
                        console.log("Hiding avatar selection");
                    }
                });
            }

            document.querySelectorAll(".profile-option").forEach(img => {
                img.addEventListener("click", function(e) {
                    e.stopPropagation();
                    const iconId = this.getAttribute("data-icon-id");
                    console.log("Selected avatar:", iconId);
                    userInfo.rewards.equippedIcon = iconId;
                    setDoc(doc(db, "Users", user.uid), userInfo).then(function () {
                        window.location.replace("./profile.html");
                    });
                });
            });
        } catch (error) {
            console.error("Error loading equipped icon:", error);
            // Fallback to default
            if (profilePictureEl) {
                if (user.photoURL) {
                    profilePictureEl.innerHTML = `<img src="${user.photoURL}" style="height: 100%; width: 100%; border-radius:50%; opacity: 1"/>`
                } else {
                    profilePictureEl.innerHTML = `<img src="/img/profile-btn.png" style="height: 100%; width: 100%; border-radius:50%; opacity: 1"/>`
                }
            }
        }

        if (profileEmailEl) {
            profileEmailEl.innerHTML = user.email || "email@example.com";
        }
    });
}
async function googleSignOut() {
    try {
        await signOut(auth);
        console.log("Signed out of this site.");
        window.location.replace("index.html");
    } catch (error) {
        console.error("Error signing out:", error);
    }
}

// Make handleCredentialResponse available globally for Google Sign-In
window.handleCredentialResponse = handleCredentialResponse;

document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", googleSignOut);
    }
    const homeLink = document.getElementById("home-link");
    if (homeLink) {
        homeLink.addEventListener("click", () => {
            window.location.replace("index.html")
        });
    }

    applyTheme();
})

