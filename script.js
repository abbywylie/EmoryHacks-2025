// script.js
// Handles "page" switching and prepares for later question logic

//firebase imported functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, query, where, addDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";

//configuration of firebase
const firebaseConfig = {
    apiKey: "AIzaSyAkZiKfWJjMv-rcl-QIZb14m8BJhCbiB18",
    authDomain: "hackathon2025-8af8d.firebaseapp.com",
    projectId: "hackathon2025-8af8d",
    storageBucket: "hackathon2025-8af8d.firebasestorage.app",
    messagingSenderId: "1046790183508",
    appId: "1:1046790183508:web:e45a9c8c6352c2a70a6bc1",
    measurementId: "G-Y5HPZKDKQD"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Get references to the services 
export const auth = getAuth(app); 
export const db = getFirestore(app); 
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

let currentUserId = null;
let currentUserProgress = {};
let currentSessionId = null;



// Firebase Auth helper functions
export async function signInWithGoogle(credential) {
    try {
        const credentialObj = GoogleAuthProvider.credential(credential);
        const result = await signInWithCredential(auth, credentialObj);
        const user = result.user;
        
        // Initialize user progress in Firestore if it doesn't exist
        const userProgressRef = doc(db, 'users', user.uid, 'progress', 'data');
        const userProgressSnap = await getDoc(userProgressRef);
        
        if (!userProgressSnap.exists()) {
            await setDoc(userProgressRef, {
                wrongQuestions: [],
                skillScores: {},
                sessions: [],
                createdAt: new Date()
            });
        }
        
        localStorage.setItem("logged-in", "true");
        localStorage.setItem("firebase_user_id", user.uid);
        return user;
    } catch (error) {
        console.error("Error signing in with Firebase:", error);
        throw error;
    }
}

export async function signOutUser() {
    try {
        await signOut(auth);
        localStorage.removeItem("logged-in");
        localStorage.removeItem("firebase_user_id");
        currentUserId = null;
        currentUserProgress = {};
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
}

async function handleRedirectSignIn() {
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            console.log("Redirect sign-in:", result.user.uid);
        }
    } catch (err) {
        console.error("Errorr retrieving redirect result:", err);
    }
}
// Global Scope (Only one instance of this listener)
onAuthStateChanged(auth, (user) => {
    // Get element references here, OR make sure they are globally accessible
    const userInfoEl = document.getElementById("userInfo"); 
    const signInEl = document.getElementById("signIn");
    
    // Check if the page is currently loaded in the browser
    if (document.readyState === 'complete' || document.readyState === 'interactive') {

        if (user) {
            // --- USER IS SIGNED IN ---
            currentUserId = user.uid;
            console.log("User is signed in:", user.uid);

            // 1. Hide Login Button, Show Profile Section (Fixes the visible button issue)
            if (signInEl) signInEl.style.display = 'none';
            if (userInfoEl) {
                userInfoEl.style.display = 'block'; 
                // You need logic here to populate userInfoEl with the user's name/photo
            }

            // 2. Redirect to profile page if on landing page
            const currentPath = window.location.pathname;
            if (currentPath === "/indext.html" || currentPath === "/" || currentPath.endsWith("index.html")) {
                 window.location.replace("profile.html");
            }
            // If you are on the profile page, call loadUserProgress() 
            if (currentPath.includes("profile.html")) {
                loadUserProgress();
            }

        } else {
            // --- USER IS SIGNED OUT ---
            currentUserId = null;
            console.log("No user logged in.");

            // Show Login Button, Hide Profile Section
            if (signInEl) signInEl.style.display = 'block';
            if (userInfoEl) userInfoEl.style.display = 'none';
        }
    }
});

// Run this right after defining the listener
handleRedirectSignIn();






async function loadUserProgress() {
    if (!currentUserId) return;
    
    try {
        const userProgressRef = doc(db, 'users', currentUserId, 'progress', 'data');
        const userProgressSnap = await getDoc(userProgressRef);
        
        if (userProgressSnap.exists()) {
            currentUserProgress = userProgressSnap.data();
        }

        const accuracy = calculateSkillAccuracy(currentUserProgress.skillScores || {});
        renderPerformanceChart(accuracy)
    } catch (error) {
        console.error("Error loading user progress:", error);
    }
}

// Firestore functions for questions
export async function loadQuestionsFromFirestore(filters = {}) {
    try {
        let q = query(collection(db, 'questions'));
        
        // Apply filters if provided
        if (filters.tags && filters.tags.length > 0) {
            q = query(q, where('tags', 'array-contains-any', filters.tags));
        }
        if (filters.skillCategory) {
            q = query(q, where('skillCategory', '==', filters.skillCategory));
        }
        if (filters.type) {
            q = query(q, where('type', '==', filters.type));
        }
        
        const querySnapshot = await getDocs(q);
        const questions = [];
        querySnapshot.forEach((doc) => {
            questions.push({ id: doc.id, ...doc.data() });
        });
        
        return questions;
    } catch (error) {
        console.error("Error loading questions:", error);
        return [];
    }
}

let skillChart = null; //declare chart variable globally

// Adaptive question selection based on user progress
export async function getAdaptiveQuestions(count = 5) {
    if (!currentUserId) {
        // If not logged in, return random questions
        const allQuestions = await loadQuestionsFromFirestore();
        return shuffleArray(allQuestions).slice(0, count);
    }
    
    // Get user's wrong questions
    const wrongQuestionIds = currentUserProgress.wrongQuestions || [];
    
    // Prioritize questions from weak areas
    const allQuestions = await loadQuestionsFromFirestore();
    
    // Separate into wrong question categories and others
    const wrongCategoryQuestions = allQuestions.filter(q => 
        wrongQuestionIds.includes(q.id)
    );
    const otherQuestions = allQuestions.filter(q => 
        !wrongQuestionIds.includes(q.id)
    );
    
    // Mix: 60% from wrong areas, 40% random
    const wrongCount = Math.ceil(count * 0.6);
    const randomCount = count - wrongCount;
    
    const selected = [
        ...shuffleArray(wrongCategoryQuestions).slice(0, wrongCount),
        ...shuffleArray(otherQuestions).slice(0, randomCount)
    ];
    
    return shuffleArray(selected).slice(0, count);
}

function calculateSkillAccuracy(skillScores) {
    const accuracyData = {};
    for (const category in skillScores) {
        if (skillScores[category].total > 0) {
            const correct = skillScores[category].correct;
            const total = skillScores[category].total;
            // Calculate percentage and round to a whole number
            accuracyData[category] = Math.round((correct / total) * 100);
        } else {
            accuracyData[category] = 0; // Default to 0% if no attempts
        }
    }
    return accuracyData;
}

//renderPerformanceChart function 
function renderPerformanceChart(accuracyData) {
    const chartElement = document.getElementById('snapshotChart');
    if(!chartElement){
        setTimeout(() => renderPerformanceChart(accuracyData), 100); // Retry after a short delay
        return;
    }
    const ctx = chartElement.getContext('2d');
    if(!ctx){
        console.error("Failed to get 2D context for the chart element.");
        return
    }
    const categories = Object.keys(accuracyData);
    const percentages = Object.values(accuracyData);
    const chartData = {
        labels: categories,
        datasets: [{
            label: 'Accuracy %', 
            data: percentages, 
            backgroundColor: [
                'rgba(255, 99, 132, 0.7)', 
                'rgba(54, 162, 235, 0.7)', 
                'rgba(255, 206, 86, 0.7)' 
            ],
            borderWidth: 1
        }]
    };

    if(skillChart){
        skillChart.destroy();
    }
    skillChart = new Chart(ctx,{
        type: 'bar', 
        data: chartData,
        options: {
            // ... (keep the same options you already defined for scales, responsiveness, etc.)
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { color: '#9ca3af' } },
                x: { ticks: { color: '#9ca3af' } }
            },
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
}


function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Session management
export async function createSession() {
    if (!currentUserId) return null;
    
    try {
        const sessionRef = await addDoc(collection(db, 'users', currentUserId, 'sessions'), {
            questions: [],
            answers: [],
            timestamp: new Date(),
            completed: false
        });
        currentSessionId = sessionRef.id;
        return sessionRef.id;
    } catch (error) {
        console.error("Error creating session:", error);
        return null;
    }
}

export async function saveAnswerToSession(questionId, userAnswer, isCorrect, rationale = '') {
    if (!currentUserId || !currentSessionId) return;
    
    try {
        const sessionRef = doc(db, 'users', currentUserId, 'sessions', currentSessionId);
        await updateDoc(sessionRef, {
            questions: arrayUnion(questionId),
            answers: arrayUnion({
                questionId,
                userAnswer,
                isCorrect,
                rationale,
                timestamp: new Date()
            })
        });
    } catch (error) {
        console.error("Error saving answer:", error);
    }
}

export async function updateUserProgress(questionId, isCorrect, skillCategory, tags) {
    if (!currentUserId) return;
    
    try {
        const progressRef = doc(db, 'users', currentUserId, 'progress', 'data');
        
        if (!isCorrect) {
            // Add to wrong questions if not already there
            await updateDoc(progressRef, {
                wrongQuestions: arrayUnion(questionId)
            });
        }
        
        // Update skill scores
        const progressSnap = await getDoc(progressRef);
        const currentProgress = progressSnap.data() || {};
        const skillScores = currentProgress.skillScores || {};
        
        if (skillCategory) {
            if (!skillScores[skillCategory]) {
                skillScores[skillCategory] = { correct: 0, total: 0 };
            }
            skillScores[skillCategory].total += 1;
            if (isCorrect) {
                skillScores[skillCategory].correct += 1;
            }
        }
        
        await updateDoc(progressRef, {
            skillScores: skillScores
        });
        
        // Reload progress
        await loadUserProgress();
    } catch (error) {
        console.error("Error updating user progress:", error);
    }
}

export async function completeSession() {
    if (!currentUserId || !currentSessionId) return;
    
    try {
        const sessionRef = doc(db, 'users', currentUserId, 'sessions', currentSessionId);
        await updateDoc(sessionRef, {
            completed: true,
            completedAt: new Date()
        });
        
        // Update progress sessions list
        const progressRef = doc(db, 'users', currentUserId, 'progress', 'data');
        await updateDoc(progressRef, {
            sessions: arrayUnion(currentSessionId)
        });
        
        currentSessionId = null;
    } catch (error) {
        console.error("Error completing session:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Grab the important sections
    const landingSection = document.getElementById("landing");
    const trainerSection = document.getElementById("trainer");

    // Buttons / clickable items
    const startBtn = document.getElementById("start-session");
    const homeLink = document.getElementById("home-link");
    const googleSignInBtn = document.getElementById("google-sign-in-button");

    // Elements inside the trainer page
    const questionText = document.getElementById("card-question-text");
    const topicChip = document.getElementById("topic-chip");
    const questionCounter = document.getElementById("question-counter");
    const questionOptions = document.getElementById("question-options");
    const rationaleSection = document.getElementById("rationale-section");
    const rationaleInput = document.getElementById("rationale-input");
    const unsureBtn = document.getElementById("unsure-btn");
    const submitBtn = document.getElementById("submit-answer");
    const nextBtn = document.getElementById("next-question");
    const answerFeedback = document.getElementById("answer-feedback");
    const aiExplanationPanel = document.getElementById("ai-explanation-panel");

    let questions = [];
    let currentIndex = 0;
    let selectedAnswer = null;
    let isUnsure = false;

    // Google Login Button
    const loginBtn = document.getElementById("google-sign-in-button");

    if (loginBtn) {
        loginBtn.addEventListener("click", async() => {
            try {
                await signInWithRedirect(auth, googleProvider);
            } catch (error) {
                console.error("Sign-in redirect initiation error:", error);
            }
        });
    }

    // Switch from landing → trainer
    startBtn.addEventListener("click", async () => {
        landingSection.classList.add("hidden");
        trainerSection.classList.remove("hidden");

        // Create session and load questions
        await createSession();
        questions = await getAdaptiveQuestions(5);
        
        if (questions.length === 0) {
            questionText.textContent = "No questions available. Please add questions to Firestore.";
            return;
        }

        currentIndex = 0;
        loadQuestion();
    });

    // Click logo → go back to home
    homeLink.addEventListener("click", () => {
        trainerSection.classList.add("hidden");
        landingSection.classList.remove("hidden");
        resetQuestionState();
    });

    // Load a question onto the card
    function loadQuestion() {
        if (currentIndex >= questions.length) {
            endSession();
            return;
        }

        const q = questions[currentIndex];
        questionText.textContent = q.questionText;
        topicChip.textContent = q.type || q.topic || "Question";
        questionCounter.textContent = `Question ${currentIndex + 1} / ${questions.length}`;
        
        // Render options
        renderOptions(q);
        
        // Reset state
        selectedAnswer = null;
        isUnsure = false;
        rationaleSection.classList.add("hidden");
        answerFeedback.classList.add("hidden");
        aiExplanationPanel.classList.add("hidden");
        submitBtn.classList.remove("hidden");
        nextBtn.classList.add("hidden");
        
        // Clear option selections
        document.querySelectorAll('.option-item').forEach(item => {
            item.classList.remove('selected', 'correct', 'incorrect');
        });
    }

    function renderOptions(question) {
        if (!question.options || question.options.length === 0) {
            questionOptions.innerHTML = '<p>No options available for this question.</p>';
            return;
        }

        const optionsHTML = question.options.map((option, index) => {
            const label = String.fromCharCode(65 + index); // A, B, C, D
            return `
                <div class="option-item" data-option="${label}" data-index="${index}">
                    <span class="option-label">${label}</span>
                    <span class="option-text">${option}</span>
                </div>
            `;
        }).join('');

        questionOptions.innerHTML = optionsHTML;

        // Add click handlers
        document.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', () => {
                if (answerFeedback.classList.contains('hidden')) {
                    document.querySelectorAll('.option-item').forEach(opt => opt.classList.remove('selected'));
                    item.classList.add('selected');
                    selectedAnswer = item.dataset.option;
                }
            });
        });
    }

    // Unsure button
    unsureBtn.addEventListener("click", () => {
        isUnsure = !isUnsure;
        if (isUnsure) {
            rationaleSection.classList.remove("hidden");
            unsureBtn.textContent = "I'm confident";
        } else {
            rationaleSection.classList.add("hidden");
            rationaleInput.value = "";
            unsureBtn.textContent = "I'm unsure";
        }
    });

    // Submit answer
    submitBtn.addEventListener("click", async () => {
        if (!selectedAnswer) {
            alert("Please select an answer first.");
            return;
        }
        if (submitBtn.classList.contains("disabled")){
            return;
        }

        const currentQuestion = questions[currentIndex];
        const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
        const rationale = isUnsure ? rationaleInput.value : '';

        // Show feedback
        showAnswerFeedback(isCorrect, currentQuestion);

        // Save to Firestore
        await saveAnswerToSession(
            currentQuestion.id,
            selectedAnswer,
            isCorrect,
            rationale
        );

        await updateUserProgress(
            currentQuestion.id,
            isCorrect,
            currentQuestion.skillCategory,
            currentQuestion.tags || []
        );

        submitBtn.classList.add("disabled");

        // If wrong and has rationale, get AI explanation
        if (!isCorrect && rationale) {
            await showAIExplanation(currentQuestion, selectedAnswer, rationale);
        }

        submitBtn.classList.add("hidden");
        submitBtn.classList.remove("disabled");
        nextBtn.classList.remove("hidden");
    });

    function showAnswerFeedback(isCorrect, question) {
        answerFeedback.classList.remove("hidden");
        answerFeedback.className = `answer-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        
        if (isCorrect) {
            answerFeedback.innerHTML = `
                <strong>✓ Correct!</strong> ${question.explanation || 'Great job!'}
            `;
        } else {
            answerFeedback.innerHTML = `
                <strong>✗ Incorrect.</strong> The correct answer is <strong>${question.correctAnswer}</strong>.
            `;
        }

        // Highlight correct/incorrect options
        document.querySelectorAll('.option-item').forEach(item => {
            const optionLabel = item.dataset.option;
            if (optionLabel === question.correctAnswer) {
                item.classList.add('correct');
            } else if (optionLabel === selectedAnswer) {
                item.classList.add('incorrect');
            }
        });
    }

    async function showAIExplanation(question, userAnswer, rationale) {
        try {
            const { getAIExplanation, applyInteractiveHighlights } = await import('./ai-explanation.js');
            const explanation = await getAIExplanation(question, userAnswer, rationale);
            aiExplanationPanel.classList.remove("hidden");
            aiExplanationPanel.innerHTML = `
                <h3>AI Explanation</h3>
                <div class="ai-explanation-content" id="ai-explanation-content">${explanation}</div>
            `;
            
            // Apply interactive highlighting
            const explanationContent = document.getElementById('ai-explanation-content');
            if (explanationContent) {
                applyInteractiveHighlights(explanationContent, questionText, questionOptions);
            }
        } catch (error) {
            console.error("Error getting AI explanation:", error);
            // Show fallback explanation
            aiExplanationPanel.classList.remove("hidden");
            aiExplanationPanel.innerHTML = `
                <h3>Explanation</h3>
                <div class="ai-explanation-content">
                    <p>The correct answer is <strong>${question.correctAnswer}</strong>.</p>
                    ${question.explanation ? `<p>${question.explanation}</p>` : ''}
                </div>
            `;
        }
    }

    // Next question
    nextBtn.addEventListener("click", () => {
        currentIndex++;
        loadQuestion();
    });

    function resetQuestionState() {
        questions = [];
        currentIndex = 0;
        selectedAnswer = null;
        isUnsure = false;
        rationaleInput.value = "";
    }

    async function endSession() {
        await completeSession();
        questionText.textContent = "Great work! We'll generate an adaptive follow-up based on your responses.";
        topicChip.textContent = "Session complete";
        questionCounter.textContent = "";
        questionOptions.innerHTML = "";
        answerFeedback.classList.add("hidden");
        aiExplanationPanel.classList.add("hidden");
        submitBtn.classList.add("hidden");
        nextBtn.classList.add("hidden");
        nextBtn.textContent = "Done";
    }
    

    // -- WORK IN PROGRESS - DANIEL ---

// SAT Breakdown navigation
const showBreakdownBtn = document.getElementById("show-breakdown"); // You'll need to add this button
const breakdownSection = document.getElementById("sat-breakdown");

// Add a button to navigate to breakdown (optional)
if (showBreakdownBtn) {
  showBreakdownBtn.addEventListener("click", () => {
    landingSection.classList.add("hidden");
    trainerSection.classList.add("hidden");
    breakdownSection.classList.remove("hidden");
  });
}

// Click logo to go back home (update existing code)
homeLink.addEventListener("click", () => {
  trainerSection.classList.add("hidden");
  breakdownSection.classList.add("hidden");
  landingSection.classList.remove("hidden");
});

// --- END CHART.JS IMPLEMENTATION ---
});