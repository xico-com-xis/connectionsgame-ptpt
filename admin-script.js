// Admin Script for managing puzzle submissions
class AdminInterface {
    constructor() {
        this.api = new PuzzleSubmissionAPI();
        this.currentUser = null;
        this.submissions = [];
        this.currentReview = null;
        
        this.initializeEventListeners();
        this.checkAuthenticationStatus();
    }

    initializeEventListeners() {
        // Authentication form
        const authForm = document.getElementById('authForm');
        if (authForm) {
            authForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadSubmissions());
        }

        // Filter select
        const filterStatus = document.getElementById('filterStatus');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.applyFilters());
        }

        // Modal close
        const modal = document.getElementById('reviewModal');
        const closeBtn = modal?.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Click outside modal to close
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        // Review actions
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        if (approveBtn) {
            approveBtn.addEventListener('click', () => this.approveSubmission());
        }
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => this.rejectSubmission());
        }
    }

    async checkAuthenticationStatus() {
        try {
            // Check if user is already authenticated
            const user = await this.api.getCurrentUser();
            if (user) {
                this.currentUser = user;
                this.showAdminPanel();
                await this.loadDashboard();
            } else {
                this.showAuthSection();
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.showAuthSection();
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const messageDiv = document.getElementById('authMessage');

        try {
            const user = await this.api.login(email, password);
            if (user) {
                this.currentUser = user;
                this.showMessage(messageDiv, 'Login realizado com sucesso!', 'success');
                setTimeout(() => {
                    this.showAdminPanel();
                    this.loadDashboard();
                }, 1000);
            }
        } catch (error) {
            console.error('Login failed:', error);
            this.showMessage(messageDiv, 'Credenciais inválidas. Tente novamente.', 'error');
        }
    }

    async handleLogout() {
        try {
            await this.api.logout();
            this.currentUser = null;
            this.showAuthSection();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    showAuthSection() {
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
    }

    showAdminPanel() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
    }

    showMessage(container, message, type) {
        container.innerHTML = `<div class="auth-message ${type}">${message}</div>`;
    }

    async loadDashboard() {
        try {
            // Load submissions and stats
            await Promise.all([
                this.loadSubmissions(),
                this.loadStats()
            ]);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }

    async loadStats() {
        try {
            const stats = await this.api.getStats();
            
            document.getElementById('totalSubmissions').textContent = stats.total || 0;
            document.getElementById('pendingSubmissions').textContent = stats.pending || 0;
            document.getElementById('approvedSubmissions').textContent = stats.approved || 0;
            document.getElementById('rejectedSubmissions').textContent = stats.rejected || 0;
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadSubmissions() {
        try {
            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'block';
            }

            this.submissions = await this.api.getSubmissions();
            this.renderSubmissions();
            
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load submissions:', error);
            const submissionsList = document.getElementById('submissionsList');
            if (submissionsList) {
                submissionsList.innerHTML = '<p style="text-align: center; color: #666;">Erro ao carregar submissões.</p>';
            }
        }
    }

    applyFilters() {
        const filterStatus = document.getElementById('filterStatus').value;
        
        let filteredSubmissions = this.submissions;
        
        if (filterStatus !== 'all') {
            filteredSubmissions = this.submissions.filter(sub => sub.status === filterStatus);
        }
        
        this.renderSubmissions(filteredSubmissions);
    }

    renderSubmissions(submissions = this.submissions) {
        const submissionsList = document.getElementById('submissionsList');
        
        if (!submissions || submissions.length === 0) {
            submissionsList.innerHTML = '<p style="text-align: center; color: #666;">Nenhuma submissão encontrada.</p>';
            return;
        }

        submissionsList.innerHTML = submissions.map(submission => 
            this.createSubmissionCard(submission)
        ).join('');

        // Add event listeners for action buttons
        submissions.forEach(submission => {
            const reviewBtn = document.getElementById(`review-${submission.id}`);
            const quickApproveBtn = document.getElementById(`approve-${submission.id}`);
            const quickRejectBtn = document.getElementById(`reject-${submission.id}`);

            if (reviewBtn) {
                reviewBtn.addEventListener('click', () => this.openReviewModal(submission));
            }
            if (quickApproveBtn) {
                quickApproveBtn.addEventListener('click', () => this.quickApprove(submission.id));
            }
            if (quickRejectBtn) {
                quickRejectBtn.addEventListener('click', () => this.quickReject(submission.id));
            }
        });
    }

    createSubmissionCard(submission) {
        const statusClass = submission.status;
        const statusText = {
            'pending': 'Pendente',
            'approved': 'Aprovado',
            'rejected': 'Rejeitado'
        }[submission.status] || submission.status;

        const puzzleData = typeof submission.puzzle_data === 'string' 
            ? JSON.parse(submission.puzzle_data) 
            : submission.puzzle_data;

        const previewGroups = puzzleData.groups.map((group, index) => {
            const difficulties = ['easy', 'medium', 'hard', 'expert'];
            return `
                <div class="preview-group difficulty-${difficulties[index] || 'easy'}">
                    <div class="preview-category">${group.category}</div>
                    <div class="preview-words">${group.words.join(', ')}</div>
                </div>
            `;
        }).join('');

        const submittedDate = new Date(submission.submitted_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="submission-card ${statusClass}">
                <div class="submission-header">
                    <div class="submission-info">
                        <h3>${submission.title || 'Sem título'}</h3>
                        <div class="submission-meta">
                            Por: ${submission.creator_name || 'Anônimo'} • 
                            Submetido em: ${submittedDate}
                            ${submission.creator_email ? ` • ${submission.creator_email}` : ''}
                        </div>
                    </div>
                    <span class="submission-status ${statusClass}">${statusText}</span>
                </div>
                
                <div class="submission-preview">
                    <div class="preview-groups">
                        ${previewGroups}
                    </div>
                </div>
                
                <div class="submission-actions">
                    <button class="btn btn-primary btn-sm" id="review-${submission.id}">
                        Revisar
                    </button>
                    ${submission.status === 'pending' ? `
                        <button class="btn btn-success btn-sm" id="approve-${submission.id}">
                            Aprovar
                        </button>
                        <button class="btn btn-danger btn-sm" id="reject-${submission.id}">
                            Rejeitar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    openReviewModal(submission) {
        this.currentReview = submission;
        
        // Populate modal with submission data
        document.getElementById('reviewTitle').textContent = submission.title || 'Sem título';
        document.getElementById('reviewCreator').textContent = 
            `Por: ${submission.creator_name || 'Anônimo'}`;
        
        const puzzleData = typeof submission.puzzle_data === 'string' 
            ? JSON.parse(submission.puzzle_data) 
            : submission.puzzle_data;
            
        document.getElementById('reviewPuzzle').innerHTML = this.createDetailedPreview(puzzleData);
        
        // Set current status
        const statusSelect = document.getElementById('reviewStatus');
        statusSelect.value = submission.status;
        
        // Set admin notes if any
        const notesTextarea = document.getElementById('adminNotes');
        notesTextarea.value = submission.admin_notes || '';
        
        // Show/hide action buttons based on status
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        
        approveBtn.style.display = submission.status !== 'approved' ? 'block' : 'none';
        rejectBtn.style.display = submission.status !== 'rejected' ? 'block' : 'none';
        
        // Show modal
        document.getElementById('reviewModal').classList.add('show');
    }

    createDetailedPreview(puzzleData) {
        const difficulties = ['easy', 'medium', 'hard', 'expert'];
        const difficultyLabels = ['Fácil', 'Médio', 'Difícil', 'Expert'];
        
        return puzzleData.groups.map((group, index) => `
            <div class="preview-group difficulty-${difficulties[index] || 'easy'}">
                <div class="preview-category">
                    <strong>${group.category}</strong> 
                    <span style="font-size: 0.8em; color: #666;">(${difficultyLabels[index] || 'Fácil'})</span>
                </div>
                <div class="preview-words">${group.words.join(', ')}</div>
            </div>
        `).join('');
    }

    closeModal() {
        document.getElementById('reviewModal').classList.remove('show');
        this.currentReview = null;
    }

    async approveSubmission() {
        if (!this.currentReview) return;
        
        const adminNotes = document.getElementById('adminNotes').value;
        
        try {
            await this.api.updateSubmissionStatus(this.currentReview.id, 'approved', adminNotes);
            this.closeModal();
            await this.loadDashboard(); // Refresh data
        } catch (error) {
            console.error('Failed to approve submission:', error);
            alert('Erro ao aprovar submissão. Tente novamente.');
        }
    }

    async rejectSubmission() {
        if (!this.currentReview) return;
        
        const adminNotes = document.getElementById('adminNotes').value;
        
        if (!adminNotes.trim()) {
            alert('Por favor, forneça um motivo para a rejeição nas notas administrativas.');
            return;
        }
        
        try {
            await this.api.updateSubmissionStatus(this.currentReview.id, 'rejected', adminNotes);
            this.closeModal();
            await this.loadDashboard(); // Refresh data
        } catch (error) {
            console.error('Failed to reject submission:', error);
            alert('Erro ao rejeitar submissão. Tente novamente.');
        }
    }

    async quickApprove(submissionId) {
        if (!confirm('Tem certeza que deseja aprovar esta submissão?')) return;
        
        try {
            await this.api.updateSubmissionStatus(submissionId, 'approved', 'Aprovação rápida');
            await this.loadDashboard(); // Refresh data
        } catch (error) {
            console.error('Failed to approve submission:', error);
            alert('Erro ao aprovar submissão. Tente novamente.');
        }
    }

    async quickReject(submissionId) {
        const reason = prompt('Motivo da rejeição:');
        if (!reason || !reason.trim()) return;
        
        try {
            await this.api.updateSubmissionStatus(submissionId, 'rejected', reason);
            await this.loadDashboard(); // Refresh data
        } catch (error) {
            console.error('Failed to reject submission:', error);
            alert('Erro ao rejeitar submissão. Tente novamente.');
        }
    }
}

// Initialize admin interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the admin page
    if (document.getElementById('adminContainer')) {
        new AdminInterface();
    }
});

// Add some utility functions for better UX
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
