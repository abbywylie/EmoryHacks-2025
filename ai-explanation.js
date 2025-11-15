// ai-explanation.js
// Gemini AI integration for interactive explanations

// Gemini API configuration
// NOTE: Replace with your actual Gemini API key
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Get AI explanation for a wrong answer based on user's rationale
 * @param {Object} question - The question object
 * @param {string} userAnswer - The user's selected answer
 * @param {string} rationale - The user's explanation of their reasoning
 * @returns {Promise<string>} - HTML formatted explanation with interactive elements
 */
export async function getAIExplanation(question, userAnswer, rationale) {
    try {
        const prompt = buildPrompt(question, userAnswer, rationale);
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const data = await response.json();
        const explanation = data.candidates[0].content.parts[0].text;
        
        // Process explanation to add interactive elements
        return processExplanation(explanation, question);
    } catch (error) {
        console.error("Error getting AI explanation:", error);
        return generateFallbackExplanation(question, userAnswer, rationale);
    }
}

function buildPrompt(question, userAnswer, rationale) {
    return `You are an SAT tutor helping a student understand why their answer was incorrect.

Question: ${question.text}

Options:
${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}

Correct Answer: ${question.correctAnswer}
Student's Answer: ${userAnswer}

Student's Reasoning: "${rationale}"

Please provide a helpful, encouraging explanation that:
1. Acknowledges what the student got right in their reasoning
2. Clearly explains why their answer was incorrect
3. Points to specific parts of the question or options that are relevant
4. Explains the correct answer in a way that helps them understand the concept
5. Uses references like [Option A] or [Question text: "specific phrase"] to point to elements

Format your response in HTML with:
- <span class="highlight">text</span> for highlighting important concepts
- <span class="option-reference" data-option="A">Option A</span> for referencing options
- <span class="question-reference" data-text="specific text">text</span> for referencing question parts

Keep it concise (2-3 paragraphs) and encouraging.`;
}

function processExplanation(explanation, question) {
    // The explanation should already have HTML tags from Gemini
    // We'll enhance it with interactive functionality
    
    // Ensure option references are clickable
    let processed = explanation.replace(
        /\[Option ([A-D])\]/gi,
        '<span class="option-reference" data-option="$1">Option $1</span>'
    );
    
    // Ensure question references are highlightable
    processed = processed.replace(
        /\[Question text: "([^"]+)"\]/gi,
        '<span class="question-reference highlight" data-text="$1">$1</span>'
    );
    
    return processed;
}

function generateFallbackExplanation(question, userAnswer, rationale) {
    return `
        <p>I see you chose <span class="option-reference" data-option="${userAnswer}">Option ${userAnswer}</span>.</p>
        <p>Your reasoning: "${rationale}"</p>
        <p>The correct answer is <span class="option-reference" data-option="${question.correctAnswer}">Option ${question.correctAnswer}</span>.</p>
        ${question.explanation ? `<p>${question.explanation}</p>` : ''}
    `;
}

/**
 * Apply interactive highlighting to the explanation
 * Makes option references and question references clickable
 */
export function applyInteractiveHighlights(explanationElement, questionElement, optionsElement) {
    // Make option references clickable
    explanationElement.querySelectorAll('.option-reference').forEach(ref => {
        ref.style.cursor = 'pointer';
        ref.addEventListener('click', () => {
            const optionLabel = ref.dataset.option;
            highlightOption(optionsElement, optionLabel);
        });
    });

    // Make question references highlightable
    explanationElement.querySelectorAll('.question-reference').forEach(ref => {
        ref.style.cursor = 'pointer';
        ref.addEventListener('click', () => {
            const textToHighlight = ref.dataset.text;
            highlightQuestionText(questionElement, textToHighlight);
        });
    });
}

function highlightOption(optionsElement, optionLabel) {
    // Remove previous highlights
    optionsElement.querySelectorAll('.option-item').forEach(item => {
        item.style.boxShadow = '';
    });

    // Highlight the referenced option
    const optionItem = optionsElement.querySelector(`[data-option="${optionLabel}"]`);
    if (optionItem) {
        optionItem.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
        optionItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
            optionItem.style.boxShadow = '';
        }, 2000);
    }
}

function highlightQuestionText(questionElement, textToHighlight) {
    // Create a temporary highlight
    const text = questionElement.textContent;
    const index = text.indexOf(textToHighlight);
    
    if (index !== -1) {
        // This is a simplified version - in production, you'd want to use ranges
        questionElement.style.backgroundColor = 'rgba(250, 204, 21, 0.3)';
        setTimeout(() => {
            questionElement.style.backgroundColor = '';
        }, 2000);
    }
}

