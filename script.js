document.addEventListener('DOMContentLoaded', () => {
    let availableTexts = [];
    let currentTextData = [];
    let currentVerse = null;
    let allowedTypes = [];
    let blankAnswers = [];

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

    // Load list of books
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
        .catch(err => console.error("Error loading index:", err));

    textSelect.addEventListener('change', () => {
        startBtn.disabled = textSelect.value === "";
    });

    startBtn.addEventListener('click', async () => {
        const filename = textSelect.value;
        const selectedTextObj = availableTexts.find(t => t.filename === filename);
        
        // Get Checkboxes
        const checkboxes = document.querySelectorAll('input[name="qtype"]:checked');
        allowedTypes = Array.from(checkboxes).map(cb => cb.value);

        if (allowedTypes.length === 0) {
            alert("Select at least one question type.");
            return;
        }

        try {
            startBtn.textContent = "Loading...";
            const res = await fetch(`data/${filename}`);
            currentTextData = await res.json();
            currentTextTitle.textContent = selectedTextObj.name;
            
            selectionScreen.classList.remove('active');
            quizScreen.classList.add('active');
            nextQuestion();
        } catch (err) {
            alert("Error loading text data.");
        } finally {
            startBtn.textContent = "Start Learning";
        }
    });

    backBtn.addEventListener('click', () => {
        quizScreen.classList.remove('active');
        selectionScreen.classList.add('active');
    });

    nextBtn.addEventListener('click', nextQuestion);

    function nextQuestion() {
        resetState();
        if(!currentTextData.length) return;

        // Random Verse
        const randomIndex = Math.floor(Math.random() * currentTextData.length);
        currentVerse = currentTextData[randomIndex];

        // Random Type from Allowed List
        const typeIndex = Math.floor(Math.random() * allowedTypes.length);
        const type = allowedTypes[typeIndex];

        if (type === 'flashcard') setupFlashcard();
        else if (type === 'guessNumber') setupGuessNumber();
        else if (type === 'fillBlanks') setupFillBlanks();
    }

    function resetState() {
        feedbackMessage.textContent = '';
        answerBox.classList.add('hidden');
        answerBox.innerHTML = '';
        nextBtn.classList.add('hidden');
        actionBtn.classList.remove('hidden');
        actionBtn.disabled = false;
        // Remove old event listeners by cloning
        const newBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newBtn, actionBtn);
        // We will bind new listeners in setup functions
    }

    // --- Type 1: Flashcards ---
    function setupFlashcard() {
        const btn = document.getElementById('action-btn');
        const isShlokToMeaning = Math.random() > 0.5;
        
        questionTypeLabel.textContent = isShlokToMeaning ? "Flashcard: Recall Meaning" : "Flashcard: Recall Shlok";
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
            const userVal = input.value.trim();
            if(userVal === currentVerse.number) {
                showFeedback("Correct!", true);
                input.classList.add('correct');
            } else {
                showFeedback(`Incorrect. It is ${currentVerse.number}`, false);
                input.classList.add('incorrect');
            }
            btn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
        };
    }

    // --- Type 3: Fill Blanks ---
    function setupFillBlanks() {
        const btn = document.getElementById('action-btn');
        const isShlok = Math.random() > 0.5;
        questionTypeLabel.textContent = isShlok ? "Fill in the Shlok" : "Fill in the Meaning";
        btn.textContent = "Check";

        const text = isShlok ? currentVerse.shlok : currentVerse.meaning;
        const words = text.split(' ');
        let html = '<div style="line-height:2.5">';
        blankAnswers = [];
        
        words.forEach((word, idx) => {
            // Hide word if length > 2 and random chance, or force hide if it's a short sentence
            if(word.length > 1 && Math.random() > 0.6) {
                let clean = word.replace(/[|।॥,?-]/g, ''); // Remove punctuation for answer
                blankAnswers.push({ index: idx, answer: clean });
                html += `<input type="text" class="blank-input" data-ans="${clean}" style="width:80px"> `;
            } else {
                html += word + " ";
            }
        });
        html += '</div>';

        // Retry if no blanks were made
        if(blankAnswers.length === 0) { setupFillBlanks(); return; }

        questionBox.innerHTML = html;

        btn.onclick = () => {
            const inputs = document.querySelectorAll('.blank-input');
            let allCorrect = true;
            inputs.forEach(inp => {
                const correct = inp.getAttribute('data-ans').toLowerCase();
                const user = inp.value.trim().toLowerCase();
                if(user === correct) {
                    inp.classList.add('correct');
                    inp.classList.remove('incorrect');
                } else {
                    inp.classList.add('incorrect');
                    inp.value = `${inp.value} (${correct})`;
                    allCorrect = false;
                }
            });
            showFeedback(allCorrect ? "Perfect!" : "Review corrections.", allCorrect);
            btn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
        };
    }

    function showFeedback(msg, isSuccess) {
        feedbackMessage.textContent = msg;
        feedbackMessage.className = isSuccess ? 'success-msg' : 'error-msg';
    }
});