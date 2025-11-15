// ai-explanation.js
// Gemini (via OpenRouter) AI integration for interactive explanations

// ==============================
// OpenRouter API Configuration
// ==============================

// IMPORTANT: Use an OpenRouter API key (sk-or-...)
// DO NOT use a Google gemini key here.
const OPENROUTER_API_KEY = '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';
// const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                // model: "google/gemini-2.5-pro", <-- slower
                model: "google/gemini-2.5-flash",
                // model: "google/gemini-2.0-flash-exp:free",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${text}`);
        }

        const data = await response.json();
        const explanation = data.choices?.[0]?.message?.content || "(No explanation returned)";

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
Explanation Text: ${question.explanationText}

Student's Reasoning: "${rationale}"

Please provide a helpful, encouraging explanation that:
1. Acknowledges what the student got right in their reasoning
2. Clearly explains why their answer was incorrect
3. Points to specific parts of the question or options that are relevant
4. Explains the correct answer in a way that helps them understand the concept
5. Uses references like [Option A] or [Question text: "specific phrase"] to point to elements
6. Uses the explanation text

Format your response in HTML with:
- <span class="highlight">text</span> for highlighting important concepts
- <span class="option-reference" data-option="A">Option A</span> for referencing options
- <span class="question-reference" data-text="specific text">text</span> for referencing question parts

Keep it concise (2-3 paragraphs) and encouraging.`;
}

function processExplanation(explanation, question) {
    // Convert [Option A] → clickable span
    let processed = explanation.replace(
        /\[Option ([A-D])\]/gi,
        '<span class="option-reference" data-option="$1">Option $1</span>'
    );

    // Convert [Question text: "phrase"]
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

    // Make question references clickable
    explanationElement.querySelectorAll('.question-reference').forEach(ref => {
        ref.style.cursor = 'pointer';
        ref.addEventListener('click', () => {
            const text = ref.dataset.text;
            highlightQuestionText(questionElement, text);
        });
    });
}

function highlightOption(optionsElement, optionLabel) {
    optionsElement.querySelectorAll('.option-item').forEach(item => {
        item.style.boxShadow = '';
    });

    const optionItem = optionsElement.querySelector(`[data-option="${optionLabel}"]`);
    if (optionItem) {
        optionItem.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
        optionItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            optionItem.style.boxShadow = '';
        }, 2000);
    }
}

function highlightQuestionText(questionElement, textToHighlight) {
    questionElement.style.backgroundColor = 'rgba(250, 204, 21, 0.3)';

    setTimeout(() => {
        questionElement.style.backgroundColor = '';
    }, 2000);
}
