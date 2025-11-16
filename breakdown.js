// breakdown.js
import { auth, db } from './script.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// This will hold the user's actual scores loaded from Firebase
let userData = {
    math: {
        totalScore: null, // null means loading
        skills: [
            { name: "Algebra", percentage: "35% of section, 13-15 questions", performance: "Loading...", score: null },
            { name: "Advanced Math", percentage: "35% of section, 13-15 questions", performance: "Loading...", score: null },
            { name: "Problem-Solving and Data Analysis", percentage: "15% of section, 5-7 questions", performance: "Loading...", score: null },
            { name: "Geometry and Trigonometry", percentage: "15% of section, 5-7 questions", performance: "Loading...", score: null }
        ]
    },
    reading: {
        totalScore: null, // null means loading
        skills: [
            { name: "Craft & Structure", percentage: "28% of section, 13-15 questions", performance: "Loading...", score: null },
            { name: "Information and Ideas", percentage: "26% of section, 12-14 questions", performance: "Loading...", score: null },
            { name: "Conventions of Standard English", percentage: "26% of section, 11-15 questions", performance: "Loading...", score: null },
            { name: "Expression of Ideas", percentage: "20% of section, 8-12 questions", performance: "Loading...", score: null }
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
        // Access user document directly where skillScores is a map field
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        // Check if user document exists
        if (!userSnap.exists()) {
            console.log("No user data found.");
            showEmptyState(); // Show welcome message
            return;
        }

        const userData_firebase = userSnap.data();
        const skillScores = userData_firebase.skillScores || {};

        // Check if skillScores object is empty or has no questions attempted
        if (Object.keys(skillScores).length === 0) {
            console.log("User exists but has no skill scores.");
            showEmptyState(); // Show welcome message
            return;
        }

        // Check if user has attempted any questions
        let hasAttemptedQuestions = false;
        for (const skillData of Object.values(skillScores)) {
            if (skillData.total > 0) {
                hasAttemptedQuestions = true;
                break;
            }
        }

        if (!hasAttemptedQuestions) {
            console.log("User has no attempted questions yet.");
            showEmptyState(); // Show welcome message
            return;
        }

        // If we get here, user has data. Show the progress.
        showProgressState(); // Show the real score cards

        // Calculate scores for each skill category
        const mathSkills = userData.math.skills;
        const readingSkills = userData.reading.skills;

        // Update math skills with accuracy = correct / total
        mathSkills.forEach(skill => {
            const skillName = skill.name;
            const skillData = skillScores[skillName];
            if (skillData && skillData.total > 0) {
                const accuracy = (skillData.correct / skillData.total) * 100;
                // Convert accuracy to SAT score (200-800 scale)
                const satScore = 200 + (accuracy / 100) * 600;
                skill.score = Math.round(satScore);
                skill.performance = `${Math.round(accuracy)}% (${skillData.correct}/${skillData.total})`;
            } else {
                // Default to 0 if no data
                skill.score = 0;
                skill.performance = `0% (0/0)`;
            }
        });

        // Update reading skills with accuracy = correct / total
        readingSkills.forEach(skill => {
            const skillName = skill.name;
            const skillData = skillScores[skillName];
            if (skillData && skillData.total > 0) {
                const accuracy = (skillData.correct / skillData.total) * 100;
                const satScore = 200 + (accuracy / 100) * 600;
                skill.score = Math.round(satScore);
                skill.performance = `${Math.round(accuracy)}% (${skillData.correct}/${skillData.total})`;
            } else {
                // Default to 0 if no data
                skill.score = 0;
                skill.performance = `0% (0/0)`;
            }
        });

        // Calculate projected SAT scores based on overall performance
        // SAT Math is out of 800, SAT R&W is out of 800 (total 1600)
        const mathSkillsWithData = mathSkills.filter(s => skillScores[s.name]?.total > 0);
        const readingSkillsWithData = readingSkills.filter(s => skillScores[s.name]?.total > 0);

        // If we have data, calculate weighted average based on question counts
        if (mathSkillsWithData.length > 0) {
            const mathAvg = mathSkillsWithData.reduce((sum, s) => sum + s.score, 0) / mathSkillsWithData.length;
            userData.math.totalScore = Math.round(mathAvg);
        } else {
            userData.math.totalScore = 0;
        }

        if (readingSkillsWithData.length > 0) {
            const readingAvg = readingSkillsWithData.reduce((sum, s) => sum + s.score, 0) / readingSkillsWithData.length;
            userData.reading.totalScore = Math.round(readingAvg);
        } else {
            userData.reading.totalScore = 0;
        }

        // Update the UI
        updateUserData(userData);
    } catch (error) {
        console.error("Error loading user progress:", error);
        showEmptyState(); // Also show empty state on error as a fallback
    }
}

// Helper function to calculate width percentage (200-800 scale)
function calculateWidth(score) {
    // Clamp score between 200 and 800
    const clampedScore = Math.max(200, Math.min(800, score));
    // Convert to percentage (0-100%)
    return ((clampedScore - 200) / 600) * 100;
}

// Add score counting animation
function animateScore(element, target, duration) {
    if (!element) return;
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

function attachSkillLinkListeners() {
    console.log("Attaching skill link listeners...");
    const skillLinks = document.querySelectorAll('.skill-link');
    console.log("Found", skillLinks.length, "skill links");

    skillLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Link clicked!");

            const skillItem = link.closest('.skill-item');
            const skillName = skillItem.querySelector('.skill-name').textContent;
            console.log("Skill name:", skillName);

            localStorage.setItem('selectedSkill', skillName);
            console.log("Stored in localStorage, now redirecting...");

            window.location.href = 'skill-questions.html';
        });
    });
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
});

// Math Content Display Function
function showMathContent() {
    const mathData = userData.math;

    // Smooth transition
    const skillsContainer = document.querySelector(".skills-section");
    const scoreContainer = document.querySelector(".score-display"); // Get score container
    if (!skillsContainer || !scoreContainer) return; // Add guard clause

    skillsContainer.style.opacity = '0';
    scoreContainer.style.opacity = '0';

    setTimeout(() => {
        const displayValue = mathData.totalScore === null ? "Loading..." : mathData.totalScore;
        scoreContainer.innerHTML = `
            <h2>Math Knowledge</h2>
            <div class="score-card">
                <div class="score-label">Your Math Score</div>
                <div class="score-value" id="score-value-display">${displayValue}</div>
            </div>
        `;

        // Animate score counting (only if not loading)
        if (mathData.totalScore !== null) {
            animateScore(document.getElementById("score-value-display"), mathData.totalScore, 1000);
        }

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

// Reading Content Display Function
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
        const displayValue = readingData.totalScore === null ? "Loading..." : readingData.totalScore;
        scoreContainer.innerHTML = `
            <h2>Reading and Writing Knowledge</h2>
            <div class="score-card">
                <div class="score-label">Your Reading and Writing Score</div>
                <div class="score-value" id="score-value-display">${displayValue}</div>
            </div>
        `;

        // Animate score counting (only if not loading)
        if (readingData.totalScore !== null) {
            animateScore(document.getElementById("score-value-display"), readingData.totalScore, 1000);
        }

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