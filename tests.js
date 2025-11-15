// tests.js
// Handles: loading/saving tests, CSV/PDF import, list rendering, chart, deletion

const STORAGE_KEY = "studydeck_tests_v1";

let tests = [];
let selectedTestId = null;
let scoreChart = null;

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

// Your Gemini API key - get one free at https://aistudio.google.com/apikey
const GEMINI_API_KEY = "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";

// Extract and parse SAT scores using Gemini 2.0 Flash vision
async function extractPdfWithGemini(file) {
    console.log("🤖 Starting Gemini AI PDF extraction...");

    if (!GEMINI_API_KEY) {
        throw new Error("Please add your Gemini API key to tests.js");
    }

    // Check if PDF.js is loaded
    if (typeof window.pdfjsLib === 'undefined') {
        throw new Error("PDF.js library not loaded");
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    console.log(`📄 PDF loaded: ${pdf.numPages} pages`);

    // Render first page to image (scores are typically on page 1)
    const page = await pdf.getPage(1);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    console.log(`🖼️ Page rendered (${canvas.width}x${canvas.height})`);

    // Convert to base64 image
    const base64Image = canvas.toDataURL('image/png').split(',')[1];

    console.log(`🤖 Sending to Gemini AI via OpenRouter...`);
    console.log(`📊 Image size: ${base64Image.length} characters`);

    const requestBody = {
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `You are reading an SAT or PSAT score report PDF. Extract ALL visible scores.

CRITICAL: Look very carefully for the TOTAL SCORE - it's usually the biggest number on the page, often 4 digits (e.g., 1200, 1450). It might be labeled as:
- "Total Score"
- "Composite Score" 
- Just a large number near the top
- The sum of Reading/Writing + Math sections

Also extract these if visible:
- Test date (any date on the report)
- Reading and Writing section score (200-800)
- Math section score (200-800)
- Subscores (if shown): reading, writing, command of evidence, words in context, expression of ideas, algebra, advanced math, problem solving

Return ONLY this JSON (use null if not found):
{
  "testDate": "YYYY-MM-DD",
  "totalScore": 1234,
  "readingWriting": 567,
  "math": 567,
  "reading": 34,
  "writing": 34,
  "command": 12,
  "words": 12,
  "expression": 12,
  "algebra": 12,
  "advancedMath": 12,
  "problemSolving": 12
}

DO NOT return any explanation, ONLY the JSON object.`
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/png;base64,${base64Image}`
                        }
                    }
                ]
            }
        ]
    };

    console.log('📤 Request payload:', {
        model: requestBody.model,
        messageCount: requestBody.messages.length,
        contentParts: requestBody.messages[0].content.length,
        hasImage: requestBody.messages[0].content[1].type === 'image_url'
    });

    // Call Gemini API via OpenRouter
    const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GEMINI_API_KEY}`,
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
    console.log('📦 Full API Response:', data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ Unexpected response structure:', data);
        throw new Error('Invalid API response structure');
    }

    const textResponse = data.choices[0].message.content;

    console.log(`✅ Gemini response received (${textResponse.length} chars)`);
    console.log('📝 Response content:', textResponse);

    // Parse JSON from response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Could not find JSON in Gemini response");
    }

    const scores = JSON.parse(jsonMatch[0]);
    console.log(`📊 Parsed scores (raw):`, scores);

    // FALLBACK: If totalScore is missing but we have section scores, calculate it
    if (!scores.totalScore && scores.readingWriting && scores.math) {
        scores.totalScore = scores.readingWriting + scores.math;
        console.log(`✨ Calculated totalScore from sections: ${scores.totalScore}`);
    }

    // Validate we have at least a total score
    if (!scores.totalScore) {
        console.warn('⚠️ Warning: No total score found in response!');
        console.log('💡 Tip: Check if the PDF image is clear and the total score is visible');
    }

    console.log(`📊 Final scores:`, scores);
    return scores;
}

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

async function importPdf(file) {
    console.log("=== STARTING PDF UPLOAD ===");
    console.log("File:", file.name);
    console.log("File size:", (file.size / 1024).toFixed(2), "KB");
    console.log("File type:", file.type);

    try {
        // Extract and parse scores using Gemini AI
        console.log("⏳ Calling extractPdfWithGemini...");
        const parsed = await extractPdfWithGemini(file);

        console.log("✅ Extraction complete!");
        console.log("Parsed results:", parsed);

        // Create test entry
        const test = {
            id: makeId(),
            testDate: parsed.testDate || "",
            totalScore: parsed.totalScore || 0,
            readingWriting: parsed.readingWriting || 0,
            math: parsed.math || 0,
            subscores: {
                reading: parsed.reading || 0,
                writing: parsed.writing || 0,
                command: parsed.command || 0,
                words: parsed.words || 0,
                expression: parsed.expression || 0,
                algebra: parsed.algebra || 0,
                advancedMath: parsed.advancedMath || 0,
                problemSolving: parsed.problemSolving || 0
            },
            rawSource: "pdf"
        };

        tests.push(test);
        saveTests();
        renderTestsList();
        renderChart();

        console.log("✅ PDF imported successfully!");
        alert("PDF imported successfully! 🎉");

    } catch (e) {
        console.error("❌ PDF import failed:", e);
        alert(`Could not read PDF: ${e.message}\n\nCheck console for details.`);
    }
}

// ===== RENDER: tests list & details =====

const testsListEl = document.getElementById("tests-list");
const detailsEl = document.getElementById("test-details");

function renderTestsList() {
    if (!testsListEl) return;

    if (!tests.length) {
        testsListEl.innerHTML = "<p>No tests stored yet. Upload a CSV or PDF to get started.</p>";
        detailsEl.classList.add("hidden");
        return;
    }

    // Sort by date ascending
    const sorted = [...tests].sort((a, b) => (a.testDate > b.testDate ? 1 : -1));

    testsListEl.innerHTML = sorted
        .map(
            (t) => `
      <div class="test-row" data-id="${t.id}">
        <div class="test-row-main">
          <div><strong>${t.testDate || "Unknown date"}</strong></div>
          <div class="muted">Total: ${t.totalScore || "?"} (RW: ${t.readingWriting || "?"
                }, Math: ${t.math || "?"})</div>
        </div>
        <div class="test-row-actions">
          <button class="ghost-btn view-test-btn" data-id="${t.id}">View</button>
          <button class="ghost-btn danger delete-test-btn" data-id="${t.id}">Delete</button>
        </div>
      </div>
    `
        )
        .join("");

    // Attach listeners
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

function renderTestDetails(test) {
    if (!detailsEl) return;

    const s = test.subscores || {};
    detailsEl.innerHTML = `
    <h3>Knowledge and Skills</h3>
    <p><strong>Date:</strong> ${test.testDate || "Unknown"}</p>
    <p><strong>Score:</strong> ${test.totalScore || "?"}</p>

    <h4>Reading and Writing</h4>
    <p><strong>Your Reading and Writing Score:</strong> ${test.readingWriting || "?"}</p>
    <ul>
      <li>Craft and Structure: ${s.craftStructure || 0}</li>
      <li>Information and Ideas: ${s.infoIdeas || 0}</li>
      <li>Standard English Conventions: ${s.stdEnglish || 0}</li>
      <li>Expression of Ideas: ${s.expressionIdeas || 0}</li>
    </ul>

    <h4>Math</h4>
    <p><strong>Your Math Score:</strong> ${test.math || "?"}</p>
    <ul>
      <li>Algebra: ${s.algebra || 0}</li>
      <li>Advanced Math: ${s.advancedMath || 0}</li>
      <li>Problem Solving & Data Analysis: ${s.psda || 0}</li>
      <li>Geometry & Trigonometry: ${s.geoTrig || 0}</li>
    </ul>
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
function renderChart() {
    const canvas = document.getElementById("score-trend");
    if (!canvas) return;

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

    if (scoreChart) {
        scoreChart.destroy();
    }

    scoreChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Total Score",
                    data: totals,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: false, suggestedMin: 200, suggestedMax: 1600 }
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
