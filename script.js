// script.js
// Handles "page" switching and prepares for later question logic

//firebase imported functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithRedirect, getRedirectResult, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
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
console.log(auth);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

let currentUserId = null;
let currentUserProgress = {};
let currentSessionId = null;

export function loadJSON(path, success, error) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                if (success)
                    success(JSON.parse(xhr.responseText));
            } else {
                if (error)
                    error(xhr);
            }
        }
    };
    xhr.open("GET", path, true);
    xhr.send();
}

// Firebase Auth helper functions
export async function signInWithGoogle(credential) {
    try {
        const credentialObj = GoogleAuthProvider.credential(credential);
        const result = await signInWithCredential(auth, credentialObj);
        const user = result.user;

        // Initialize user progress in Firestore if it doesn't exist
        const userProgressRef = doc(db, 'Users', user.uid, 'progress', 'data');
        const userProgressSnap = await getDoc(userProgressRef);

        if (!userProgressSnap.exists()) {
            await addDoc(userProgressRef, {
                wrongQuestions: [],
                wrongQuestionsByCategory: {
                    // SAT Math categories
                    Algebra: [],
                    Advanced_Math: [],
                    'Problem_Solving_&_Data_Analysis': [],
                    'Geometry_&_Trigonometry': [],
                    // SAT Reading & Writing categories
                    'Craft_and_Structure': [],
                    'Information_and_Ideas': [],
                    'Standard_English_Conventions': [],
                    'Expression_of_Ideas': []
                },
                skillScores: {},
                sessions: [],
                createdAt: new Date()
            });
        } localStorage.setItem("logged-in", "true");
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
onAuthStateChanged(auth, async (user) => {
    // Get element references here, OR make sure they are globally accessible
    const userInfoEl = document.getElementById("userInfo");
    const signInEl = document.getElementById("signIn");
    const loginBtn = document.getElementById("google-sign-in-button");
    // Check if the page is currently loaded in the browser
    if (document.readyState === 'complete' || document.readyState === 'interactive') {

        if (user) {
            // --- USER IS SIGNED IN ---

            if (loginBtn) {
                loginBtn.classList.add("hidden");
            }

            currentUserId = user.uid;

            // var userDoc = await getDoc(doc(db,'Users',currentUserId));
            // if (!userDoc.exists()){
            //     loadJSON('./user.json',function(data){
            //         setDoc(doc(db,'Users',currentUserId),data);
            //         console.log("New info created")
            //     });
            // }

            console.log("User is signed in:", user.uid);

            // 1. Hide Login Button, Show Profile Section (Fixes the visible button issue)
            if (signInEl) signInEl.style.display = 'none';
            if (userInfoEl) {
                userInfoEl.style.display = 'block';
                // You need logic here to populate userInfoEl with the user's name/photo
            }

            // 2. Redirect to profile page if on landing page
            const currentPath = window.location.pathname;
            if (currentPath === "/index.html" || currentPath === "/" || currentPath.endsWith("index.html")) {
                //window.location.replace("profile.html");
            }
            // If you are on the profile page, call loadUserProgress() 
            if (currentPath.includes("profile.html")) {
                loadUserProgress();
            }

        } else {
            // --- USER IS SIGNED OUT ---
            currentUserId = null;
            console.log("No user logged in.");

            if (loginBtn) {
                loginBtn.classList.remove("hidden");
            }

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
        const userProgressRef = doc(db, 'Users', currentUserId, 'progress', 'data');
        const userProgressSnap = await getDoc(userProgressRef);

        if (userProgressSnap.exists()) {
            currentUserProgress = userProgressSnap.data();
        }

        const accuracy = calculateSkillAccuracy(skillScores);
        renderPerformanceChart(accuracy);
    } catch (error) {
        console.error("Error loading user progress:", error);
    }
}

export async function getUserInformation(){
    const userInfoRef = doc(db, 'Users', currentUserId);
    const userInfoSnap = await getDoc(userInfoRef);
    return userInfoSnap.data();
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
    console.log('🎯 Getting adaptive questions, count:', count);

    if (!currentUserId) {
        // If not logged in, return random questions
        const allQuestions = await loadQuestionsFromFirestore();
        console.log('📝 Not logged in, returning random questions:', allQuestions.length);
        return shuffleArray(allQuestions).slice(0, count);
    }

    // Get user's attempted questions to avoid duplicates
    const attemptedQuestionIds = currentUserProgress.attemptedQuestions || [];
    console.log('📋 Already attempted questions:', attemptedQuestionIds.length);

    // Get user's weak areas (wrong questions)
    const wrongQuestionIds = currentUserProgress.wrongQuestions || [];
    console.log('❌ Wrong questions:', wrongQuestionIds.length);

    // Get user's skill scores to identify weak areas
    const skillScores = currentUserProgress.skillScores || {};
    const weakCategories = Object.keys(skillScores)
        .filter(cat => {
            const score = skillScores[cat];
            return score.total > 0 && (score.correct / score.total) < 0.7; // Less than 70% accuracy
        });
    console.log('📉 Weak categories:', weakCategories);

    // Load all questions
    const allQuestions = await loadQuestionsFromFirestore();
    console.log('📚 Total questions in database:', allQuestions.length);

    // Filter out already attempted questions
    const unattemptedQuestions = allQuestions.filter(q =>
        !attemptedQuestionIds.includes(q.id)
    );
    console.log('✨ Unattempted questions:', unattemptedQuestions.length);

    // If we're running low on unattempted questions, allow repeats
    if (unattemptedQuestions.length < count) {
        console.warn('⚠️ Running low on unattempted questions, including some repeats');
        // Use all unattempted + fill with least recently attempted
        const recentlyAttempted = allQuestions
            .filter(q => attemptedQuestionIds.includes(q.id))
            .slice(-count); // Get last N attempted
        return shuffleArray([...unattemptedQuestions, ...recentlyAttempted]).slice(0, count);
    }

    // Prioritize questions from weak categories
    const weakCategoryQuestions = unattemptedQuestions.filter(q => {
        const qTags = q.tags || [];
        return weakCategories.some(cat =>
            qTags.some(tag => tag.toLowerCase().includes(cat.toLowerCase()))
        );
    });

    // Separate remaining questions
    const otherQuestions = unattemptedQuestions.filter(q =>
        !weakCategoryQuestions.includes(q)
    );

    // Mix: 60% from weak areas, 40% from other areas
    const weakCount = Math.min(Math.ceil(count * 0.6), weakCategoryQuestions.length);
    const otherCount = count - weakCount;

    console.log(`📊 Selecting ${weakCount} from weak areas, ${otherCount} from other areas`);

    const selected = [
        ...shuffleArray(weakCategoryQuestions).slice(0, weakCount),
        ...shuffleArray(otherQuestions).slice(0, otherCount)
    ];

    const finalQuestions = shuffleArray(selected).slice(0, count);
    console.log('✅ Final questions selected:', finalQuestions.length);

    return finalQuestions;
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
    if (!chartElement) {
        setTimeout(() => renderPerformanceChart(accuracyData), 100); // Retry after a short delay
        return;
    }
    const ctx = chartElement.getContext('2d');
    if (!ctx) {
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

    if (skillChart) {
        skillChart.destroy();
    }
    skillChart = new Chart(ctx, {
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
        const sessionRef = await addDoc(collection(db, 'Users', currentUserId, 'sessions'), {
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
        const sessionRef = doc(db, 'Users', currentUserId, 'sessions', currentSessionId);
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

/**
 * Updates user progress and tracks wrong answers by category
 * 
 * When a question is answered incorrectly:
 * 1. Adds question ID to general wrongQuestions array
 * 2. Categorizes the question based on tags/topic (e.g., "Algebra", "Problem Solving & Data Analysis")
 * 3. Adds question ID to category-specific array in wrongQuestionsByCategory
 * 4. Updates skill scores
 * 
 * Firebase Schema:
 * users/{userId}/progress/data
 *   - wrongQuestions: [questionId1, questionId2, ...] // All wrong questions
 *   - wrongQuestionsByCategory: {
 *       "Algebra": [questionId1, questionId2, ...],
 *       "Problem_Solving_&_Data_Analysis": [questionId3, ...],
 *       "Advanced_Math": [...],
 *       etc.
 *     }
 *   - skillScores: { "Algebra": { correct: 5, total: 10 }, ... }
 * 
 * @param {string} questionId - The unique ID of the question
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {string} skillCategory - The skill category (optional)
 * @param {Array<string>} tags - Question tags for categorization
 * @param {Object} question - Full question object with topic info
 */
export async function updateUserProgress(questionId, isCorrect, skillCategory, tags, question, userAnswer = null, rationale = '') {
    if (!currentUserId) return;

    try {
        // Get the question category/topic for organizing wrong answers
        const questionTopic = question?.topic || skillCategory || 'Other';

        // Determine the category key from tags or topic
        let categoryKey = questionTopic;

        // If we have tags, try to get more specific category
        if (tags && tags.length > 0) {
            // Map common tags to SAT skill categories
            const tagToCategory = {
                // Math categories
                'algebra': 'Algebra',
                'linear equations': 'Algebra',
                'quadratic': 'Algebra',
                'systems of equations': 'Algebra',
                'advanced math': 'Advanced Math',
                'functions': 'Advanced Math',
                'polynomial': 'Advanced Math',
                'exponential': 'Advanced Math',
                'geometry': 'Geometry and Trigonometry',
                'trigonometry': 'Geometry and Trigonometry',
                'circles': 'Geometry and Trigonometry',
                'triangles': 'Geometry and Trigonometry',
                'data analysis': 'Problem-Solving and Data Analysis',
                'statistics': 'Problem-Solving and Data Analysis',
                'probability': 'Problem-Solving and Data Analysis',
                'ratios': 'Problem-Solving and Data Analysis',
                'percentages': 'Problem-Solving and Data Analysis',
                // Reading & Writing categories
                'craft and structure': 'Craft & Structure',
                'words in context': 'Craft & Structure',
                'text structure': 'Craft & Structure',
                'purpose': 'Craft & Structure',
                'information and ideas': 'Information and Ideas',
                'central ideas': 'Information and Ideas',
                'supporting details': 'Information and Ideas',
                'inferences': 'Information and Ideas',
                'standard english conventions': 'Conventions of Standard English',
                'grammar': 'Conventions of Standard English',
                'punctuation': 'Conventions of Standard English',
                'sentence structure': 'Conventions of Standard English',
                'expression of ideas': 'Expression of Ideas',
                'rhetoric': 'Expression of Ideas',
                'transitions': 'Expression of Ideas',
                'style': 'Expression of Ideas'
            };

            // Find matching category from tags
            for (const tag of tags) {
                const lowerTag = tag.toLowerCase();
                if (tagToCategory[lowerTag]) {
                    categoryKey = tagToCategory[lowerTag];
                    break;
                }
            }
        }

        // Get reference to user document
        const userRef = doc(db, 'users', currentUserId);

        // Update skill scores in the user document
        const userSnap = await getDoc(userRef);
        const currentProgress = userSnap.exists() ? userSnap.data() : {};
        const skillScores = currentProgress.skillScores || {};

        // Update the specific skill category
        if (!skillScores[categoryKey]) {
            skillScores[categoryKey] = { correct: 0, total: 0, incorrectQID: [] };
        }

        skillScores[categoryKey].total += 1;
        if (isCorrect) {
            skillScores[categoryKey].correct += 1;
        } else {
            // Add to incorrect questions array if not already present
            if (!skillScores[categoryKey].incorrectQID) {
                skillScores[categoryKey].incorrectQID = [];
            }
            if (!skillScores[categoryKey].incorrectQID.includes(questionId)) {
                skillScores[categoryKey].incorrectQID.push(questionId);
            }
        }

        // Update attemptedQuestions array
        const attemptedQuestions = currentProgress.attemptedQuestions || [];
        if (!attemptedQuestions.includes(questionId)) {
            attemptedQuestions.push(questionId);
        }

        // Store the answer details in answers array
        const answerData = {
            questionID: questionId,
            userAnswer: userAnswer,
            isCorrect: isCorrect,
            rationale: rationale,
            timestamp: new Date(),
            category: categoryKey
        };

        // Update the user document
        await setDoc(userRef, {
            skillScores: skillScores,
            attemptedQuestions: attemptedQuestions,
            answers: arrayUnion(answerData)
        }, { merge: true });

        console.log(`Updated progress for ${categoryKey}: ${isCorrect ? 'correct' : 'incorrect'}`);

        // Reload progress
        await loadUserProgress();
    } catch (error) {
        console.error("Error updating user progress:", error);
    }
}

// Get all wrong question IDs for a specific category/skill
export async function getWrongQuestionsByCategory(categoryName) {
    console.log('🔍 getWrongQuestionsByCategory called with:', categoryName);
    console.log('🔍 currentUserId:', currentUserId);

    if (!currentUserId) {
        console.warn('⚠️ No currentUserId - user not logged in');
        return [];
    }

    try {
        // Access the user document where skillScores is a map field
        const userRef = doc(db, 'users', currentUserId);
        console.log('📄 Fetching user doc from:', `users/${currentUserId}`);

        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.warn('⚠️ User document does not exist');
            return [];
        }

        const userData = userSnap.data();
        const skillScores = userData.skillScores || {};
        const topicData = skillScores[categoryName];

        console.log('📊 Topic data for', categoryName, ':', topicData);

        const questionIds = topicData?.incorrectQID || [];
        console.log('✅ Found question IDs:', questionIds);

        return questionIds;
    } catch (error) {
        console.error("❌ Error getting wrong questions by category:", error);
        return [];
    }
}

// Load full question data for wrong questions in a category
export async function loadWrongQuestionsForCategory(categoryName) {
    console.log('📚 loadWrongQuestionsForCategory called with:', categoryName);

    const questionIds = await getWrongQuestionsByCategory(categoryName);
    console.log('📝 Question IDs to load:', questionIds);

    if (questionIds.length === 0) {
        console.log('⚠️ No question IDs found for this category');
        return [];
    }

    try {
        // Fetch user's answers to get their wrong answer details
        const userRef = doc(db, 'users', currentUserId);
        const userSnap = await getDoc(userRef);
        const answers = userSnap.exists() ? userSnap.data().answers || [] : [];

        // Create a map of questionID -> answer details for quick lookup
        const answerMap = {};
        answers.forEach(answer => {
            if (answer.questionID) {
                answerMap[answer.questionID] = answer;
            }
        });

        // Fetch questions by document ID (not by a field called 'id')
        const questions = [];

        // Fetch each question individually (Firestore document IDs)
        for (const questionId of questionIds.slice(0, 10)) {
            try {
                const questionRef = doc(db, 'questions', questionId);
                const questionSnap = await getDoc(questionRef);

                if (questionSnap.exists()) {
                    const questionData = questionSnap.data();
                    console.log('📄 Found question:', questionId, questionData);

                    // Add the document ID and user's answer to the data
                    const questionWithAnswer = {
                        id: questionId,
                        ...questionData,
                        userAnswer: answerMap[questionId]?.userAnswer || null,
                        rationale: answerMap[questionId]?.rationale || '',
                        timestamp: answerMap[questionId]?.timestamp || null
                    };
                    questions.push(questionWithAnswer);
                } else {
                    console.warn(`⚠️ Question not found: ${questionId}`);
                }
            } catch (err) {
                console.error(`❌ Error fetching question ${questionId}:`, err);
            }
        }

        console.log(`✅ Loaded ${questions.length} questions from Firestore`);
        return questions;
    } catch (error) {
        console.error("❌ Error loading wrong questions:", error);
        return [];
    }
}

export async function completeSession() {
    if (!currentUserId || !currentSessionId) return;

    try {
        const sessionRef = doc(db, 'Users', currentUserId, 'sessions', currentSessionId);
        await updateDoc(sessionRef, {
            completed: true,
            completedAt: new Date()
        });

        // Update progress sessions list
        const progressRef = doc(db, 'Users', currentUserId, 'progress', 'data');
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
    const endSessionBtn = document.getElementById("end-session-btn");
    const answerFeedback = document.getElementById("answer-feedback");
    const aiExplanationPanel = document.getElementById("ai-explanation-panel");

    let questions = [];
    let currentIndex = 0;
    let selectedAnswer = null;
    let isUnsure = false;

    // Google Login Button
    const loginBtn = document.getElementById("google-sign-in-button");

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            signInWithPopup(auth, googleProvider)
                .then(async (result) => {
                    const user = result.user;
                    console.log("User signed in:", user.displayName, user.email);
                    var userDoc = await getDoc(doc(db,'Users',currentUserId));
                    if (!userDoc.exists()){
                        loadJSON('./user.json',function(data){
                        setDoc(doc(db,'Users',currentUserId),data);
                        console.log("New info created")
                    });
                }
                    console.log("User document created/updated in Firestore");
                    loadIndexPage();
                })
                .catch((error) => {
                    console.error("Error signing in:", error.message);
                });
            // try {
            //     await signInWithRedirect(auth, googleProvider);
            // } catch (error) {
            //     console.error("Sign-in redirect initiation error:", error);
            // }
        });
    }

    // Switch from landing → trainer
    if (startBtn) {
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
    }
    // Click logo → go back to home
    if (homeLink) {
        homeLink.addEventListener("click", () => {
            trainerSection.classList.add("hidden");
            landingSection.classList.remove("hidden");
            resetQuestionState();
        });
    }
    // Load a question onto the card
    async function loadQuestion() {
        // If we've reached the end of current batch, load more questions
        if (currentIndex >= questions.length) {
            console.log('📚 Loading more questions...');
            questionText.textContent = "Loading more questions...";

            const newQuestions = await getAdaptiveQuestions(5);

            if (newQuestions.length === 0) {
                endSession();
                return;
            }

            // Add new questions to the existing batch
            questions.push(...newQuestions);
            console.log(`✅ Added ${newQuestions.length} more questions. Total: ${questions.length}`);

        }

        // Show end session button after 5 questions
        if (currentIndex >= 5) {
            if (endSessionBtn) endSessionBtn.classList.remove('hidden');
        } else {
            if (endSessionBtn) endSessionBtn.classList.add('hidden');
        }

        const q = questions[currentIndex];
        questionText.textContent = q.passage + "\n" + q.questionText;
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
    if (unsureBtn) {
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
    }

    // End session button
    if (endSessionBtn) {
        endSessionBtn.addEventListener("click", async () => {
            if (confirm("Are you sure you want to end this session?")) {
                await endSession();
            }
        });
    }

    // Submit answer
    if (submitBtn) {
        submitBtn.addEventListener("click", async () => {
            if (!selectedAnswer) {
                alert("Please select an answer first.");
                return;
            }
            if (submitBtn.classList.contains("disabled")) {
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
                currentQuestion.tags || [],
                currentQuestion,
                selectedAnswer,
                rationale
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
    }
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
    if (nextBtn) {
        nextBtn.addEventListener("click", async () => {
            currentIndex++;
            await loadQuestion();
        });
    }
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
        questionOptions.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 2rem;">
                <button class="primary-btn" onclick="location.href='breakdown.html'">View Progress</button>
                <button class="primary-btn" onclick="location.reload()">Start New Session</button>
            </div>
        `;
        answerFeedback.classList.add("hidden");
        aiExplanationPanel.classList.add("hidden");
        submitBtn.classList.add("hidden");
        nextBtn.classList.add("hidden");
        if (unsureBtn) unsureBtn.style.display = 'none';
        rationaleSection.classList.add("hidden");
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
    if (homeLink) {
        homeLink.addEventListener("click", () => {
            trainerSection.classList.add("hidden");
            breakdownSection.classList.add("hidden");
            landingSection.classList.remove("hidden");
        });
    }
    // --- END CHART.JS IMPLEMENTATION ---
});