// Supabase API integration for puzzle submissions
class PuzzleSubmissionAPI {
    constructor() {
        // Supabase configuration - anon key is safe to expose in frontend
        this.supabaseUrl = 'https://yvgmnfxyaqrigeohcket.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z21uZnh5YXFyaWdlb2hja2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzMyNDUsImV4cCI6MjA3MzAwOTI0NX0.iWNnmlIoNjouhQg9lBgyRUVxlmrvY09KzBeSnKY9ZsM';
        this.apiUrl = `${this.supabaseUrl}/rest/v1`;
        this.authUrl = `${this.supabaseUrl}/auth/v1`;
        this.currentUser = null;
    }

    // Submit a puzzle for review
    async submitPuzzle(puzzleData, submitterInfo = {}) {
        try {
            const submission = {
                puzzle_data: puzzleData,
                submitted_by: submitterInfo.email || 'Anónimo',
                title: submitterInfo.title || null,
                description: submitterInfo.description || null
            };

            console.log('Submitting puzzle data:', submission); // Debug log

            const response = await fetch(`${this.apiUrl}/puzzle_submissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(submission)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Supabase error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            return { success: true, id: result[0]?.id };
        } catch (error) {
            console.error('Error submitting puzzle:', error);
            return { success: false, error: error.message };
        }
    }

    // Get approved puzzles from database
    async getApprovedPuzzles() {
        try {
            const response = await fetch(`${this.apiUrl}/approved_puzzles?is_active=eq.true&order=created_at.desc`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const puzzles = await response.json();
            
            // Group by difficulty
            const groupedPuzzles = {
                easy: [],
                medium: [],
                hard: []
            };

            puzzles.forEach(puzzle => {
                if (groupedPuzzles[puzzle.difficulty]) {
                    groupedPuzzles[puzzle.difficulty].push({
                        category: puzzle.category,
                        words: puzzle.words,
                        difficulty: puzzle.difficulty
                    });
                }
            });

            return { success: true, puzzles: groupedPuzzles };
        } catch (error) {
            console.error('Error fetching approved puzzles:', error);
            return { success: false, error: error.message, puzzles: null };
        }
    }

    // Record puzzle play analytics (optional)
    async recordPuzzlePlay(puzzleId, completed = false, mistakeCount = 0) {
        try {
            const analyticsData = {
                puzzle_id: puzzleId,
                play_count: 1,
                completion_count: completed ? 1 : 0,
                average_mistakes: mistakeCount
            };

            await fetch(`${this.apiUrl}/puzzle_analytics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify(analyticsData)
            });
        } catch (error) {
            console.error('Error recording analytics:', error);
        }
    }

    // Admin functions (require authentication)
    async getPendingSubmissions(adminToken) {
        try {
            const response = await fetch(`${this.apiUrl}/puzzle_submissions?status=eq.pending&order=created_at.asc`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${adminToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching pending submissions:', error);
            return [];
        }
    }

    async approveSubmission(submissionId, adminToken, adminNotes = '') {
        try {
            // First, get the submission
            const submissionResponse = await fetch(`${this.apiUrl}/puzzle_submissions?id=eq.${submissionId}`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${adminToken}`
                }
            });

            const submissions = await submissionResponse.json();
            if (submissions.length === 0) {
                throw new Error('Submission not found');
            }

            const submission = submissions[0];
            const puzzleData = submission.puzzle_data;

            // Add each group to approved_puzzles
            const approvalPromises = puzzleData.groups.map(group => 
                fetch(`${this.apiUrl}/approved_puzzles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({
                        original_submission_id: submissionId,
                        category: group.category,
                        words: group.words,
                        difficulty: group.difficulty,
                        created_by: submission.submitted_by
                    })
                })
            );

            await Promise.all(approvalPromises);

            // Update submission status
            await fetch(`${this.apiUrl}/puzzle_submissions?id=eq.${submissionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    status: 'approved',
                    admin_notes: adminNotes,
                    reviewed_at: new Date().toISOString()
                })
            });

            return { success: true };
        } catch (error) {
            console.error('Error approving submission:', error);
            return { success: false, error: error.message };
        }
    }

    async rejectSubmission(submissionId, adminToken, adminNotes = '') {
        try {
            await fetch(`${this.apiUrl}/puzzle_submissions?id=eq.${submissionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    status: 'rejected',
                    admin_notes: adminNotes,
                    reviewed_at: new Date().toISOString()
                })
            });

            return { success: true };
        } catch (error) {
            console.error('Error rejecting submission:', error);
            return { success: false, error: error.message };
        }
    }

    // Authentication methods using Supabase Auth
    async getCurrentUser() {
        try {
            // Check if we have a stored session
            const session = localStorage.getItem('supabase.auth.token');
            if (session) {
                const sessionData = JSON.parse(session);
                const token = sessionData.access_token;
                
                // Verify the token is still valid
                const response = await fetch(`${this.authUrl}/user`, {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const user = await response.json();
                    
                    // Check if user is admin
                    const adminCheck = await this.checkAdminStatus(user.email, token);
                    if (adminCheck) {
                        this.currentUser = { ...user, adminData: adminCheck, token };
                        return this.currentUser;
                    }
                }
                // Session invalid, clear it
                localStorage.removeItem('supabase.auth.token');
            }
            return null;
        } catch (error) {
            console.error('Error checking user session:', error);
            localStorage.removeItem('supabase.auth.token');
            return null;
        }
    }

    async checkAdminStatus(email, token) {
        try {
            const response = await fetch(`${this.apiUrl}/admin_users?email=eq.${encodeURIComponent(email)}&is_active=eq.true`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const adminUsers = await response.json();
                return adminUsers.length > 0 ? adminUsers[0] : null;
            }
            return null;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return null;
        }
    }

    async login(email, password) {
        try {
            console.log('Starting Supabase Auth login for:', email);
            
            // Use Supabase Auth to sign in
            const response = await fetch(`${this.authUrl}/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            console.log('Auth response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Auth error:', errorData);
                
                // Don't attempt signup - only existing auth users can login
                throw new Error(errorData.error_description || 'Invalid login credentials');
            }

            const authData = await response.json();
            console.log('Auth successful, checking admin status...');
            
            // Check if user is admin
            const adminData = await this.checkAdminStatus(authData.user.email, authData.access_token);
            
            if (!adminData) {
                // Sign out the user since they're not admin
                await this.logout();
                throw new Error('User is not authorized as admin');
            }

            // Store the session
            localStorage.setItem('supabase.auth.token', JSON.stringify(authData));
            
            const user = {
                ...authData.user,
                adminData: adminData,
                token: authData.access_token
            };

            this.currentUser = user;
            console.log('Admin login successful:', user);
            
            return user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async logout() {
        try {
            const session = localStorage.getItem('supabase.auth.token');
            if (session) {
                const sessionData = JSON.parse(session);
                
                // Sign out from Supabase
                await fetch(`${this.authUrl}/logout`, {
                    method: 'POST',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${sessionData.access_token}`
                    }
                });
            }
            
            localStorage.removeItem('supabase.auth.token');
            this.currentUser = null;
            console.log('User logged out');
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.removeItem('supabase.auth.token');
            this.currentUser = null;
            return true; // Always succeed logout
        }
    }

    getStoredToken() {
        try {
            const session = localStorage.getItem('supabase.auth.token');
            if (session) {
                const sessionData = JSON.parse(session);
                return sessionData.access_token;
            }
            return this.supabaseKey; // Fallback to anon key
        } catch (error) {
            return this.supabaseKey;
        }
    }

    async getSubmissions() {
        try {
            const token = this.getStoredToken();
            const response = await fetch(`${this.apiUrl}/puzzle_submissions?order=created_at.desc`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch submissions');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching submissions:', error);
            return [];
        }
    }

    async getStats() {
        try {
            const token = this.getStoredToken();
            const response = await fetch(`${this.apiUrl}/puzzle_submissions?select=status`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const submissions = await response.json();
            const stats = {
                total: submissions.length,
                pending: submissions.filter(s => s.status === 'pending').length,
                approved: submissions.filter(s => s.status === 'approved').length,
                rejected: submissions.filter(s => s.status === 'rejected').length
            };

            return stats;
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { total: 0, pending: 0, approved: 0, rejected: 0 };
        }
    }

    async updateSubmissionStatus(submissionId, status, adminNotes = '') {
        try {
            const token = this.getStoredToken();
            const response = await fetch(`${this.apiUrl}/puzzle_submissions?id=eq.${submissionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: status,
                    admin_notes: adminNotes,
                    reviewed_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update submission: ${errorText}`);
            }

            // If approved, also add to approved_puzzles table
            if (status === 'approved') {
                await this.moveToApprovedPuzzles(submissionId);
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating submission status:', error);
            throw error;
        }
    }

    async moveToApprovedPuzzles(submissionId) {
        try {
            const token = this.getStoredToken();
            
            // Get the submission data
            const submissionResponse = await fetch(`${this.apiUrl}/puzzle_submissions?id=eq.${submissionId}`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`
                }
            });

            const submissions = await submissionResponse.json();
            if (submissions.length === 0) return;

            const submission = submissions[0];
            const puzzleData = submission.puzzle_data;

            // Add each group to approved_puzzles
            const approvalPromises = puzzleData.groups.map(group => 
                fetch(`${this.apiUrl}/approved_puzzles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        original_submission_id: submissionId,
                        category: group.category,
                        words: group.words,
                        difficulty: group.difficulty,
                        created_by: submission.submitted_by
                    })
                })
            );

            await Promise.all(approvalPromises);
        } catch (error) {
            console.error('Error moving to approved puzzles:', error);
        }
    }
}

// Export for use in other files
window.PuzzleSubmissionAPI = PuzzleSubmissionAPI;
