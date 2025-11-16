// tests.js
// Handles: loading/saving tests, CSV/PDF import, list rendering, chart, deletion

// --- NEW ---
// Import the API key from your config file
import { OPENROUTER_API_KEY } from './config.js';
import { applyTheme } from "./rewards/gatcha.js";

const STORAGE_KEY = "studydeck_tests_v1";

let tests = [];
let selectedTestId = null;
let scoreChart = null;

// (Add these two new functions to tests.js)



// ===== UTIL: storage =====
function loadTests() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        tests = raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error("Failed to load tests", e);
        tests = [];
    }
}

function saveTests() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
}

// ===== UTIL: helper =====
function makeId() {
    return "t_" + Math.random().toString(36).slice(2, 10);
}

// Very dumb date normalizer; tweak as needed
function normalizeDate(str) {
    // if already looks like YYYY-MM-DD, just return
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // handle "October 10, 2018"
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }
    return str; // last resort, store raw
}

// ===== CSV PARSING (PapaParse) =====
function importCsvRows(rows) {
    rows.forEach((row) => {
        if (!row.testDate && !row.totalScore) return;

        const test = {
            id: makeId(),
            testDate: normalizeDate(row.testDate || row.date || ""),
            totalScore: Number(row.totalScore || row.score || 0),
            readingWriting: Number(row.reading || row.readingWriting || 0),
            math: Number(row.math || 0),
            subscores: {
                craftStructure: Number(row.craftStructure || 0),
                infoIdeas: Number(row.infoIdeas || 0),
                stdEnglish: Number(row.stdEnglish || 0),
                expressionIdeas: Number(row.expressionIdeas || 0),
                algebra: Number(row.algebra || 0),
                advancedMath: Number(row.advancedMath || 0),
                psda: Number(row.psda || 0),
                geoTrig: Number(row.geoTrig || 0)
            },
            rawSource: "csv"
        };

        tests.push(test);
    });

    saveTests();
    renderTestsList();
    renderChart();
}

// ===== PDF PARSING WITH GEMINI AI =====

// --- DELETED ---
// const GEMINI_API_KEY = "sk-or-v1-71...";
// We now import this from config.js at the top of the file.

// Extract and parse SAT scores using Gemini AI
// ===== PDF PARSING WITH GEMINI AI =====

// (This function is in tests.js)
// ... (import OPENROUTER_API_KEY) ...




// Parse SAT/PSAT scores from OCR-extracted text
// OCR may have irregular spacing, so patterns are flexible
function parseSatPdfText(text) {
    console.log('📋 Parsing extracted text for SAT scores...');

    // Normalize whitespace for more reliable pattern matching
    const normalized = text.replace(/\s+/g, ' ');

    // Total score - try multiple patterns
    const totalMatch = normalized.match(/Total\s*Score\s*[:\s]*(\d{3,4})/i) ||
        normalized.match(/(?:Total|Overall)\s*[:\s]*(\d{3,4})/i) ||
        normalized.match(/Score\s*[:\s]*(\d{3,4})/i);

    // Section scores (Reading/Writing and Math)
    const rwMatch = normalized.match(/(?:Reading\s*(?:and|&|\+)?\s*Writing|Evidence-Based Reading and Writing|ERW)\s*(?:Score)?\s*[:\s]*(\d{2,3})/i);
    const mathMatch = normalized.match(/Math(?:ematics)?\s*(?:Score)?\s*[:\s]*(\d{2,3})/i);

    // Test date - multiple formats
    const dateMatch = normalized.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i) ||
        normalized.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/) ||
        normalized.match(/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/);

    // Log what we found
    console.log('Found scores:', {
        total: totalMatch?.[1],
        rw: rwMatch?.[1],
        math: mathMatch?.[1],
        date: dateMatch?.[0]
    });

    // Subscores (optional)
    function grab(label) {
        const re = new RegExp(label + "\\s*[:\\s]*([\\d]{1,2})", "i");
        const m = normalized.match(re);
        return m ? Number(m[1]) : 0;
    }

    const subscores = {
        craftStructure: grab("Craft and Structure"),
        infoIdeas: grab("Information and Ideas"),
        stdEnglish: grab("Standard English Conventions"),
        expressionIdeas: grab("Expression of Ideas"),
        algebra: grab("Algebra"),
        advancedMath: grab("Advanced Math"),
        psda: grab("Problem Solving & Data Analysis|Problem Solving and Data Analysis"),
        geoTrig: grab("Geometry & Trigonometry|Geometry and Trigonometry")
    };

    return {
        testDate: dateMatch ? normalizeDate(dateMatch[0]) : "",
        totalScore: totalMatch ? Number(totalMatch[1]) : 0,
        readingWriting: rwMatch ? Number(rwMatch[1]) : 0,
        math: mathMatch ? Number(mathMatch[1]) : 0,
        subscores
    };
}

// (This function is in tests.js)

// (This is the only function to replace in tests.js)

async function extractPdfWithGemini(file) {
    console.log("🤖 Starting PDF extraction process...");

    if (!OPENROUTER_API_KEY) {
        throw new Error("API key not found. Please check config.js");
    }
    if (typeof window.pdfjsLib === 'undefined') {
        throw new Error("PDF.js library not loaded");
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`📄 PDF loaded: ${pdf.numPages} pages`);

    if (pdf.numPages < 1) {
        throw new Error(`PDF is empty or invalid.`);
    }

    let promptText, requestBody;

    // Determine format based on page count
    // SAT reports typically have 1-3 pages, PSAT reports have 4+ pages
    const isPSAT = pdf.numPages >= 4;

    if (!isPSAT) {
        // SAT FORMAT (Page 1 only)
        console.log("📋 Processing as SAT format (page 1)...");
        
        const page1 = await pdf.getPage(1);
        const scale1 = 2.0;
        const viewport1 = page1.getViewport({ scale: scale1 });
        const canvas1 = document.createElement('canvas');
        const context1 = canvas1.getContext('2d');
        canvas1.height = viewport1.height;
        canvas1.width = viewport1.width;
        await page1.render({ canvasContext: context1, viewport: viewport1 }).promise;
        const page1Image = canvas1.toDataURL('image/png').split(',')[1];
        console.log(`🖼️ Page 1 rendered (${canvas1.width}x${canvas1.height})`);

        promptText = `You are an AI assistant reading an SAT score report.

Extract ALL score data from this SAT report image into a JSON object.

CRITICAL INSTRUCTIONS:
- Return ONLY a single valid JSON object
- Use null for any value not found in the image
- The SAT has a composite score from 400-1600
- Reading and Writing section: 200-800
- Math section: 200-800

Required JSON format:
{
  "testType": "SAT",
  "testDate": "YYYY-MM-DD",
  "compositeScore": 1200,
  "sections": {
    "readingWriting": 600,
    "math": 600
  },
  "subscores": {
    "Command of Evidence": 8,
    "Words in Context": 8,
    "Expression of Ideas": 8,
    "Standard English Conventions": 8,
    "Heart of Algebra": 8,
    "Problem Solving and Data Analysis": 8,
    "Passport to Advanced Math": 8,
    "Geometry and Trigonometry": 8
  }
}

Look for:
- Total/Composite Score (400-1600)
- Evidence-Based Reading and Writing OR Reading and Writing score (200-800)
- Math score (200-800)
- Test date (usually in format like "October 10, 2023")
- Any subscores or test scores visible on the page

Return ONLY the JSON object, no other text.`;

        requestBody = {
            model: "anthropic/claude-3-haiku",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Here is the SAT score report:" },
                        { type: "image_url", image_url: { url: `data:image/png;base64,${page1Image}` } },
                        { type: "text", text: promptText }
                    ]
                }
            ]
        };
    } else {
        // PSAT FORMAT (Pages 2 and 4)
        console.log("📋 Processing as PSAT format (pages 2 and 4)...");
        
        const page2 = await pdf.getPage(2);
        const scale2 = 2.0;
        const viewport2 = page2.getViewport({ scale: scale2 });
        const canvas2 = document.createElement('canvas');
        const context2 = canvas2.getContext('2d');
        canvas2.height = viewport2.height;
        canvas2.width = viewport2.width;
        await page2.render({ canvasContext: context2, viewport: viewport2 }).promise;
        const page2Image = canvas2.toDataURL('image/png').split(',')[1];
        console.log(`🖼️ Page 2 rendered (${canvas2.width}x${canvas2.height})`);

        const page4 = await pdf.getPage(4);
        const scale4 = 2.0;
        const viewport4 = page4.getViewport({ scale: scale4 });
        const canvas4 = document.createElement('canvas');
        const context4 = canvas4.getContext('2d');
        canvas4.height = viewport4.height;
        canvas4.width = viewport4.width;
        await page4.render({ canvasContext: context4, viewport: viewport4 }).promise;
        const page4Image = canvas4.toDataURL('image/png').split(',')[1];
        console.log(`🖼️ Page 4 rendered (${canvas4.width}x${canvas4.height})`);

        promptText = `You are an AI assistant reading a PSAT score report.

I'm providing you with TWO pages:
- First image: Page 2 (main scores)
- Second image: Page 4 (question breakdown)

Extract ALL data from BOTH pages into a single JSON object.

CRITICAL INSTRUCTIONS:
- Return ONLY a single valid JSON object
- Use null for any value not found
- PSAT composite scores range from 320-1520
- Section scores: 160-760 each

Required JSON format:
{
  "testType": "PSAT",
  "testDate": "YYYY-MM-DD",
  "compositeScore": 1100,
  "sections": {
    "readingWriting": 540,
    "math": 560
  },
  "testScores": {
    "reading": 27,
    "writingAndLanguage": 27,
    "math": 28
  },
  "breakdown": {
    "reading": { "total": 47, "correct": 27, "incorrect": 20, "omitted": 0 },
    "writingAndLanguage": { "total": 44, "correct": 27, "incorrect": 17, "omitted": 0 },
    "mathCalculator": { "total": 31, "correct": 20, "incorrect": 11, "omitted": 0 },
    "mathNoCalculator": { "total": 17, "correct": 9, "incorrect": 4, "omitted": 0 }
  }
}

From Page 2, extract:
- Total Score (320-1520)
- Reading and Writing section score (160-760)
- Math section score (160-760)
- Test date
- Test scores (8-38 scale)

From Page 4, extract:
- Question breakdowns showing total/correct/incorrect/omitted for each section

Return ONLY the JSON object, no other text.`;

        requestBody = {
            model: "anthropic/claude-3-haiku",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Here is Page 2 of the PSAT score report:" },
                        { type: "image_url", image_url: { url: `data:image/png;base64,${page2Image}` } },
                        { type: "text", text: "Here is Page 4 of the PSAT score report:" },
                        { type: "image_url", image_url: { url: `data:image/png;base64,${page4Image}` } },
                        { type: "text", text: promptText }
                    ]
                }
            ]
        };
    }

    // Make API call
    const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }
    );

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        const error = await response.text();
        console.error('❌ API Error Response:', error);
        throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const textResponse = data.choices[0].message.content;
    console.log('📝 Raw AI text response:', textResponse);

    // Extract JSON from response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.warn("Could not find JSON in AI response. Response was:", textResponse);
        throw new Error("AI did not return valid JSON. Please try uploading the PDF again.");
    }

    const scores = JSON.parse(jsonMatch[0]);
    console.log(`📊 Parsed scores (raw):`, scores);

    // Auto-calculate total score if missing
    if (!scores.compositeScore && scores.sections?.readingWriting && scores.sections?.math) {
        scores.compositeScore = scores.sections.readingWriting + scores.sections.math;
        console.log(`✨ Calculated compositeScore from sections: ${scores.compositeScore}`);
    }

    if (!scores.compositeScore) {
        console.warn('⚠️ Warning: No composite/total score found!');
        throw new Error("Could not extract scores from PDF. Please check if this is a valid score report.");
    }

    console.log("✅ Final parsed scores:", scores);
    return scores;
}

async function importPdf(file) {
    console.log("=== STARTING PDF UPLOAD ===");
    console.log("File:", file.name);

    try {
        console.log("⏳ Calling extractPdfWithGemini (2-pass)...");
        const parsed = await extractPdfWithGemini(file);

        console.log("✅ Extraction complete!");
        console.log("Parsed results:", parsed);

        const test = {
            id: makeId(),
            testDate: parsed.testDate || "",
            totalScore: parsed.compositeScore || 0,
            readingWriting: parsed.sections?.readingWriting || 0,
            math: parsed.sections?.math || 0,
            testScores: parsed.testScores || {},
            
            // --- NEW ---
            breakdown: parsed.breakdown || {}, // Save the new breakdown data
            // --- END NEW ---

            subscores: parsed.subscores || {}, // This might be null now, that's ok
            rawSource: `pdf (${parsed.testType || 'Unknown'})`
        };

        tests.push(test);
        saveTests();
        renderTestsList();
        renderChart();

        console.log("✅ PDF imported successfully!");
        alert(`${parsed.testType || 'Test'} imported successfully! Score: ${parsed.compositeScore || 'N/A'} 🎉`);
        closeModal();

    } catch (e) {
        console.error("❌ PDF import failed:", e);
        alert(`Could not read PDF: ${e.message}\n\nCheck console for details.`);
    }
}

// ===== RENDER: tests list & details =====

const testsListEl = document.getElementById("tests-list");
const detailsEl = document.getElementById("test-details");

// (Replace the old renderTestsList in tests.js with this one)

function renderTestsList() {
    if (!testsListEl) return;

    // --- NEW: Add a grid class to the container ---
    testsListEl.className = 'test-card-grid';

    if (!tests.length) {
        testsListEl.innerHTML = "<p>No tests stored yet. Upload a CSV or PDF to get started.</p>";
        detailsEl.classList.add("hidden");
        return;
    }

    // Sort by date ascending
    const sorted = [...tests].sort((a, b) => (a.testDate > b.testDate ? 1 : -1));

    // --- NEW: Card-based HTML structure ---
    testsListEl.innerHTML = sorted
        .map(
            (t) => `
      <div class="test-card-item" data-id="${t.id}">
        <div class="test-card-header">
          <span class="test-card-date">${t.testDate || "Unknown date"}</span>
          <span class="test-card-type">${t.rawSource.replace('pdf (', '').replace(')', '') || 'Test'}</span>
        </div>
        <div class="test-card-body">
          <div class="test-card-score-total">
            <span class="score-label">Total</span>
            <span class="score-value">${t.totalScore || "?"}</span>
          </div>
          <div class="test-card-score-sections">
            <div class="section-score">
              <span class="score-label">R&W</span>
              <span class="score-value-small">${t.readingWriting || "?"}</span>
            </div>
            <div class="section-score">
              <span class="score-label">Math</span>
              <span class="score-value-small">${t.math || "?"}</span>
            </div>
          </div>
        </div>
        <div class="test-card-actions">
          <button class="ghost-btn view-test-btn" data-id="${t.id}">View Details</button>
          <button class="ghost-btn danger delete-test-btn" data-id="${t.id}">Delete</button>
        </div>
      </div>
    `
        )
        .join("");

    // Attach listeners (no change here)
    testsListEl.querySelectorAll(".view-test-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            selectedTestId = id;
            const test = tests.find((t) => t.id === id);
            if (test) renderTestDetails(test);
        });
    });

    testsListEl.querySelectorAll(".delete-test-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            deleteTest(id);
        });
    });
}


// (Replace the old renderTestDetails in tests.js with this one)

function renderTestDetails(test) {
    if (!detailsEl) return;

    // --- NEW HELPER FUNCTION ---
    // This helper correctly handles '0' and shows it,
    // but shows '?' for null or undefined.
    function getStat(value) {
        if (value === null || value === undefined) {
            return '?';
        }
        return value; // This will now correctly return 0
    }
    // --- END HELPER ---


    // Safely get all the new data
    const testReading = getStat(test.testScores?.reading);
    const testWriting = getStat(test.testScores?.writingAndLanguage);
    const testMath = getStat(test.testScores?.math);
    
    // Get breakdown data, or set defaults
    const breakdown = test.breakdown || {};
    const readBD = breakdown.reading || {};
    const writeBD = breakdown.writingAndLanguage || {};
    const mathCalcBD = breakdown.mathCalculator || {};
    const mathNoCalcBD = breakdown.mathNoCalculator || {};
    // --- End data prep ---

    detailsEl.innerHTML = `
    <h3>Test Score Summary</h3>
    <p>
      <strong>Test Type:</strong> ${test.rawSource.replace('pdf (', '').replace(')', '') || 'N/A'}
      <br>
      <strong>Test Date:</strong> ${test.testDate || "Unknown"}
    </p>

    <!-- Main Section Scores (200-800) -->
    <div class="score-summary-grid">
      <div class="score-summary-card total">
        <div class="score-label">Total Score</div>
        <div class="score-value">${getStat(test.totalScore)}</div>
      </div>
      <div class="score-summary-card">
        <div class="score-label">Reading & Writing</div>
        <div class="score-value">${getStat(test.readingWriting)}</div>
      </div>
      <div class="score-summary-card">
        <div class="score-label">Math</div>
        <div class="score-value">${getStat(test.math)}</div>
      </div>
    </div>


    <!-- NEW SECTION: Question Breakdown (from Page 4) -->
    <h4 class="details-header">Question Breakdown</h4>
    
    <!-- Reading -->
    <div class="breakdown-card">
      <div class="breakdown-title">Reading</div>
      <div class="breakdown-stats">
        <div><span class="stat-label">Total:</span> ${getStat(readBD.total)}</div>
        <div><span class="stat-label">Correct:</span> ${getStat(readBD.correct)}</div>
        <div><span class="stat-label">Incorrect:</span> ${getStat(readBD.incorrect)}</div>
        <div><span class="stat-label">Omitted:</span> ${getStat(readBD.omitted)}</div>
      </div>
    </div>
    
    <!-- Writing & Language -->
    <div class="breakdown-card">
      <div class="breakdown-title">Writing & Language</div>
      <div class="breakdown-stats">
        <div><span class="stat-label">Total:</span> ${getStat(writeBD.total)}</div>
        <div><span class="stat-label">Correct:</span> ${getStat(writeBD.correct)}</div>
        <div><span class="stat-label">Incorrect:</span> ${getStat(writeBD.incorrect)}</div>
        <div><span class="stat-label">Omitted:</span> ${getStat(writeBD.omitted)}</div>
      </div>
    </div>

    <!-- Math - Calculator -->
    <div class="breakdown-card">
      <div class="breakdown-title">Math - Calculator</div>
      <div class="breakdown-stats">
        <div><span class="stat-label">Total:</span> ${getStat(mathCalcBD.total)}</div>
        <div><span class="stat-label">Correct:</span> ${getStat(mathCalcBD.correct)}</div>
        <div><span class="stat-label">Incorrect:</span> ${getStat(mathCalcBD.incorrect)}</div>
        <div><span class="stat-label">Omitted:</span> ${getStat(mathCalcBD.omitted)}</div>
      </div>
    </div>

    <!-- Math - No Calculator -->
    <div class="breakdown-card">
      <div class="breakdown-title">Math - No Calculator</div>
      <div class="breakdown-stats">
        <div><span class="stat-label">Total:</span> ${getStat(mathNoCalcBD.total)}</div>
        <div><span class="stat-label">Correct:</span> ${getStat(mathNoCalcBD.correct)}</div>
        <div><span class="stat-label">Incorrect:</span> ${getStat(mathNoCalcBD.incorrect)}</div>
        <div><span class="stat-label">Omitted:</span> ${getStat(mathNoCalcBD.omitted)}</div>
      </div>
    </div>
  `;
    detailsEl.classList.remove("hidden");
}

function deleteTest(id) {
    const wasSelected = selectedTestId === id;
    tests = tests.filter((t) => t.id !== id);
    saveTests();
    renderTestsList();
    renderChart();

    if (wasSelected) {
        selectedTestId = null;
        if (detailsEl) detailsEl.classList.add("hidden");
    }
}

// ===== CHART (Chart.js) =====
// (Replace the old renderChart in tests.js with this one)

// ===== CHART (Chart.js) =====
function renderChart() {
    const canvas = document.getElementById("score-trend");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!tests.length) {
        canvas.style.display = "none";
        if (scoreChart) {
            scoreChart.destroy();
            scoreChart = null;
        }
        return;
    }

    canvas.style.display = "block";

    const sorted = [...tests].sort((a, b) => (a.testDate > b.testDate ? 1 : -1));
    const labels = sorted.map((t) => t.testDate || "");
    const totals = sorted.map((t) => t.totalScore || 0);

    // --- NEW: Create a gradient for the fill ---
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)'); // Your --primary-color
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    // --- END NEW ---

    if (scoreChart) {
        scoreChart.destroy();
        scoreChart = null;
    }

    scoreChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Total Score",
                    data: totals,
                    tension: 0.3,
                    
                    // --- NEW STYLES ---
                    borderColor: '#3b82f6', // Your --primary-color
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: gradient,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointHoverBorderWidth: 3,
                    // --- END NEW STYLES ---
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allows height to be set by CSS
            plugins: {
                legend: { display: false }, // No legend
                
                // --- NEW: Custom Tooltip ---
                tooltip: {
                    enabled: true,
                    backgroundColor: '#020617', // Your dark bg
                    titleColor: '#9ca3af',
                    titleFont: { size: 12, weight: 'normal' },
                    bodyColor: '#e5e7eb',
                    bodyFont: { size: 14, weight: 'bold' },
                    borderColor: 'rgba(148, 163, 184, 0.22)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false, // Hide the little color box
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return `Score: ${context.parsed.y}`;
                        },
                        title: function(context) {
                            return context[0].label; // Show the date
                        }
                    }
                }
                // --- END NEW TOOLTIP ---
            },
            scales: {
                y: {
                    beginAtZero: false,
                    suggestedMin: Math.min(...totals) - 50,
                    suggestedMax: Math.max(...totals) + 50,
                    
                    // --- NEW: Hide the axis labels ---
                    ticks: {
                        display: false
                    },
                    grid: {
                        drawBorder: false, // No border
                        color: 'rgba(148, 163, 184, 0.1)' // Lighter grid lines
                    }
                },
                x: {
                    ticks: {
                        color: '#9ca3af', // Style the date labels
                        font: { size: 12 }
                    },
                    grid: {
                        display: false, // No vertical grid lines
                        drawBorder: false
                    }
                }
            }
        }
    });
}

// ===== UPLOAD MODAL WIRES =====
const uploadModal = document.getElementById("upload-modal");
const uploadBackdrop = document.getElementById("upload-backdrop");
const openUploadBtn = document.getElementById("open-upload-modal");
const closeUploadBtn = document.getElementById("upload-close-btn");
const uploadInput = document.getElementById("upload-input");
const selectFileBtn = document.getElementById("upload-select-btn");
const dropzone = document.getElementById("upload-dropzone");
const clearBtn = document.getElementById("clear-tests-btn");
const refreshBtn = document.getElementById("view-scores-btn");

function openModal() {
    uploadModal.classList.remove("hidden");
    uploadModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    uploadModal.classList.add("hidden");
    uploadModal.setAttribute("aria-hidden", "true");
}

if (openUploadBtn) openUploadBtn.addEventListener("click", openModal);
if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeModal);
if (uploadBackdrop) uploadBackdrop.addEventListener("click", closeModal);

if (selectFileBtn) {
    selectFileBtn.addEventListener("click", () => uploadInput && uploadInput.click());
}

if (uploadInput) {
    uploadInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    importCsvRows(results.data);
                    closeModal();
                },
                error: (err) => {
                    console.error(err);
                    alert("Could not parse CSV.");
                }
            });
        } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
            await importPdf(file);
            closeModal();
        } else {
            alert("Please upload a CSV or PDF file.");
        }

        uploadInput.value = "";
    });
}

// drag & drop
if (dropzone) {
    ["dragenter", "dragover"].forEach((ev) =>
        dropzone.addEventListener(ev, (e) => {
            e.preventDefault();
            dropzone.classList.add("drag-over");
        })
    );
    ["dragleave", "drop"].forEach((ev) =>
        dropzone.addEventListener(ev, (e) => {
            e.preventDefault();
            dropzone.classList.remove("drag-over");
        })
    );
    dropzone.addEventListener("drop", async (e) => {
        const file = e.dataTransfer.files[0];
        if (!file) return;

        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    importCsvRows(results.data);
                    closeModal();
                },
                error: (err) => {
                    console.error(err);
                    alert("Could not parse CSV.");
                }
            });
        } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
            await importPdf(file);
            closeModal();
        } else {
            alert("Please upload a CSV or PDF file.");
        }
    });
}

// Clear tests
if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        if (!confirm("Clear all stored tests?")) return;
        tests = [];
        saveTests();
        renderTestsList();
        renderChart();
    });
}

// Refresh
if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
        loadTests();
        renderTestsList();
        renderChart();
    });
}

// ===== INITIALIZE =====
loadTests();
renderTestsList();
renderChart();
applyTheme();