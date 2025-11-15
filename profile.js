// Import Firebase Auth functions from script.js
import { signInWithGoogle, auth, signOutUser } from "./script.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
export async function loadIndexPage(){
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
                    const prefsRef = doc(db, 'users', user.uid, 'preferences', 'settings');
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
export function loadProfilePage(){
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
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
            const { db } = await import('./script.js');
            const prefsRef = doc(db, 'users', user.uid, 'preferences', 'settings');
            const prefsSnap = await getDoc(prefsRef);
            
            let iconSrc = null;
            if (prefsSnap.exists() && prefsSnap.data().equippedIcon) {
                const equippedIconId = prefsSnap.data().equippedIcon;
                iconSrc = `rewards/icons/${equippedIconId.replace('icon-', '')}.png`;
            }
            
            if (profilePictureEl) {
                if (iconSrc) {
                    profilePictureEl.innerHTML = `<img src="${iconSrc}" style="height: 100%; width: 100%; border-radius:50%; opacity: 1; object-fit: cover;"/>`
                } else if (user.photoURL) {
                    profilePictureEl.innerHTML = `<img src="${user.photoURL}" style="height: 100%; width: 100%; border-radius:50%; opacity: 1"/>`
                } else {
                    profilePictureEl.innerHTML = `<img src="/img/profile-btn.png" style="height: 100%; width: 100%; border-radius:50%; opacity: 1"/>`
                }
            }
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
async function googleSignOut(){
    try {
        await signOutUser();
        console.log("Signed out of this site.");
    window.location.replace("index.html");
    } catch (error) {
        console.error("Error signing out:", error);
    }
}

// Make handleCredentialResponse available globally for Google Sign-In
window.handleCredentialResponse = handleCredentialResponse;

document.addEventListener("DOMContentLoaded", () =>{
    const homeLink = document.getElementById("home-link");
    if (homeLink) {
        homeLink.addEventListener("click", () => {
            window.location.replace("index.html")
        });
    }
})