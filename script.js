document.addEventListener('DOMContentLoaded', () => {
    let availableTexts = [];
    let currentTextData = [];
    let currentVerse = null;
    let allowedTypes = [];
    
    // For Matching Game Variables
    let selectedLeft = null;
    let matchesFound = 0;
    let totalMatches = 0;

    // DOM Elements
    const selectionScreen = document.getElementById('selection-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const textSelect = document.getElementById('text-select');
    const startBtn = document.getElementById('start-btn');
    const backBtn = document.getElementById('back-btn');
    const currentTextTitle = document.getElementById('current-text-title');
    const questionTypeLabel = document.getElementById('question-type-label');
    const questionBox = document.getElementById('question-box');
    const answerBox = document.getElementById('answer-box');
    const feedbackMessage = document.getElementById('feedback-message');
    const nextBtn = document.getElementById('next-btn');
    const quizCard = document.getElementById('quiz-card');
    
    // Note: 'action-btn' is re-queried dynamically because we clone it

    // 1. Initialize (FIXED: Hardcoded list to prevent loading errors)
    availableTexts = [
        { "filename": "BhagavadGita.json", "name": "श्रीमद्भगवद्गीता" },
        { "filename": "ShriHitChaurasi.json", "name": "श्री हित चौरासी" }
    ];

    // Populate dropdown immediately
    textSelect.innerHTML = '<option value="">-- Select a Text --</option>';
    availableTexts.forEach(t => {
        let opt = document.createElement('option');
        opt.value = t.filename;
        opt.textContent = t.name;
        textSelect.appendChild(opt);
    });
    // 2. Start Quiz Logic (Updated with Range Filter)
    startBtn.addEventListener('click', async () => {
        const filename = textSelect.value;
        const selectedTextObj = availableTexts.find(t => t.filename === filename);
        
        // Get Checkboxes
        const checkboxes = document.querySelectorAll('input[name="qtype"]:checked');
        allowedTypes = Array.from(checkboxes).map(cb => cb.value);

        if (allowedTypes.length === 0) {
            alert("Please select at least one question type.");
            return;
        }

        // Get Range Inputs
        const startVal = document.getElementById('start-verse').value.trim();
        const endVal = document.getElementById('end-verse').value.trim();

        try {
            startBtn.textContent = "Loading...";
            
            // 1. Fetch Data
            // Note: Since you are using the 'Index.json' fix, ensure filename is correct
            const res = await fetch(`data/${filename}`);
            if(!res.ok) throw new Error("File not found");
            let fullData = await res.json();

            // 2. Filter Data based on Range
            if (startVal || endVal) {
                currentTextData = fullData.filter(verse => {
                    return isVerseInRange(verse.number, startVal, endVal);
                });
            } else {
                currentTextData = fullData;
            }

            // Validation
            if (currentTextData.length === 0) {
                alert("No verses found in that range! Check your numbers (e.g., 1.1 to 1.5).");
                startBtn.textContent = "Start Learning";
                return;
            }

            currentTextTitle.textContent = selectedTextObj.name + ` (${currentTextData.length} Verses)`;
            
            selectionScreen.classList.remove('active');
            quizScreen.classList.add('active');
            nextQuestion();

        } catch (err) {
            alert("Error loading text data. Check console.");
            console.error(err);
        } finally {
            startBtn.textContent = "Start Learning";
        }
    });
   
    // 3. Back Button - FORCE RELOAD to prevent state errors
    backBtn.addEventListener('click', () => {
        window.location.reload(); 
    });

    nextBtn.addEventListener('click', nextQuestion);

    // 4. Question Router
    function nextQuestion() {
        resetState();
        
        // Trigger Animation
        quizCard.classList.remove('animate-fade');
        void quizCard.offsetWidth; // Trigger reflow
        quizCard.classList.add('animate-fade');

        if(!currentTextData.length) {
            questionBox.innerHTML = "No verses found in data.";
            return;
        }

        // Pick Random Verse (for single-verse questions)
        const randomIndex = Math.floor(Math.random() * currentTextData.length);
        currentVerse = currentTextData[randomIndex];

        // Pick Random Question Type
        const typeIndex = Math.floor(Math.random() * allowedTypes.length);
        const type = allowedTypes[typeIndex];

        if (type === 'flashcard') setupFlashcard();
        else if (type === 'guessNumber') setupGuessNumber();
        else if (type === 'fillBlanksShlok') setupFillBlanks(true);
        else if (type === 'fillBlanksMeaning') setupFillBlanks(false);
        else if (type === 'matching') setupMatchingGame();
    }

    function resetState() {
        feedbackMessage.textContent = '';
        feedbackMessage.className = '';
        answerBox.classList.add('hidden');
        answerBox.innerHTML = '';
        nextBtn.classList.add('hidden');
        
        // Get current action button
        const oldBtn = document.getElementById('action-btn');
        oldBtn.classList.remove('hidden');
        
        // Clone button to remove old event listeners (Cleanest way for vanilla JS)
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        
        questionBox.innerHTML = '';
    }

    // --- Type 1: Flashcards ---
    function setupFlashcard() {
        const btn = document.getElementById('action-btn');
        const isShlokToMeaning = Math.random() > 0.5;
        
        questionTypeLabel.textContent = isShlokToMeaning ? "Recall Meaning" : "Recall Shlok";
        btn.textContent = "Reveal Answer";

        if(isShlokToMeaning) {
            questionBox.innerHTML = `<div class="shlok-text">${currentVerse.shlok}</div><div class="number-text">(${currentVerse.number})</div>`;
            answerBox.innerHTML = `<div class="meaning-text">${currentVerse.meaning}</div>`;
        } else {
            questionBox.innerHTML = `<div class="meaning-text">${currentVerse.meaning}</div><div class="number-text">(${currentVerse.number})</div>`;
            answerBox.innerHTML = `<div class="shlok-text">${currentVerse.shlok}</div>`;
        }

        btn.onclick = () => {
            answerBox.classList.remove('hidden');
            btn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
        };
    }

    // --- Type 2: Guess Number ---
    function setupGuessNumber() {
        const btn = document.getElementById('action-btn');
        questionTypeLabel.textContent = "What is the verse number?";
        btn.textContent = "Check";
        
        questionBox.innerHTML = `<div class="shlok-text">${currentVerse.shlok}</div>
            <div style="margin-top:15px;">
                <input type="text" id="num-guess" class="blank-input" placeholder="e.g. 1.1">
            </div>`;

        btn.onclick = () => {
            const input = document.getElementById('num-guess');
            const userVal = cleanString(input.value);
            const correctVal = cleanString(currentVerse.number.toString());
            
            if(userVal === correctVal) {
                showFeedback("Correct! (सही)", true);
                input.classList.add('correct');
                btn.classList.add('hidden');
                nextBtn.classList.remove('hidden');
            } else {
                showFeedback(`Incorrect. It is ${currentVerse.number}`, false);
                input.classList.add('incorrect');
            }
        };
    }

    // --- Type 3: Fill Blanks ---
    function setupFillBlanks(isShlok) {
        const btn = document.getElementById('action-btn');
        questionTypeLabel.textContent = isShlok ? "Complete the Sanskrit Shlok" : "Complete the Hindi Meaning";
        btn.textContent = "Check Answers";

        const text = isShlok ? currentVerse.shlok : currentVerse.meaning;
        const words = text.split(' ');
        let html = '<div style="line-height:2.5">';
        let blankAnswers = [];
        
        words.forEach((word, idx) => {
            // Hide word logic
            let shouldHide = (word.length > 2 && Math.random() > 0.5);
            if(shouldHide) {
                let clean = word.replace(/[|।॥,?-]/g, ''); 
                if(clean.length > 0) {
                    blankAnswers.push({ index: idx, answer: clean });
                    html += `<input type="text" class="blank-input" data-ans="${clean}" style="width:100px"> `;
                } else { html += word + " "; }
            } else { html += word + " "; }
        });
        html += '</div>';

        if(!isShlok) html += `<div class="number-text" style="margin-top:10px;">(${currentVerse.number})</div>`;

        // Retry if no blanks generated (prevent recursion on empty texts)
        if(blankAnswers.length === 0 && words.length > 1) { 
             setupFillBlanks(isShlok); 
             return; 
        }

        questionBox.innerHTML = html;

        btn.onclick = () => {
            const inputs = document.querySelectorAll('.blank-input');
            let allCorrect = true;
            inputs.forEach(inp => {
                const correct = cleanString(inp.getAttribute('data-ans'));
                const user = cleanString(inp.value);
                
                if(user === correct) {
                    inp.classList.add('correct');
                    inp.classList.remove('incorrect');
                } else {
                    inp.classList.add('incorrect');
                    inp.value = `${inp.value} (${correct})`;
                    allCorrect = false;
                }
            });
            
            if(allCorrect) {
                showFeedback("Perfect! अद्भुत!", true);
                btn.classList.add('hidden');
                nextBtn.classList.remove('hidden');
            } else {
                showFeedback("Review corrections above.", false);
            }
        };
    }

    // --- Type 4: Matching Game (FIXED) ---
    function setupMatchingGame() {
        const btn = document.getElementById('action-btn');
        questionTypeLabel.textContent = "Match Shlok to Meaning";
        btn.classList.add('hidden'); 

        // CRITICAL FIX: Use Min(3, data length) to avoid infinite loop
        let count = Math.min(3, currentTextData.length);
        
        if(count < 2) {
            questionBox.innerHTML = "Need at least 2 verses for matching game.";
            nextBtn.classList.remove('hidden');
            return;
        }

        let subset = [];
        let indices = new Set();
        // Loop securely until we have 'count' unique items
        while(indices.size < count) {
            indices.add(Math.floor(Math.random() * currentTextData.length));
        }
        indices.forEach(i => subset.push(currentTextData[i]));

        totalMatches = count;
        matchesFound = 0;
        selectedLeft = null;

        // Shuffle right side
        let leftItems = [...subset];
        let rightItems = [...subset].sort(() => Math.random() - 0.5);

        let html = `<div class="match-container">
            <div class="match-column" id="col-left"></div>
            <div class="match-column" id="col-right"></div>
        </div>`;
        questionBox.innerHTML = html;

        const leftCol = document.getElementById('col-left');
        const rightCol = document.getElementById('col-right');

        leftItems.forEach(item => {
            let div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = item.shlok.substring(0, 45) + "..."; 
            div.dataset.id = item.number;
            div.onclick = function() { selectLeft(this); };
            leftCol.appendChild(div);
        });

        rightItems.forEach(item => {
            let div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = item.meaning;
            div.dataset.id = item.number;
            div.onclick = function() { selectRight(this); };
            rightCol.appendChild(div);
        });
    }

    function selectLeft(elem) {
        if(elem.classList.contains('matched')) return;
        document.querySelectorAll('#col-left .match-item').forEach(e => e.classList.remove('selected'));
        elem.classList.add('selected');
        selectedLeft = elem;
    }

    function selectRight(elem) {
        if(!selectedLeft || elem.classList.contains('matched')) return;

        if(selectedLeft.dataset.id === elem.dataset.id) {
            // Match
            selectedLeft.classList.add('matched');
            elem.classList.add('matched');
            selectedLeft.classList.remove('selected');
            selectedLeft = null;
            matchesFound++;
            
            if(matchesFound === totalMatches) {
                showFeedback("All Matched! जय हो!", true);
                nextBtn.classList.remove('hidden');
            }
        } else {
            // No Match
            elem.classList.add('error');
            setTimeout(() => elem.classList.remove('error'), 400);
            showFeedback("Try again", false);
        }
    }

    // Helpers
    function showFeedback(msg, isSuccess) {
        feedbackMessage.textContent = msg;
        feedbackMessage.className = isSuccess ? 'success-msg' : 'error-msg';
    }

    // --- Helper: Range Checker ---
    // Handles logic like: 1.10 is greater than 1.2
    function isVerseInRange(verseNum, startStr, endStr) {
        // Helper to convert "1.5" -> 1005 (Chapter 1 * 1000 + Verse 5)
        // This allows mathematical comparison
        const parseId = (id) => {
            if (!id) return 0;
            const parts = id.toString().split('.');
            if (parts.length === 1) return parseInt(parts[0]) * 1000; // Case: "5" -> 5000
            // Case: "1.15" -> 1015, "1.5" -> 1005
            return (parseInt(parts[0]) * 1000) + parseInt(parts[1]);
        };

        const vVal = parseId(verseNum);
        const sVal = startStr ? parseId(startStr) : 0; // Default to 0 if blank
        const eVal = endStr ? parseId(endStr) : 999999; // Default to infinity if blank

        return vVal >= sVal && vVal <= eVal;
    }
    function cleanString(str) {
        return str ? str.trim().toLowerCase().replace(/\s+/g, ' ') : "";
    }
});


