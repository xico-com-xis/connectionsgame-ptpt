// Supabase API integration for puzzle submissions
class PuzzleSubmissionAPI {
    constructor() {
        // Supabase configuration - anon key is safe to expose in frontend
        this.supabaseUrl = 'https://yvgmnfxyaqrigeohcket.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z21uZnh5YXFyaWdlb2hja2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzMyNDUsImV4cCI6MjA3MzAwOTI0NX0.iWNnmlIoNjouhQg9lBgyRUVxlmrvY09KzBeSnKY9ZsM';
        this.apiUrl = `${this.supabaseUrl}/rest/v1`;
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

            const response = await fetch(`${this.apiUrl}/puzzle_submissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify(submission)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
                hard: [],
                expert: []
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
}

// Export for use in other files
window.PuzzleSubmissionAPI = PuzzleSubmissionAPI;
