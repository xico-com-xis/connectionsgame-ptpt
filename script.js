class ConnectionsGame {
    constructor() {
        this.puzzles = {}; // Now an object with difficulty levels
        this.currentPuzzleIndex = 0;
        this.currentPuzzle = null;
        this.selectedDifficulty = 'mixed'; // Default to mixed difficulty
        this.availablePuzzles = []; // Will store all available puzzles for current difficulty
        this.currentAvailableIndex = 0; // Index within available puzzles
        this.selectedWords = [];
        this.mistakesRemaining = 4;
        this.solvedGroups = [];
        this.gameEnded = false;
        this.allWords = [];
        this.isCustomPuzzle = false; // Track if playing a custom puzzle
        this.api = new PuzzleSubmissionAPI(); // Initialize API for database access

        this.checkForCustomPuzzle().then(() => {
            this.loadPuzzles().then(() => {
                this.initializeGame();
                this.setupEventListeners();
            });
        });
    }

    async checkForCustomPuzzle() {
        // Check URL parameters for custom puzzle
        const urlParams = new URLSearchParams(window.location.search);
        const customPuzzle = urlParams.get('custom');
        
        if (customPuzzle) {
            try {
                const decodedPuzzle = this.decodePuzzle(customPuzzle);
                this.currentPuzzle = decodedPuzzle;
                this.isCustomPuzzle = true;
                console.log('Loaded custom puzzle:', decodedPuzzle);
            } catch (error) {
                console.error('Error loading custom puzzle:', error);
                this.isCustomPuzzle = false;
            }
        }
    }

    decodePuzzle(encodedPuzzle) {
        const jsonString = decodeURIComponent(atob(encodedPuzzle));
        return JSON.parse(jsonString);
    }

    async loadPuzzles() {
        // Skip loading if we have a custom puzzle
        if (this.isCustomPuzzle) {
            this.puzzles = { easy: [], medium: [], hard: [], expert: [] };
            return;
        }

        try {
            console.log('Loading puzzles from database...');
            const result = await this.api.getApprovedPuzzles();
            
            if (result.success && result.puzzles) {
                this.puzzles = result.puzzles;
                console.log('Successfully loaded puzzles from database:', this.puzzles);
            } else {
                console.warn('Failed to load puzzles from database');
                // Fallback to empty puzzles object
                this.puzzles = { easy: [], medium: [], hard: [], expert: [] };
            }
        } catch (error) {
            console.error('Error loading puzzles from database:', error);
            // Fallback to empty puzzles object
            this.puzzles = { easy: [], medium: [], hard: [], expert: [] };
        }
    }

    initializeGame() {
        // Create puzzle based on selected difficulty or use custom puzzle
        if (!this.isCustomPuzzle) {
            this.currentPuzzle = this.generatePuzzleByDifficulty();
        }
        
        // Flatten all words from current puzzle
        this.allWords = this.currentPuzzle.groups.flatMap(group => 
            group.words.map(word => ({ word, group: group.category, difficulty: group.difficulty }))
        );
        
        // Shuffle words
        this.shuffleArray(this.allWords);
        
        // Update UI
        this.updatePuzzleInfo();
        this.updateNavigationButtons();
        this.renderWordGrid();
        this.renderSolvedGroups(); // Clear and render solved groups (will be empty for new game)
        this.updateMistakes();
        this.clearMessage();
    }

    generatePuzzleByDifficulty() {
        // If this is a custom puzzle, don't generate new puzzles
        if (this.isCustomPuzzle) {
            return this.currentPuzzle; // Keep the current custom puzzle
        }
        
        if (this.selectedDifficulty === 'mixed') {
            // Generate mixed difficulty puzzles from all groups
            this.generateMixedPuzzles();
        } else {
            // Generate puzzles for the selected difficulty
            this.generateDifficultyPuzzles();
        }
        
        if (this.availablePuzzles.length === 0) {
            // Fallback to a simple puzzle if no puzzles available
            this.availablePuzzles = [{
                id: 'fallback-1',
                groups: [
                    { category: "Teste", words: ["TESTE1", "TESTE2", "TESTE3", "TESTE4"], difficulty: "easy" },
                    { category: "Teste", words: ["TESTE5", "TESTE6", "TESTE7", "TESTE8"], difficulty: "medium" },
                    { category: "Teste", words: ["TESTE9", "TESTE10", "TESTE11", "TESTE12"], difficulty: "hard" },
                    { category: "Teste", words: ["TESTE13", "TESTE14", "TESTE15", "TESTE16"], difficulty: "expert" }
                ]
            }];
            this.currentAvailableIndex = 0;
        }
        
        return this.availablePuzzles[this.currentAvailableIndex];
    }

    generateMixedPuzzles() {
        // Get all groups from all difficulties
        const allGroups = [];
        Object.keys(this.puzzles).forEach(difficulty => {
            allGroups.push(...this.puzzles[difficulty]);
        });
        
        if (allGroups.length < 4) {
            this.availablePuzzles = [];
            return;
        }
        
        // Generate multiple mixed puzzles
        this.availablePuzzles = [];
        const maxPuzzles = Math.min(20, Math.floor(allGroups.length / 4));
        
        for (let i = 0; i < maxPuzzles; i++) {
            const shuffledGroups = this.shuffleArray([...allGroups]);
            
            // Try to get one group from each difficulty if possible
            const selectedGroups = [];
            const difficulties = ['easy', 'medium', 'hard', 'expert'];
            
            // First, try to get one from each difficulty
            difficulties.forEach(diff => {
                const diffGroups = shuffledGroups.filter(g => g.difficulty === diff && !selectedGroups.includes(g));
                if (diffGroups.length > 0 && selectedGroups.length < 4) {
                    selectedGroups.push(diffGroups[0]);
                }
            });
            
            // Fill remaining slots if needed
            while (selectedGroups.length < 4 && shuffledGroups.length > 0) {
                const remaining = shuffledGroups.filter(g => !selectedGroups.includes(g));
                if (remaining.length > 0) {
                    selectedGroups.push(remaining[0]);
                }
                break; // Prevent infinite loop
            }
            
            if (selectedGroups.length === 4) {
                this.availablePuzzles.push({
                    id: `mixed-${i + 1}`,
                    groups: selectedGroups
                });
            }
        }
        
        this.currentAvailableIndex = 0;
    }

    generateDifficultyPuzzles() {
        const difficultyGroups = this.puzzles[this.selectedDifficulty] || [];
        
        if (difficultyGroups.length < 4) {
            this.availablePuzzles = [];
            return;
        }
        
        // Generate multiple puzzle combinations for this difficulty
        this.availablePuzzles = [];
        const maxPuzzles = Math.min(10, Math.floor(difficultyGroups.length / 4));
        
        for (let i = 0; i < maxPuzzles; i++) {
            const shuffledGroups = this.shuffleArray([...difficultyGroups]);
            const selectedGroups = shuffledGroups.slice(0, 4);
            
            // Check if this combination already exists
            const exists = this.availablePuzzles.some(puzzle => 
                puzzle.groups.every(group => selectedGroups.some(sg => sg.category === group.category))
            );
            
            if (!exists) {
                this.availablePuzzles.push({
                    id: `${this.selectedDifficulty}-${i + 1}`,
                    groups: selectedGroups
                });
            }
        }
        
        this.currentAvailableIndex = 0;
    }

    navigatePuzzle(direction) {
        if (this.gameEnded || this.isCustomPuzzle) return; // Disable navigation for custom puzzles
        
        this.currentAvailableIndex += direction;
        
        // Wrap around if needed
        if (this.currentAvailableIndex < 0) {
            this.currentAvailableIndex = this.availablePuzzles.length - 1;
        } else if (this.currentAvailableIndex >= this.availablePuzzles.length) {
            this.currentAvailableIndex = 0;
        }
        
        // Reset game state for new puzzle
        this.selectedWords = [];
        this.mistakesRemaining = 4;
        this.solvedGroups = [];
        this.gameEnded = false;
        
        // Load new puzzle
        this.currentPuzzle = this.availablePuzzles[this.currentAvailableIndex];
        this.initializeGame();
    }

    changeDifficulty(difficulty) {
        if (this.isCustomPuzzle) return; // Disable difficulty change for custom puzzles
        
        this.selectedDifficulty = difficulty;
        this.currentAvailableIndex = 0; // Reset to first puzzle of new difficulty
        this.newGame();
    }

    setupEventListeners() {
        document.getElementById('shuffleBtn').addEventListener('click', () => this.shuffleWords());
        document.getElementById('deselectBtn').addEventListener('click', () => this.deselectAll());
        document.getElementById('submitBtn').addEventListener('click', () => this.submitGuess());
        document.getElementById('newGameBtn').addEventListener('click', () => this.newGame());
        document.getElementById('difficultySelect').addEventListener('change', (e) => this.changeDifficulty(e.target.value));
        document.getElementById('prevPuzzleBtn').addEventListener('click', () => this.navigatePuzzle(-1));
        document.getElementById('nextPuzzleBtn').addEventListener('click', () => this.navigatePuzzle(1));
        
        // Update UI elements for custom puzzles
        this.updateCustomPuzzleUI();
    }

    updateCustomPuzzleUI() {
        const difficultySelect = document.getElementById('difficultySelect');
        if (this.isCustomPuzzle) {
            difficultySelect.disabled = true;
            difficultySelect.style.opacity = '0.5';
            difficultySelect.title = 'Dificuldade não disponível para puzzles personalizados';
        } else {
            difficultySelect.disabled = false;
            difficultySelect.style.opacity = '1';
            difficultySelect.title = '';
        }
    }

    renderWordGrid() {
        const wordGrid = document.getElementById('wordGrid');
        wordGrid.innerHTML = '';

        // Only show remaining words (not yet solved)
        const remainingWords = this.allWords.filter(wordObj => 
            !this.solvedGroups.some(group => group.words.includes(wordObj.word))
        );

        remainingWords.forEach(wordObj => {
            const wordCard = document.createElement('div');
            wordCard.className = 'word-card';
            wordCard.textContent = wordObj.word;
            wordCard.dataset.word = wordObj.word;
            wordCard.dataset.group = wordObj.group;
            wordCard.dataset.difficulty = wordObj.difficulty;

            wordCard.addEventListener('click', () => this.selectWord(wordCard));
            wordGrid.appendChild(wordCard);
        });
    }

    selectWord(wordCard) {
        if (this.gameEnded || wordCard.classList.contains('disabled')) return;

        const word = wordCard.dataset.word;

        if (wordCard.classList.contains('selected')) {
            // Deselect word
            wordCard.classList.remove('selected');
            this.selectedWords = this.selectedWords.filter(w => w !== word);
        } else {
            // Select word (max 4)
            if (this.selectedWords.length < 4) {
                wordCard.classList.add('selected');
                this.selectedWords.push(word);
            }
        }

        this.updateSubmitButton();
    }

    updateSubmitButton() {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = this.selectedWords.length !== 4;
    }

    deselectAll() {
        this.selectedWords = [];
        document.querySelectorAll('.word-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        this.updateSubmitButton();
    }

    shuffleWords() {
        this.shuffleArray(this.allWords);
        this.renderWordGrid();
        this.deselectAll();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array; // Return the shuffled array
    }

    submitGuess() {
        if (this.selectedWords.length !== 4 || this.gameEnded) return;

        // Find the group these words belong to
        const correctGroup = this.currentPuzzle.groups.find(group => 
            this.selectedWords.every(word => group.words.includes(word))
        );

        if (correctGroup && this.selectedWords.length === 4) {
            // Correct guess
            this.handleCorrectGuess(correctGroup);
        } else {
            // Incorrect guess
            this.handleIncorrectGuess();
        }

        this.deselectAll();
    }

    handleCorrectGuess(group) {
        this.solvedGroups.push(group);
        this.showMessage(`Correto! Categoria: ${group.category}`, 'success');
        
        // Remove solved words from grid
        this.renderWordGrid();
        this.renderSolvedGroups();

        // Check if game is won
        if (this.solvedGroups.length === 4) {
            this.endGame(true);
        }
    }

    handleIncorrectGuess() {
        this.mistakesRemaining--;
        this.updateMistakes();

        if (this.mistakesRemaining === 0) {
            this.endGame(false);
        } else {
            this.showMessage(`Incorreto! ${this.mistakesRemaining} erro(s) restante(s)`, 'error');
        }
    }

    renderSolvedGroups() {
        const container = document.getElementById('solvedGroups');
        container.innerHTML = '';

        this.solvedGroups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = `solved-group difficulty-${group.difficulty}`;
            
            groupDiv.innerHTML = `
                <div class="group-category">${group.category}</div>
                <div class="group-words">${group.words.join(', ')}</div>
            `;
            
            container.appendChild(groupDiv);
        });
    }

    updateMistakes() {
        const dots = document.querySelectorAll('.mistake-dots .dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index < this.mistakesRemaining);
        });
    }

    updatePuzzleInfo() {
        const difficultyNames = {
            'mixed': 'Misto',
            'easy': 'Fácil',
            'medium': 'Médio',
            'hard': 'Difícil',
            'expert': 'Muito Difícil'
        };
        
        let displayText;
        if (this.isCustomPuzzle) {
            displayText = 'Puzzle Personalizado';
        } else {
            const difficultyText = this.selectedDifficulty !== 'mixed' 
                ? ` - ${difficultyNames[this.selectedDifficulty]}`
                : '';
            displayText = `Conexões${difficultyText}`;
        }
            
        document.querySelector('.puzzle-number').textContent = displayText;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevPuzzleBtn');
        const nextBtn = document.getElementById('nextPuzzleBtn');
        
        if (this.isCustomPuzzle) {
            // Disable navigation for custom puzzles
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            prevBtn.style.opacity = '0.3';
            nextBtn.style.opacity = '0.3';
            return;
        }
        
        // Enable/disable buttons based on available puzzles
        const hasMultiplePuzzles = this.availablePuzzles.length > 1;
        prevBtn.disabled = !hasMultiplePuzzles;
        nextBtn.disabled = !hasMultiplePuzzles;
        
        // Show/hide arrows for single puzzle mode
        prevBtn.style.opacity = hasMultiplePuzzles ? '1' : '0.3';
        nextBtn.style.opacity = hasMultiplePuzzles ? '1' : '0.3';
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('gameMessage');
        messageEl.textContent = text;
        messageEl.className = `game-message ${type} show`;
        
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 3000);
    }

    clearMessage() {
        const messageEl = document.getElementById('gameMessage');
        messageEl.classList.remove('show');
    }

    endGame(won) {
        this.gameEnded = true;
        
        // Disable all word cards
        document.querySelectorAll('.word-card').forEach(card => {
            card.classList.add('disabled');
        });

        // Don't show remaining groups immediately if lost - wait for user to click reveal button
        if (!won) {
            this.showMessage('Não conseguiste resolver o puzzle! Clica em "Ver Solução" para revelar as respostas.', 'error');
        }

        // Show modal
        setTimeout(() => {
            this.showGameOverModal(won);
        }, 1000);
    }

    showGameOverModal(won) {
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const finalGroups = document.getElementById('finalGroups');

        if (won) {
            title.textContent = 'Parabéns! Completaste o puzzle!';
            // Show all groups in final results for won games
            finalGroups.innerHTML = '';
            this.currentPuzzle.groups.forEach(group => {
                const groupDiv = document.createElement('div');
                groupDiv.className = `solved-group difficulty-${group.difficulty}`;
                groupDiv.innerHTML = `
                    <div class="group-category">${group.category}</div>
                    <div class="group-words">${group.words.join(', ')}</div>
                `;
                finalGroups.appendChild(groupDiv);
            });
        } else {
            title.textContent = 'Não conseguiste resolver!';
            // For lost games, show only solved groups initially and add a reveal button
            finalGroups.innerHTML = '';
            
            // Show only solved groups
            this.solvedGroups.forEach(group => {
                const groupDiv = document.createElement('div');
                groupDiv.className = `solved-group difficulty-${group.difficulty}`;
                groupDiv.innerHTML = `
                    <div class="group-category">${group.category}</div>
                    <div class="group-words">${group.words.join(', ')}</div>
                `;
                finalGroups.appendChild(groupDiv);
            });
            
            // Add reveal solution button if there are unsolved groups
            const unsolvedGroups = this.currentPuzzle.groups.filter(group => 
                !this.solvedGroups.includes(group)
            );
            
            if (unsolvedGroups.length > 0) {
                const revealBtn = document.createElement('button');
                revealBtn.className = 'btn btn-secondary reveal-btn';
                revealBtn.textContent = 'Ver Solução';
                revealBtn.style.marginBottom = '20px';
                revealBtn.addEventListener('click', () => this.revealSolution());
                finalGroups.appendChild(revealBtn);
            }
        }

        modal.classList.add('show');
    }

    revealSolution() {
        const finalGroups = document.getElementById('finalGroups');
        
        // Remove the reveal button
        const revealBtn = finalGroups.querySelector('.reveal-btn');
        if (revealBtn) {
            revealBtn.remove();
        }
        
        // Show all remaining unsolved groups
        const unsolvedGroups = this.currentPuzzle.groups.filter(group => 
            !this.solvedGroups.includes(group)
        );
        
        unsolvedGroups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = `solved-group difficulty-${group.difficulty}`;
            groupDiv.innerHTML = `
                <div class="group-category">${group.category}</div>
                <div class="group-words">${group.words.join(', ')}</div>
            `;
            finalGroups.appendChild(groupDiv);
        });
        
        // Also render these groups in the main game area
        unsolvedGroups.forEach(group => {
            if (!this.solvedGroups.includes(group)) {
                this.solvedGroups.push(group);
            }
        });
        this.renderSolvedGroups();
    }

    newGame() {
        // For custom puzzles, just reset the current puzzle instead of generating a new one
        if (this.isCustomPuzzle) {
            // Reset game state
            this.selectedWords = [];
            this.mistakesRemaining = 4;
            this.solvedGroups = [];
            this.gameEnded = false;
            
            // Hide modal
            document.getElementById('gameOverModal').classList.remove('show');
            
            // Reinitialize with the same custom puzzle
            this.initializeGame();
            return;
        }
        
        // Reset game state
        this.selectedWords = [];
        this.mistakesRemaining = 4;
        this.solvedGroups = [];
        this.gameEnded = false;
        
        // Hide modal
        document.getElementById('gameOverModal').classList.remove('show');
        
        // Generate new puzzle and reinitialize game
        this.currentPuzzle = this.generatePuzzleByDifficulty();
        this.initializeGame();
    }

}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ConnectionsGame();
});
