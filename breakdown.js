// breakdown.js
import { auth, db } from './script.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// This will hold the user's actual scores loaded from Firebase
let userData = {
    math: {
        totalScore: 200,
        skills: [
            { name: "Algebra", percentage: "35% of section, 13-15 questions", performance: "200-800", score: 200 },
            { name: "Advanced Math", percentage: "35% of section, 13-15 questions", performance: "200-800", score: 200 },
            { name: "Problem-Solving and Data Analysis", percentage: "15% of section, 5-7 questions", performance: "200-800", score: 200 },
            { name: "Geometry and Trigonometry", percentage: "15% of section, 5-7 questions", performance: "200-800", score: 200 }
        ]
    },
    reading: {
        totalScore: 200,
        skills: [
            { name: "Craft & Structure", percentage: "28% of section, 13-15 questions", performance: "200-800", score: 200 },
            { name: "Information and Ideas", percentage: "26% of section, 12-14 questions", performance: "200-800", score: 200 },
            { name: "Conventions of Standard English", percentage: "26% of section, 11-15 questions", performance: "200-800", score: 200 },
            { name: "Expression of Ideas", percentage: "20% of section, 8-12 questions", performance: "200-800", score: 200 }
        ]
    }
};

// --- NEW HELPER FUNCTIONS ---

// Shows the "empty state" message and hides the score cards
function showEmptyState() {
    const emptyEl = document.getElementById("empty-progress");
    const scoreEl = document.getElementById("score-display");
    const skillsEl = document.getElementById("skills-section");

    if (emptyEl) emptyEl.classList.remove("hidden");
    if (scoreEl) scoreEl.classList.add("hidden");
    if (skillsEl) skillsEl.classList.add("hidden");
}

// Shows the score cards and hides the "empty state" message
function showProgressState() {
    const emptyEl = document.getElementById("empty-progress");
    const scoreEl = document.getElementById("score-display");
    const skillsEl = document.getElementById("skills-section");

    if (emptyEl) emptyEl.classList.add("hidden");
    if (scoreEl) scoreEl.classList.remove("hidden");
    if (skillsEl) skillsEl.classList.remove("hidden");
}

// --- MODIFIED FUNCTION ---

// Load user progress from Firestore
async function loadUserProgressFromFirestore(userId) {
    try {
        const progressRef = doc(db, 'users', userId, 'progress', 'data');
        const progressSnap = await getDoc(progressRef);
        
        // MODIFIED: Check if user has no data, show empty state if true
        if (!progressSnap.exists()) {
            console.log("No progress data found for user.");
            showEmptyState(); // Show welcome message
            return;
        }
        
        const progressData = progressSnap.data();
        const skillScores = progressData.skillScores || {};

        // MODIFIED: Check if skillScores object is empty
        if (Object.keys(skillScores).length === 0) {
            console.log("User exists but has no skill scores.");
            showEmptyState(); // Show welcome message
            return;
        }

        // If we get here, user has data. Show the progress.
        showProgressState(); // Show the real score cards
        
        // Calculate scores for each skill category
        const mathSkills = userData.math.skills;
        const readingSkills = userData.reading.skills;
        
        // Update math skills
        mathSkills.forEach(skill => {
            const skillName = skill.name;
            const skillData = skillScores[skillName];
            if (skillData && skillData.total > 0) {
                const accuracy = (skillData.correct / skillData.total) * 100;
                // Convert accuracy to SAT score (200-800 scale)
                const satScore = 200 + (accuracy / 100) * 600;
                skill.score = Math.round(satScore);
                skill.performance = `${Math.max(200, Math.round(satScore - 30))}-${Math.min(800, Math.round(satScore + 30))}`;
            }
        });
        
        // Update reading skills
        readingSkills.forEach(skill => {
            const skillName = skill.name;
            const skillData = skillScores[skillName];
            if (skillData && skillData.total > 0) {
                const accuracy = (skillData.correct / skillData.total) * 100;
                const satScore = 200 + (accuracy / 100) * 600;
                skill.score = Math.round(satScore);
                skill.performance = `${Math.max(200, Math.round(satScore - 30))}-${Math.min(800, Math.round(satScore + 30))}`;
            }
        });
        
        // Calculate total scores (average of skills)
        const mathAvg = mathSkills.reduce((sum, s) => sum + s.score, 0) / mathSkills.length;
        const readingAvg = readingSkills.reduce((sum, s) => sum + s.score, 0) / readingSkills.length;
        
        userData.math.totalScore = Math.round(mathAvg);
        userData.reading.totalScore = Math.round(readingAvg);
        
        // Update the UI
        updateUserData(userData);
    } catch (error) {
        console.error("Error loading user progress:", error);
        showEmptyState(); // Also show empty state on error as a fallback
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Load user progress from Firestore
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadUserProgressFromFirestore(user.uid);
        } else {
            // If no user is logged in, show the empty state
            showEmptyState();
            console.log("No user logged in. Showing empty state.");
        }
    });
    
    const tabButtons = document.querySelectorAll(".tab-btn");

    tabButtons.forEach((button, index) => {
        button.addEventListener("click", () => {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            if (index === 0) {
                showReadingContent();
            } else {
                showMathContent();
            }
        });
    });

    // Helper function to calculate width percentage (200-800 scale)
    function calculateWidth(score) {
        // Clamp score between 200 and 800
        const clampedScore = Math.max(200, Math.min(800, score));
        // Convert to percentage (0-100%)
        return ((clampedScore - 200) / 600) * 100;
    }

    // Add to breakdown.js - Enhanced version

function showMathContent() {
    const mathData = userData.math;
    
    // Smooth transition
    const skillsContainer = document.querySelector(".skills-section");
    const scoreContainer = document.querySelector(".score-display"); // Get score container
    if (!skillsContainer || !scoreContainer) return; // Add guard clause

    skillsContainer.style.opacity = '0';
    scoreContainer.style.opacity = '0';
    
    setTimeout(() => {
        scoreContainer.innerHTML = `
            <h2>Math Knowledge</h2>
            <div class="score-card">
                <div class="score-label">Your Math Score</div>
                <div class="score-value" id="score-value-display">${mathData.totalScore}</div>
            </div>
        `;
        
        // Animate score counting
        animateScore(document.getElementById("score-value-display"), mathData.totalScore, 1000);
        
        const skillsHTML = mathData.skills.map((skill, index) => `
            <div class="skill-item" style="animation-delay: ${index * 0.1}s">
                <div class="skill-header">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-meta">${skill.percentage}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: 0%" data-width="${calculateWidth(skill.score)}"></div>
                    <div class="progress-labels">
                        <span>200</span>
                        <span>800</span>
                    </div>
                </div>
                <div class="skill-footer">
                    <span class="performance-text">Performance: <strong>${skill.performance}</strong></span>
                    <a href="#" class="skill-link">View Skills and Example Questions →</a>
                </div>
            </div>
        `).join('');
        
        skillsContainer.innerHTML = `
            <h2>Math Skills Performance</h2>
            <p class="skills-description">
                View your performance across the 4 Math content areas measured on the SAT. 
                Each content area has a performance score band showing how you did.
            </p>
            ${skillsHTML}
        `;
        
        // Animate progress bars
        setTimeout(() => {
            document.querySelectorAll('.progress-bar').forEach(bar => {
                const width = bar.dataset.width;
                bar.style.width = width + '%';
            });
        }, 100);
        
        skillsContainer.style.opacity = '1';
        scoreContainer.style.opacity = '1';
        attachSkillLinkListeners();
    }, 300);
}

// Add score counting animation
function animateScore(element, target, duration) {
    if (!element) return; // Add guard clause
    const start = parseInt(element.textContent) || 0;
    const increment = (target - start) / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.round(current);
    }, 16);
}

// Apply same enhancements to showReadingContent()

    function showReadingContent() {
    const readingData = userData.reading;
    
    // Smooth transition
    const skillsContainer = document.querySelector(".skills-section");
    const scoreContainer = document.querySelector(".score-display"); // Get score container
    if (!skillsContainer || !scoreContainer) return; // Add guard clause

    skillsContainer.style.opacity = '0';
    scoreContainer.style.opacity = '0';
    skillsContainer.style.transition = 'opacity 0.3s ease';
    scoreContainer.style.transition = 'opacity 0.3s ease';
    
    setTimeout(() => {
        scoreContainer.innerHTML = `
            <h2>Reading and Writing Knowledge</h2>
            <div class="score-card">
                <div class="score-label">Your Reading and Writing Score</div>
                <div class="score-value" id="score-value-display">${readingData.totalScore}</div>
            </div>
        `;
        
        // Animate score counting
        animateScore(document.getElementById("score-value-display"), readingData.totalScore, 1000);
        
        const skillsHTML = readingData.skills.map((skill, index) => `
            <div class="skill-item" style="animation: fadeInUp 0.6s ease ${index * 0.1}s backwards">
                <div class="skill-header">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-meta">${skill.percentage}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: 0%" data-width="${calculateWidth(skill.score)}"></div>
                    <div class="progress-labels">
                        <span>200</span>
                        <span>800</span>
                    </div>
                </div>
                <div class="skill-footer">
                    <span class="performance-text">Performance: <strong>${skill.performance}</strong></span>
                    <a href="#" class="skill-link">View Skills and Example Questions →</a>
                </div>
            </div>
        `).join('');
        
        skillsContainer.innerHTML = `
            <h2>Reading and Writing Skills Performance</h2>
            <p class="skills-description">
                View your performance across the 4 Reading and Writing content areas measured on the SAT. 
                Each content area has a performance score band showing how you did.
            </p>
            ${skillsHTML}
        `;
        
        // Animate progress bars
        setTimeout(() => {
            document.querySelectorAll('.progress-bar').forEach(bar => {
                const width = bar.dataset.width;
                bar.style.width = width + '%';
            });
        }, 100);
        
        skillsContainer.style.opacity = '1';
        scoreContainer.style.opacity = '1';
        attachSkillLinkListeners();
    }, 300);
}

    function attachSkillLinkListeners() {
    console.log("Attaching skill link listeners..."); // DEBUG
    const skillLinks = document.querySelectorAll('.skill-link');
    console.log("Found", skillLinks.length, "skill links"); // DEBUG
    
    skillLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Link clicked!"); // DEBUG
            
            // Get the skill name from the parent skill-item
            const skillItem = link.closest('.skill-item');
            const skillName = skillItem.querySelector('.skill-name').textContent;
            console.log("Skill name:", skillName); // DEBUG
            
            // Store the skill name in localStorage for the next page
            localStorage.setItem('selectedSkill', skillName);
            console.log("Stored in localStorage, now redirecting..."); // DEBUG
            
            // Navigate to the questions page
            window.location.href = 'skill-questions.html';
        });
    });
}

// MODIFIED: Check for active tab *only if* progress is being shown
const activeTab = document.querySelector(".tab-btn.active");
    if (activeTab && !document.getElementById("empty-progress").classList.contains("hidden")) {
        if (activeTab.textContent.includes("Math")) {
            showMathContent();
        } else {
            showReadingContent();
        }
    }

});

// Function to update user data (call this when you get data from Firebase)
function updateUserData(newData) {
    userData = newData;
    // Refresh the currently active tab
    const activeTab = document.querySelector(".tab-btn.active");
    if (activeTab && activeTab.textContent.includes("Math")) {
        showMathContent();
    } else {
        showReadingContent();
    }
}