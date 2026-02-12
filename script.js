document.addEventListener('DOMContentLoaded', () => {
    let availableTexts = [];
    let currentTextData = [];
    let currentVerse = null;
    let allowedTypes = [];
    let blankAnswers = [];
    
    // For Matching Game
    let selectedLeft = null;
    let matchesFound = 0;
    let totalMatches = 0;

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
    const actionBtn = document.getElementById('action-btn');
    const nextBtn = document.getElementById('next-btn');
    const card = document.querySelector('.card');

    // 1. Initialize
    fetch('data/index.json')
        .then(res => res.json())
        .then(data => {
            availableTexts = data;
            textSelect.innerHTML = '<option value="">-- Select a Text --</option>';
            data.forEach(t => {
                let opt = document.createElement('option');
                opt.value = t.filename;
                opt.textContent = t.name;
                textSelect.appendChild(opt);
            });
        })
        .catch(err => {
            textSelect.innerHTML = '<option>Error loading texts</option>';
            console.error(err);
        });

    textSelect.addEventListener('change', () => {
        startBtn.disabled = textSelect.value === "";
    });

    // 2. Start Quiz
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

        try {
            startBtn.textContent = "Loading...";
            const res = await fetch(`data/${filename}`);
            if(!res.ok) throw new Error("File not found");
            
            currentTextData = await res.json();
            currentTextTitle.textContent = selectedTextObj.name;
            
            selectionScreen.classList.remove('active');
            quizScreen.classList.add('active');
            nextQuestion();
        } catch (err) {
            alert("Error loading text data. Ensure JSON files are correct.");
            console.error(err);
        } finally {
            startBtn.textContent = "Start Learning";
        }
    });

    // 3. Back Button - FIX: Force Reload
    backBtn.addEventListener('click', () => {
        // This forces the browser to refresh, clearing all memory and glitches
        window.location.reload(); 
    });

    nextBtn.addEventListener('click', nextQuestion);

    // 4. Question Router
    function nextQuestion() {
        resetState();
        // Trigger animation
        card.classList.remove('animate-fade');
        void card.offsetWidth; // Trigger reflow
        card.classList.add('animate-fade');

        if(!currentTextData.length) return;

        // Random Verse for single-verse questions
        const randomIndex = Math.floor(Math.random() * currentTextData.length);
        currentVerse = currentTextData[randomIndex];

        // Random Type
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
        actionBtn.classList.remove('hidden');
        questionBox.innerHTML = ''; // Clear previous content
        
        // Clone button to remove old listeners
        const newBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newBtn, actionBtn);
        // Re-assign global
        window.actionBtnGlobal = newBtn;
    }

    // --- Type 1: Flashcards ---
    function setupFlashcard() {
        const btn = window.actionBtnGlobal;
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
        const btn = window.actionBtnGlobal;
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

    // --- Type 3: Fill Blanks (Split into Shlok or Meaning) ---
    function setupFillBlanks(isShlok) {
        const btn = window.actionBtnGlobal;
        questionTypeLabel.textContent = isShlok ? "Complete the Sanskrit Shlok" : "Complete the Hindi Meaning";
        btn.textContent = "Check Answers";

        const text = isShlok ? currentVerse.shlok : currentVerse.meaning;
        const words = text.split(' ');
        let html = '<div style="line-height:2.5">';
        blankAnswers = [];
        
        words.forEach((word, idx) => {
            // Logic: Hide word if long enough OR random chance
            let shouldHide = (word.length > 2 && Math.random() > 0.5);
            
            if(shouldHide) {
                let clean = word.replace(/[|।॥,?-]/g, ''); 
                if(clean.length > 0) {
                    blankAnswers.push({ index: idx, answer: clean });
                    html += `<input type="text" class="blank-input" data-ans="${clean}" style="width:80px"> `;
                } else {
                    html += word + " ";
                }
            } else {
                html += word + " ";
            }
        });
        html += '</div>';

        // Add Number hint
        if(!isShlok) html += `<div class="number-text" style="margin-top:10px;">(${currentVerse.number})</div>`;

        if(blankAnswers.length === 0) { setupFillBlanks(isShlok); return; } // Retry if no blanks

        questionBox.innerHTML = html;

        btn.onclick = () => {
            const inputs = document.querySelectorAll('.blank-input');
            let allCorrect = true;
            inputs.forEach(inp => {
                const correct = cleanString(inp.getAttribute('data-ans'));
                const user = cleanString(inp.value);
                
                // Partial match allow
                if(user === correct) {
                    inp.classList.add('correct');
                    inp.classList.remove('incorrect');
                } else {
                    inp.classList.add('incorrect');
                    // Show correct answer in brackets
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

    // --- Type 4: Matching Game (New!) ---
    function setupMatchingGame() {
        const btn = window.actionBtnGlobal;
        questionTypeLabel.textContent = "Match Shlok to Meaning";
        btn.classList.add('hidden'); // No button needed, interactive game

        // 1. Get 3 random unique verses
        if(currentTextData.length < 3) {
            questionBox.innerHTML = "Not enough verses for matching game.";
            nextBtn.classList.remove('hidden');
            return;
        }

        let subset = [];
        let indices = new Set();
        while(indices.size < 3) {
            indices.add(Math.floor(Math.random() * currentTextData.length));
        }
        indices.forEach(i => subset.push(currentTextData[i]));

        totalMatches = 3;
        matchesFound = 0;
        selectedLeft = null;

        // 2. Prepare Columns
        // Left side: Shloks (Random order? No, keep index order)
        // Right side: Meanings (Shuffled)
        let leftItems = [...subset];
        let rightItems = [...subset].sort(() => Math.random() - 0.5);

        let html = `<div class="match-container">
            <div class="match-column" id="col-left"></div>
            <div class="match-column" id="col-right"></div>
        </div>`;
        questionBox.innerHTML = html;

        const leftCol = document.getElementById('col-left');
        const rightCol = document.getElementById('col-right');

        // Render Left (Shloks)
        leftItems.forEach(item => {
            let div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = item.shlok.substring(0, 50) + "..."; // Truncate
            div.dataset.id = item.number; // Use verse number as ID
            div.onclick = () => selectLeft(div);
            leftCol.appendChild(div);
        });

        // Render Right (Meanings)
        rightItems.forEach(item => {
            let div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = item.meaning;
            div.dataset.id = item.number;
            div.onclick = () => selectRight(div);
            rightCol.appendChild(div);
        });
    }

    function selectLeft(elem) {
        if(elem.classList.contains('matched')) return;
        
        // Deselect previous left
        document.querySelectorAll('#col-left .match-item').forEach(e => e.classList.remove('selected'));
        
        elem.classList.add('selected');
        selectedLeft = elem;
    }

    function selectRight(elem) {
        if(!selectedLeft || elem.classList.contains('matched')) return;

        // Check Match
        if(selectedLeft.dataset.id === elem.dataset.id) {
            // Match!
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

    // --- Helpers ---
    function showFeedback(msg, isSuccess) {
        feedbackMessage.textContent = msg;
        feedbackMessage.className = isSuccess ? 'success-msg' : 'error-msg';
    }

    function cleanString(str) {
        return str ? str.trim().toLowerCase().replace(/\s+/g, ' ') : "";
    }
});
