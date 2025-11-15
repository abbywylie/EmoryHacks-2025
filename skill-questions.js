// skill-questions.js

// Mock data for wrong answers (replace with Firebase later)
const mockWrongQuestions = {
    "Algebra": [
        {
            id: "SAT_MATH_001",
            questionText: "If 3x + 1 = 16, what is x?",
            correctAnswer: "5",
            options: ["4", "5", "6", "7"],
            explanation: "To solve for x, subtract 1 from both sides to get 3x = 15, then divide both sides by 3 to find x = 5.",
            userAnswer: "4",
            isMultipleChoice: true
        },
        {
            id: "SAT_MATH_002",
            questionText: "Solve for y: 2y - 7 = 13",
            correctAnswer: "10",
            options: ["8", "9", "10", "11"],
            explanation: "Add 7 to both sides: 2y = 20, then divide by 2: y = 10.",
            userAnswer: "9",
            isMultipleChoice: true
        },
        {
            id: "SAT_MATH_003",
            questionText: "If 5(x - 3) = 20, what is x?",
            correctAnswer: "7",
            options: ["5", "6", "7", "8"],
            explanation: "Divide both sides by 5: x - 3 = 4, then add 3: x = 7.",
            userAnswer: "6",
            isMultipleChoice: true
        }
    ],
    "Advanced Math": [
        {
            id: "SAT_MATH_004",
            questionText: "What is the value of x² if x = 3?",
            correctAnswer: "9",
            options: ["6", "9", "12", "15"],
            explanation: "Simply square 3: 3² = 3 × 3 = 9.",
            userAnswer: "6",
            isMultipleChoice: true
        }
    ],
    "Problem Solving & Data Analysis": [
        {
            id: "SAT_MATH_005",
            questionText: "What is the mean of 4, 8, 12, and 16?",
            correctAnswer: "10",
            options: ["8", "10", "12", "14"],
            explanation: "Add all values (4+8+12+16=40) and divide by the count (4): 40/4 = 10.",
            userAnswer: "12",
            isMultipleChoice: true
        }
    ],
    "Geometry & Trigonometry": [
        {
            id: "SAT_MATH_006",
            questionText: "What is the area of a circle with radius 5?",
            correctAnswer: "25π",
            options: ["10π", "15π", "25π", "50π"],
            explanation: "Use the formula A = πr²: A = π(5²) = 25π.",
            userAnswer: "10π",
            isMultipleChoice: true
        }
    ],
    "Craft and Structure": [
        {
            id: "SAT_READ_001",
            questionText: "What is the main purpose of the passage?",
            correctAnswer: "To explain a scientific phenomenon",
            options: ["To entertain readers", "To explain a scientific phenomenon", "To persuade readers", "To describe a place"],
            explanation: "The passage focuses on explaining how the process works.",
            userAnswer: "To entertain readers",
            isMultipleChoice: true
        }
    ],
    "Information and Ideas": [
        {
            id: "SAT_READ_002",
            questionText: "According to the text, what is the primary benefit?",
            correctAnswer: "Increased efficiency",
            options: ["Lower costs", "Increased efficiency", "Better quality", "Faster delivery"],
            explanation: "The text explicitly states that efficiency is the main advantage.",
            userAnswer: "Lower costs",
            isMultipleChoice: true
        }
    ],
    "Standard English Conventions": [
        {
            id: "SAT_WRITE_001",
            questionText: "Which choice completes the sentence correctly?",
            correctAnswer: "their",
            options: ["there", "their", "they're", "its"],
            explanation: "Use 'their' to show possession.",
            userAnswer: "there",
            isMultipleChoice: true
        }
    ],
    "Expression of Ideas": [
        {
            id: "SAT_WRITE_002",
            questionText: "Which transition best connects these ideas?",
            correctAnswer: "However",
            options: ["Therefore", "However", "Similarly", "Furthermore"],
            explanation: "The sentences present contrasting ideas, so 'However' is appropriate.",
            userAnswer: "Therefore",
            isMultipleChoice: true
        }
    ]
};

// Skill data from breakdown page
const skillData = {
    "Algebra": { performance: "610-670", score: 640, progressWidth: 62.5 },
    "Advanced Math": { performance: "470-540", score: 505, progressWidth: 45 },
    "Problem Solving & Data Analysis": { performance: "420-460", score: 440, progressWidth: 36.67 },
    "Geometry & Trigonometry": { performance: "420-460", score: 440, progressWidth: 36.67 },
    "Craft and Structure": { performance: "800-800", score: 800, progressWidth: 100 },
    "Information and Ideas": { performance: "800-800", score: 800, progressWidth: 100 },
    "Standard English Conventions": { performance: "800-800", score: 800, progressWidth: 100 },
    "Expression of Ideas": { performance: "800-800", score: 800, progressWidth: 100 }
};

document.addEventListener("DOMContentLoaded", () => {
    // Get the selected skill from localStorage
    const selectedSkill = localStorage.getItem('selectedSkill');
    
    if (!selectedSkill) {
        window.location.href = 'breakdown.html';
        return;
    }
    
    // Update the header with skill info
    document.getElementById('skill-title').textContent = selectedSkill;
    
    const skill = skillData[selectedSkill];
    if (skill) {
        document.getElementById('skill-score').textContent = skill.performance;
        document.getElementById('skill-progress-bar').style.width = skill.progressWidth + '%';
    }
    
    // Get wrong questions for this skill
    const questions = mockWrongQuestions[selectedSkill] || [];
    
    if (questions.length === 0) {
        document.getElementById('questions-container').innerHTML = `
            <div class="no-questions-review">
                <p>Great job! You haven't gotten any ${selectedSkill} questions wrong yet.</p>
                <p>Keep up the excellent work!</p>
            </div>
        `;
        return;
    }
    
    // Render the questions
    renderReviewQuestions(questions);
});

function renderReviewQuestions(questions) {
    const container = document.getElementById('questions-container');
    
    const questionsHTML = questions.map((question, index) => `
        <div class="review-question-card">
            <div class="review-question-number">Question ${index + 1}</div>
            <div class="review-question-text">${question.questionText}</div>
            
            ${renderReviewOptions(question)}
            
            <div class="review-answer-section">
                <div class="answer-comparison">
                    <div class="user-answer-label">
                        <span class="wrong-icon">✗</span> Your Answer: <strong class="wrong-answer">${question.userAnswer}</strong>
                    </div>
                    <div class="correct-answer-label">
                        <span class="correct-icon">✓</span> Correct Answer: <strong class="correct-answer">${question.correctAnswer}</strong>
                    </div>
                </div>
                <div class="review-explanation">
                    <strong>Explanation:</strong> ${question.explanation}
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = questionsHTML;
}

function renderReviewOptions(question) {
    if (!question.isMultipleChoice) {
        return '';
    }
    
    return `
        <div class="review-options">
            ${question.options.map(option => {
                const isUserAnswer = option === question.userAnswer;
                const isCorrectAnswer = option === question.correctAnswer;
                
                let className = 'review-option';
                if (isCorrectAnswer) {
                    className += ' option-correct';
                } else if (isUserAnswer) {
                    className += ' option-wrong';
                }
                
                return `
                    <div class="${className}">
                        <span class="option-text">${option}</span>
                        ${isCorrectAnswer ? '<span class="option-indicator">✓ Correct</span>' : ''}
                        ${isUserAnswer && !isCorrectAnswer ? '<span class="option-indicator">✗ Your choice</span>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}