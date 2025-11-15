// script.js
// Handles "page" switching and prepares for later question logic

document.addEventListener("DOMContentLoaded", () => {
    // Grab the important sections
    const landingSection = document.getElementById("landing");
    const trainerSection = document.getElementById("trainer");

    // Buttons / clickable items
    const startBtn = document.getElementById("start-session");
    const homeLink = document.getElementById("home-link");

    // This will later hold our questions (we'll expand this)
    const questions = [
        {
            topic: "Reading · Inference",
            text: "The author includes the detail about the neighbor mainly to show what?",
        },
        {
            topic: "Writing · Transitions",
            text: "Choose a transition that best connects two contrasting ideas in a paragraph.",
        },
        {
            topic: "Math · Linear equations",
            text: "A line passes through (2, 5) and (6, 17). How do you find its slope?",
        },
    ];

    // Elements inside the trainer page
    const questionText = document.getElementById("card-question-text");
    const topicChip = document.getElementById("topic-chip");
    const questionCounter = document.getElementById("question-counter");
    const answerInput = document.getElementById("card-answer-input");
    const nextBtn = document.getElementById("next-question");

    let currentIndex = 0;

    // Switch from landing → trainer
    startBtn.addEventListener("click", () => {
        landingSection.classList.add("hidden");
        trainerSection.classList.remove("hidden");

        // Load first question
        currentIndex = 0;
        loadQuestion();
    });

    // Click logo → go back to home
    homeLink.addEventListener("click", () => {
        trainerSection.classList.add("hidden");
        landingSection.classList.remove("hidden");
    });

    // Load a question onto the card
    function loadQuestion() {
        const q = questions[currentIndex];
        questionText.textContent = q.text;
        topicChip.textContent = `Topic: ${q.topic}`;
        questionCounter.textContent = `Question ${currentIndex + 1} / ${questions.length}`;
        answerInput.value = "";
    }

    // Go to next question
    nextBtn.addEventListener("click", () => {
        if (currentIndex < questions.length - 1) {
            currentIndex++;
            loadQuestion();
        } else {
            // session finished state
            questionText.textContent =
                "Great work! We'll soon generate an adaptive follow-up based on your responses.";
            topicChip.textContent = "Session complete";
            questionCounter.textContent = "";
            answerInput.disabled = true;
            nextBtn.disabled = true;
            nextBtn.textContent = "Done";
        }
    });
    
    // --- CHART.JS IMPLEMENTATION ---

// 1. Get the placeholder element by its ID
const chartElement = document.getElementById('snapshotChart');

// 2. Define the data for the chart (change these numbers for the hackathon!)
const chartData = {
    labels: ['Reading', 'Writing', 'Math'],
    datasets: [{
        label: 'Accuracy %', 
        data: [75, 80, 65],  // Example Accuracy Data
        backgroundColor: [
            'rgba(255, 99, 132, 0.7)', // Red
            'rgba(54, 162, 235, 0.7)', // Blue
            'rgba(255, 206, 86, 0.7)'  // Yellow
        ],
        borderWidth: 1
    }]
};

// 3. Create the new chart
new Chart(chartElement, {
    type: 'bar', // We are creating a Bar Chart
    data: chartData,
    options: {
        scales: {
            y: {
                beginAtZero: true,
                max: 100, // Max scale for percentages
                ticks: {
                    color: '#9ca3af' // Style the text to match your site's dark theme
                }
            },
            x: {
                ticks: {
                    color: '#9ca3af'
                }
            }
        },
        responsive: true,
        plugins: {
            legend: {
                display: false 
            }
        }
    }
});

// --- END CHART.JS IMPLEMENTATION ---
});
