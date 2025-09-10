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
        const authForm = document.getElementById('loginForm'); // Fixed: was 'authForm'
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Prevent page reload
                e.stopPropagation(); // Stop event bubbling
                this.handleLogin(e);
                return false; // Extra prevention
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDashboard());
        }

        // Filter select
        const filterStatus = document.getElementById('statusFilter');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.applyFilters());
        }

    }

    async checkAuthenticationStatus() {
        try {
            console.log('Checking authentication status...');
            // Check if user is already authenticated
            const user = await this.api.getCurrentUser();
            console.log('Current user check result:', user);
            
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
        
        const email = document.getElementById('adminEmail').value.trim(); // Fixed: was 'email'
        const password = document.getElementById('adminPassword').value; // Fixed: was 'password'
        const messageDiv = document.getElementById('authMessage');

        if (!email || !password) {
            this.showMessage(messageDiv, 'Por favor, preencha email e password.', 'error');
            return;
        }

        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'A verificar...';
        submitBtn.disabled = true;

        try {
            console.log('Attempting login for:', email);
            const user = await this.api.login(email, password);
            
            if (user) {
                this.currentUser = user;
                this.showMessage(messageDiv, 'Login realizado com sucesso!', 'success');
                console.log('Login successful:', user);
                
                setTimeout(() => {
                    this.showAdminPanel();
                    this.loadDashboard();
                }, 1000);
            } else {
                throw new Error('Falha na autenticação');
            }
        } catch (error) {
            console.error('Login failed:', error);
            let errorMessage = 'Credenciais inválidas. Tente novamente.';
            
            if (error.message.includes('not authorized as admin')) {
                errorMessage = 'Esta conta não tem permissões de administrador.';
            } else if (error.message.includes('Invalid password')) {
                errorMessage = 'Password incorreta. Tente: admin123, password, 123456, ou admin';
            } else if (error.message.includes('Failed to verify admin status')) {
                errorMessage = 'Erro ao verificar permissões. Tente novamente.';
            }
            
            this.showMessage(messageDiv, errorMessage, 'error');
        } finally {
            // Restore button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
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

    async refreshDashboard() {
        console.log('Refreshing dashboard...');
        try {
            // Refresh both stats and submissions while preserving filter
            await Promise.all([
                this.loadStats(),
                this.loadSubmissions()
            ]);
            console.log('Dashboard refreshed successfully');
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
        }
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
            
            document.getElementById('totalCount').textContent = stats.total || 0;
            document.getElementById('pendingCount').textContent = stats.pending || 0;
            document.getElementById('approvedCount').textContent = stats.approved || 0;
            // Note: There's no rejectedCount element in the HTML, so we skip it
            console.log('Stats loaded:', stats);
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
            
            // Apply current filter after loading submissions
            this.applyFilters();
            
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
        const filterStatus = document.getElementById('statusFilter').value;
        
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
            const quickApproveBtn = document.getElementById(`approve-${submission.id}`);
            const quickRejectBtn = document.getElementById(`reject-${submission.id}`);

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
            const difficulties = ['easy', 'medium', 'hard'];
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
                            Por: ${submission.submitted_by || 'Anónimo'} • 
                            Submetido em: ${submittedDate}
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

    createDetailedPreview(puzzleData) {
        const difficulties = ['easy', 'medium', 'hard'];
        const difficultyLabels = ['Fácil', 'Médio', 'Difícil'];
        
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
    console.log('DOM loaded, checking for admin elements...');
    // Check if we're on the admin page
    const authSection = document.getElementById('authSection');
    if (authSection) {
        console.log('Admin page detected, initializing admin interface...');
        new AdminInterface();
    } else {
        console.log('Admin elements not found - not on admin page');
        console.log('Available elements with IDs:', 
            Array.from(document.querySelectorAll('[id]')).map(el => el.id)
        );
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
