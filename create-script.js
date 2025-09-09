class PuzzleCreator {
    constructor() {
        this.groups = [
            { category: '', words: ['', '', '', ''], difficulty: 'medium' },
            { category: '', words: ['', '', '', ''], difficulty: 'medium' },
            { category: '', words: ['', '', '', ''], difficulty: 'medium' },
            { category: '', words: ['', '', '', ''], difficulty: 'medium' }
        ];
        
        this.setupEventListeners();
        this.updatePreview();
    }

    setupEventListeners() {
        // Category inputs
        document.querySelectorAll('.category-input').forEach((input, index) => {
            input.addEventListener('input', (e) => {
                this.groups[index].category = e.target.value;
                this.updatePreview();
                this.validatePuzzle();
            });
        });

        // Word inputs
        document.querySelectorAll('.word-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const groupIndex = parseInt(e.target.closest('.group-creator').dataset.group);
                const wordIndex = parseInt(e.target.dataset.word);
                this.groups[groupIndex].words[wordIndex] = e.target.value.toUpperCase();
                e.target.value = e.target.value.toUpperCase();
                this.updatePreview();
                this.validatePuzzle();
                this.checkDuplicates();
            });
        });

        // Difficulty selects
        document.querySelectorAll('.difficulty-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const groupIndex = parseInt(e.target.dataset.group);
                this.groups[groupIndex].difficulty = e.target.value;
                this.updatePreview();
                this.validatePuzzle();
            });
        });

        // Action buttons
        document.getElementById('validateBtn').addEventListener('click', () => this.validatePuzzle(true));
        document.getElementById('testBtn').addEventListener('click', () => this.testPuzzle());
        document.getElementById('shareBtn').addEventListener('click', () => this.sharePuzzle());
        document.getElementById('submitBtn').addEventListener('click', () => this.showSubmissionModal());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());

        // Modal close buttons
        document.getElementById('closeTestModal').addEventListener('click', () => this.closeModal('testModal'));
        document.getElementById('closeShareModal').addEventListener('click', () => this.closeModal('shareModal'));
        document.getElementById('closeSubmitModal').addEventListener('click', () => this.closeModal('submitModal'));
        document.getElementById('copyLinkBtn').addEventListener('click', () => this.copyShareLink());

        // Submission modal buttons
        document.getElementById('cancelSubmit').addEventListener('click', () => this.closeModal('submitModal'));
        document.getElementById('confirmSubmit').addEventListener('click', () => this.submitPuzzle());
        document.getElementById('copyLinkBtn').addEventListener('click', () => this.copyShareLink());

        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    updatePreview() {
        const previewGrid = document.getElementById('previewGrid');
        previewGrid.innerHTML = '';

        // Collect all words and shuffle them
        const allWords = [];
        this.groups.forEach(group => {
            group.words.forEach(word => {
                if (word.trim()) {
                    allWords.push({
                        word: word.trim(),
                        difficulty: group.difficulty
                    });
                }
            });
        });

        // Shuffle the words for preview
        this.shuffleArray(allWords);

        // Create preview cards
        allWords.forEach(wordObj => {
            const wordDiv = document.createElement('div');
            wordDiv.className = `preview-word difficulty-${wordObj.difficulty}`;
            wordDiv.textContent = wordObj.word;
            previewGrid.appendChild(wordDiv);
        });

        // Fill empty slots
        const emptySlots = 16 - allWords.length;
        for (let i = 0; i < emptySlots; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'preview-word';
            emptyDiv.textContent = '?';
            emptyDiv.style.opacity = '0.3';
            previewGrid.appendChild(emptyDiv);
        }
    }

    checkDuplicates() {
        // Get all words
        const allWords = [];
        this.groups.forEach((group, groupIndex) => {
            group.words.forEach((word, wordIndex) => {
                if (word.trim()) {
                    allWords.push({
                        word: word.trim(),
                        groupIndex,
                        wordIndex,
                        element: document.querySelector(`.group-creator[data-group="${groupIndex}"] .word-input[data-word="${wordIndex}"]`)
                    });
                }
            });
        });

        // Clear previous duplicate markers
        document.querySelectorAll('.word-input').forEach(input => {
            input.classList.remove('duplicate');
        });

        // Find and mark duplicates
        const wordCounts = {};
        allWords.forEach(wordObj => {
            const word = wordObj.word.toLowerCase();
            if (!wordCounts[word]) {
                wordCounts[word] = [];
            }
            wordCounts[word].push(wordObj);
        });

        Object.values(wordCounts).forEach(duplicates => {
            if (duplicates.length > 1) {
                duplicates.forEach(wordObj => {
                    wordObj.element.classList.add('duplicate');
                });
            }
        });
    }

    validatePuzzle(showMessage = false) {
        const validation = this.getPuzzleValidation();
        const messageEl = document.getElementById('validationMessage');
        const testBtn = document.getElementById('testBtn');
        const shareBtn = document.getElementById('shareBtn');
        const submitBtn = document.getElementById('submitBtn');

        // Update group creators visual state
        document.querySelectorAll('.group-creator').forEach((creator, index) => {
            creator.classList.remove('valid', 'invalid');
            if (validation.groupsValid[index]) {
                creator.classList.add('valid');
            } else if (this.hasAnyContent(this.groups[index])) {
                creator.classList.add('invalid');
            }
        });

        // Update validation message
        if (showMessage || validation.isValid || validation.errors.length > 0) {
            messageEl.className = 'validation-message';
            if (validation.isValid) {
                messageEl.className += ' success';
                messageEl.textContent = '✅ Puzzle válido! Podes testá-lo, partilhá-lo ou submetê-lo.';
                testBtn.disabled = false;
                shareBtn.disabled = false;
                submitBtn.disabled = false;
            } else {
                messageEl.className += ' error';
                messageEl.textContent = '❌ ' + validation.errors.join(' ');
                testBtn.disabled = true;
                shareBtn.disabled = true;
                submitBtn.disabled = true;
            }
        } else {
            messageEl.textContent = '';
            messageEl.className = 'validation-message';
            testBtn.disabled = true;
            shareBtn.disabled = true;
            submitBtn.disabled = true;
        }

        return validation.isValid;
    }

    getPuzzleValidation() {
        const errors = [];
        const groupsValid = [];

        // Check each group
        this.groups.forEach((group, index) => {
            let groupValid = true;
            
            // Check category
            if (!group.category.trim()) {
                groupValid = false;
                if (this.hasAnyContent(group)) {
                    errors.push(`Grupo ${index + 1} precisa de uma categoria.`);
                }
            }

            // Check words
            const filledWords = group.words.filter(word => word.trim());
            if (filledWords.length > 0 && filledWords.length < 4) {
                groupValid = false;
                errors.push(`Grupo ${index + 1} precisa de 4 palavras.`);
            }

            // Check for empty words in between
            const hasEmptyBetween = group.words.some((word, i) => {
                return !word.trim() && group.words.slice(i + 1).some(w => w.trim());
            });
            if (hasEmptyBetween) {
                groupValid = false;
                errors.push(`Grupo ${index + 1} tem palavras em falta.`);
            }

            groupsValid.push(groupValid && filledWords.length === 4);
        });

        // Check if all groups are complete
        const completeGroups = groupsValid.filter(Boolean).length;
        if (completeGroups < 4) {
            if (completeGroups > 0) {
                errors.push(`Precisas de completar todos os 4 grupos. (${completeGroups}/4 completos)`);
            }
        }

        // Check for duplicate words across all groups
        const allWords = [];
        this.groups.forEach(group => {
            group.words.forEach(word => {
                if (word.trim()) {
                    allWords.push(word.trim().toLowerCase());
                }
            });
        });

        const duplicates = allWords.filter((word, index) => allWords.indexOf(word) !== index);
        if (duplicates.length > 0) {
            errors.push('Todas as palavras devem ser únicas.');
        }

        return {
            isValid: errors.length === 0 && completeGroups === 4,
            errors,
            groupsValid,
            completeGroups
        };
    }

    hasAnyContent(group) {
        return group.category.trim() || group.words.some(word => word.trim());
    }

    testPuzzle() {
        if (!this.validatePuzzle()) return;

        const testGameContainer = document.getElementById('testGame');
        testGameContainer.innerHTML = `
            <div class="test-game-header">
                <h3>Teste do Teu Puzzle</h3>
                <p>Experimenta resolver o puzzle que criaste!</p>
            </div>
            <div id="testGameArea"></div>
        `;

        // Create a test game instance
        this.createTestGame();
        this.showModal('testModal');
    }

    createTestGame() {
        // Create a simplified version of the connections game for testing
        const testContainer = document.getElementById('testGameArea');
        
        // Get all words and shuffle them
        const allWords = [];
        this.groups.forEach(group => {
            group.words.forEach(word => {
                if (word.trim()) {
                    allWords.push({
                        word: word.trim(),
                        group: group.category,
                        difficulty: group.difficulty
                    });
                }
            });
        });

        this.shuffleArray(allWords);

        // Create game grid
        testContainer.innerHTML = `
            <div class="test-game-info">
                <div class="test-mistakes">
                    <span>Erros restantes: </span>
                    <span id="testMistakeCount">4</span>
                </div>
                <div class="test-solved-count">
                    <span>Grupos resolvidos: </span>
                    <span id="testSolvedCount">0</span>/4
                </div>
            </div>
            <div class="test-word-grid" id="testWordGrid">
                ${allWords.map(wordObj => `
                    <div class="test-word-card" data-group="${wordObj.group}" data-difficulty="${wordObj.difficulty}" data-word="${wordObj.word}">
                        ${wordObj.word}
                    </div>
                `).join('')}
            </div>
            <div class="test-controls">
                <button id="testShuffleBtn" class="btn btn-secondary">Baralhar</button>
                <button id="testSubmitBtn" class="btn btn-primary" disabled>Submeter</button>
                <button id="testRevealBtn" class="btn btn-success">Revelar Solução</button>
            </div>
            <div id="testMessage" class="test-message"></div>
            <div id="testSolvedGroups" class="test-solved-groups"></div>
            <div id="testSolution" class="test-solution" style="display: none;">
                ${this.groups.map(group => `
                    <div class="test-group difficulty-${group.difficulty}">
                        <strong>${group.category}:</strong> ${group.words.join(', ')}
                    </div>
                `).join('')}
            </div>
        `;

        // Initialize test game state
        this.testGameState = {
            selectedWords: [],
            mistakesRemaining: 4,
            solvedGroups: [],
            gameEnded: false
        };

        // Add test game event listeners
        this.setupTestGameListeners();
    }

    setupTestGameListeners() {
        // Word selection
        document.querySelectorAll('.test-word-card').forEach(card => {
            card.addEventListener('click', () => this.selectTestWord(card));
        });

        // Shuffle button
        document.getElementById('testShuffleBtn').addEventListener('click', () => {
            const wordCards = Array.from(document.querySelectorAll('.test-word-card'));
            this.shuffleArray(wordCards);
            const grid = document.getElementById('testWordGrid');
            grid.innerHTML = '';
            wordCards.forEach(card => grid.appendChild(card));
            this.setupTestGameListeners(); // Re-attach listeners
        });

        // Submit button
        document.getElementById('testSubmitBtn').addEventListener('click', () => this.submitTestGuess());

        // Reveal solution button
        document.getElementById('testRevealBtn').addEventListener('click', () => {
            document.getElementById('testSolution').style.display = 'block';
        });
    }

    selectTestWord(wordCard) {
        if (this.testGameState.gameEnded) return;

        const word = wordCard.dataset.word;

        if (wordCard.classList.contains('selected')) {
            // Deselect word
            wordCard.classList.remove('selected');
            this.testGameState.selectedWords = this.testGameState.selectedWords.filter(w => w !== word);
        } else {
            // Select word (max 4)
            if (this.testGameState.selectedWords.length < 4) {
                wordCard.classList.add('selected');
                this.testGameState.selectedWords.push(word);
            }
        }

        // Update submit button
        const submitBtn = document.getElementById('testSubmitBtn');
        submitBtn.disabled = this.testGameState.selectedWords.length !== 4;
    }

    submitTestGuess() {
        if (this.testGameState.selectedWords.length !== 4 || this.testGameState.gameEnded) return;

        // Find the group these words belong to
        const correctGroup = this.groups.find(group => 
            this.testGameState.selectedWords.every(word => group.words.includes(word)) &&
            this.testGameState.selectedWords.length === 4
        );

        if (correctGroup) {
            // Correct guess
            this.handleTestCorrectGuess(correctGroup);
        } else {
            // Incorrect guess
            this.handleTestIncorrectGuess();
        }

        // Clear selection
        this.testGameState.selectedWords = [];
        document.querySelectorAll('.test-word-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('testSubmitBtn').disabled = true;
    }

    handleTestCorrectGuess(group) {
        this.testGameState.solvedGroups.push(group);
        
        // Remove solved words from grid
        group.words.forEach(word => {
            const card = document.querySelector(`.test-word-card[data-word="${word}"]`);
            if (card) card.remove();
        });

        // Add to solved groups display
        const solvedContainer = document.getElementById('testSolvedGroups');
        const groupDiv = document.createElement('div');
        groupDiv.className = `test-solved-group difficulty-${group.difficulty}`;
        groupDiv.innerHTML = `
            <div class="test-group-category">${group.category}</div>
            <div class="test-group-words">${group.words.join(', ')}</div>
        `;
        solvedContainer.appendChild(groupDiv);

        // Update counters
        document.getElementById('testSolvedCount').textContent = this.testGameState.solvedGroups.length;

        // Show success message
        this.showTestMessage(`✅ Correto! Categoria: ${group.category}`, 'success');

        // Check if game is won
        if (this.testGameState.solvedGroups.length === 4) {
            this.endTestGame(true);
        }
    }

    handleTestIncorrectGuess() {
        this.testGameState.mistakesRemaining--;
        document.getElementById('testMistakeCount').textContent = this.testGameState.mistakesRemaining;

        if (this.testGameState.mistakesRemaining === 0) {
            this.endTestGame(false);
        } else {
            this.showTestMessage(`❌ Incorreto! ${this.testGameState.mistakesRemaining} erro(s) restante(s)`, 'error');
        }
    }

    showTestMessage(text, type) {
        const messageEl = document.getElementById('testMessage');
        messageEl.textContent = text;
        messageEl.className = `test-message ${type}`;
        
        setTimeout(() => {
            messageEl.textContent = '';
            messageEl.className = 'test-message';
        }, 3000);
    }

    endTestGame(won) {
        this.testGameState.gameEnded = true;
        
        const message = won ? '🎉 Parabéns! Completaste o teu puzzle!' : '😔 Fim do jogo! Não conseguiste resolver.';
        this.showTestMessage(message, won ? 'success' : 'error');
        
        // Show all remaining groups if lost
        if (!won) {
            document.getElementById('testSolution').style.display = 'block';
        }
        
        // Disable all interactions
        document.querySelectorAll('.test-word-card').forEach(card => {
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.6';
        });
        
        document.getElementById('testSubmitBtn').disabled = true;
    }

    sharePuzzle() {
        if (!this.validatePuzzle()) return;

        // Create the puzzle data
        const puzzleData = {
            id: 'custom-' + Date.now(),
            groups: this.groups.filter(group => 
                group.category.trim() && group.words.every(word => word.trim())
            )
        };

        // Encode the puzzle data
        const encodedPuzzle = this.encodePuzzle(puzzleData);
        
        // Create the share link
        const baseUrl = window.location.origin + window.location.pathname.replace('create.html', 'index.html');
        const shareLink = `${baseUrl}?custom=${encodedPuzzle}`;
        
        document.getElementById('shareLink').value = shareLink;
        this.showModal('shareModal');
    }

    encodePuzzle(puzzleData) {
        // Simple base64 encoding of JSON data
        const jsonString = JSON.stringify(puzzleData);
        return btoa(encodeURIComponent(jsonString));
    }

    copyShareLink() {
        const shareLink = document.getElementById('shareLink');
        shareLink.select();
        shareLink.setSelectionRange(0, 99999); // For mobile devices

        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById('copyLinkBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copiado!';
            copyBtn.style.background = '#28a745';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        } catch (err) {
            console.error('Erro ao copiar:', err);
        }
    }

    clearAll() {
        if (confirm('Tens a certeza que queres limpar tudo? Esta ação não pode ser desfeita.')) {
            // Reset groups
            this.groups = [
                { category: '', words: ['', '', '', ''], difficulty: 'medium' },
                { category: '', words: ['', '', '', ''], difficulty: 'medium' },
                { category: '', words: ['', '', '', ''], difficulty: 'medium' },
                { category: '', words: ['', '', '', ''], difficulty: 'medium' }
            ];

            // Clear all inputs
            document.querySelectorAll('.category-input').forEach(input => input.value = '');
            document.querySelectorAll('.word-input').forEach(input => input.value = '');
            
            // Reset difficulty selects to medium
            document.querySelectorAll('.difficulty-select').forEach(select => {
                select.value = 'medium';
            });

            // Update UI
            this.updatePreview();
            this.validatePuzzle();
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
        document.body.style.overflow = '';
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    showSubmissionModal() {
        if (!this.validatePuzzle()) {
            alert('Por favor, corrige todos os problemas antes de submeter o puzzle.');
            return;
        }
        this.showModal('submitModal');
    }

    async submitPuzzle() {
        try {
            // Collect form data
            const creatorName = document.getElementById('creatorName').value.trim();
            const creatorEmail = document.getElementById('creatorEmail').value.trim();
            const puzzleTitle = document.getElementById('puzzleTitle').value.trim();
            const puzzleDescription = document.getElementById('puzzleDescription').value.trim();

            // Prepare puzzle data
            const puzzleData = {
                id: `custom-${Date.now()}`,
                groups: this.groups.filter(group => 
                    group.category.trim() && 
                    group.words.every(word => word.trim())
                )
            };

            // Prepare submission info
            const submitterInfo = {
                email: creatorEmail || 'Anónimo',
                title: puzzleTitle || null,
                description: puzzleDescription || null
            };

            // Submit to API
            const api = new PuzzleSubmissionAPI();
            const result = await api.submitPuzzle(puzzleData, submitterInfo);

            if (result.success) {
                alert('Puzzle submetido com sucesso! Será analisado em breve.');
                this.closeModal('submitModal');
                
                // Clear form
                document.getElementById('creatorName').value = '';
                document.getElementById('creatorEmail').value = '';
                document.getElementById('puzzleTitle').value = '';
                document.getElementById('puzzleDescription').value = '';
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Erro ao submeter puzzle. Por favor, tenta novamente.\n\nErro: ' + error.message);
        }
    }
}

// Add styles for test game
const testGameStyles = `
<style>
.test-game-header {
    text-align: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #dee2e6;
}

.test-game-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 8px;
    font-weight: 500;
}

.test-word-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}

.test-word-card {
    background: #f8f9fa;
    border: 2px solid #dee2e6;
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    user-select: none;
}

.test-word-card:hover {
    background: #e9ecef;
    transform: translateY(-2px);
}

.test-word-card.selected {
    background: #5d4e75;
    color: white;
    border-color: #5d4e75;
}

.test-controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1.5rem;
}

.test-message {
    text-align: center;
    padding: 0.75rem;
    border-radius: 6px;
    font-weight: 500;
    margin-bottom: 1rem;
    min-height: 1.5rem;
}

.test-message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.test-message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

.test-solved-groups {
    margin-bottom: 1rem;
}

.test-solved-group {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.5rem;
}

.test-solved-group.difficulty-easy { background: #fff3cd; border-color: #ffeaa7; }
.test-solved-group.difficulty-medium { background: #d4edda; border-color: #98fb98; }
.test-solved-group.difficulty-hard { background: #cce5ff; border-color: #74b9ff; }
.test-solved-group.difficulty-expert { background: #e6ccff; border-color: #a29bfe; }

.test-group-category {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
}

.test-group-words {
    font-size: 0.9rem;
    color: #666;
}

.test-solution {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1rem;
}

.test-group {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 6px;
    font-size: 0.9rem;
}

.test-group.difficulty-easy { background: #fff3cd; }
.test-group.difficulty-medium { background: #d4edda; }
.test-group.difficulty-hard { background: #cce5ff; }
.test-group.difficulty-expert { background: #e6ccff; }

@media (max-width: 768px) {
    .test-word-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .test-controls {
        flex-direction: column;
        align-items: stretch;
    }
    
    .test-game-info {
        flex-direction: column;
        gap: 0.5rem;
        text-align: center;
    }
}
</style>
`;

// Inject test game styles
document.head.insertAdjacentHTML('beforeend', testGameStyles);

// Initialize the puzzle creator when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PuzzleCreator();
});
