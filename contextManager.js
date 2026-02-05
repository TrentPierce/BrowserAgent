/**
 * ============================================================================
 * CONTEXT MANAGER - Session & State Tracking
 * ============================================================================
 * 
 * Tracks the agent's session state, navigation history, and action history.
 * Used by EnhancedAgent to provide context to the LLM and detect loops.
 * 
 * KEY FEATURES:
 * - Session management (start, end, persistence)
 * - URL history tracking
 * - Action history with success/failure tracking
 * - Loop detection (scroll loops, navigation regression, alternating patterns)
 * - DOM snapshot storage
 * - Chat message logging
 * 
 * ============================================================================
 */

const crypto = require('crypto');

class ContextManager {
    constructor(database) {
        this.db = database;
        this.currentSession = null;
        this.currentDomain = null;
        this.urlHistory = [];
        this.actionHistory = [];
        this.domHistory = [];
    }

    startSession(goal, initialUrl = null) {
        // Extract domain from URL
        const domain = initialUrl ? this.extractDomain(initialUrl) : null;
        this.currentDomain = domain;

        // Create session in database (if available)
        let session = { id: Date.now(), uuid: crypto.randomUUID() };
        if (this.db) {
            try {
                session = this.db.createSession(goal, domain);
            } catch (e) {
                console.warn('[ContextManager] Database error, using in-memory session:', e.message);
            }
        }

        this.currentSession = {
            id: session.id,
            uuid: session.uuid,
            goal: goal,
            domain: domain,
            startTime: new Date(),
            actions: [],
            chatMessages: []
        };

        if (initialUrl) {
            this.urlHistory.push(initialUrl);
        }

        console.log(`[ContextManager] Session started: ${session.uuid} for goal: ${goal}`);
        return this.currentSession;
    }

    endSession(status = 'completed') {
        if (!this.currentSession) {
            console.warn('[ContextManager] No active session to end');
            return;
        }

        // Update session in database (if available)
        if (this.db) {
            try {
                this.db.endSession(this.currentSession.id, status);

                // Save URL history
                if (this.db.db) {
                    const stmt = this.db.db.prepare(`
                        UPDATE sessions SET url_history = ? WHERE id = ?
                    `);
                    stmt.run(JSON.stringify(this.urlHistory), this.currentSession.id);
                }
            } catch (e) {
                console.warn('[ContextManager] Database error ending session:', e.message);
            }
        }

        console.log(`[ContextManager] Session ended: ${this.currentSession.uuid} with status: ${status}`);

        // Clear current session
        const endedSession = { ...this.currentSession };
        this.currentSession = null;
        this.currentDomain = null;
        this.urlHistory = [];
        this.actionHistory = [];
        this.domHistory = [];

        return endedSession;
    }

    logAction(actionType, actionDetails, options = {}) {
        if (!this.currentSession) {
            console.warn('[ContextManager] Cannot log action: no active session');
            return null;
        }

        const interaction = {
            sessionId: this.currentSession.id,
            actionType: actionType,
            actionDetails: actionDetails,
            domState: options.domState || null,
            screenshotPath: options.screenshotPath || null,
            geminiPrompt: options.geminiPrompt || null,
            geminiResponse: options.geminiResponse || null,
            success: options.success !== undefined ? options.success : null,
            errorMessage: options.errorMessage || null,
            userFeedback: options.userFeedback || null,
            retryCount: options.retryCount || 0,
            executionTimeMs: options.executionTimeMs || null
        };

        let interactionId = Date.now();
        if (this.db) {
            try {
                interactionId = this.db.logInteraction(
                    this.currentSession.id,
                    actionType,
                    interaction
                );
            } catch (e) {
                console.warn('[ContextManager] Database error logging action:', e.message);
            }
        }

        // Track in memory
        this.actionHistory.push({
            id: interactionId,
            type: actionType,
            details: actionDetails,
            timestamp: new Date(),
            success: interaction.success
        });

        return interactionId;
    }

    updateActionResult(interactionId, success, feedback = null) {
        if (this.db) {
            try {
                this.db.updateInteractionSuccess(interactionId, success, feedback);
            } catch (e) {
                console.warn('[ContextManager] Database error updating action result:', e.message);
            }
        }

        // Update in-memory history
        const action = this.actionHistory.find(a => a.id === interactionId);
        if (action) {
            action.success = success;
            action.feedback = feedback;
        }
    }

    recordNavigation(url) {
        this.urlHistory.push(url);
        this.currentDomain = this.extractDomain(url);

        // Update session domain if changed
        if (this.currentSession && this.currentDomain !== this.currentSession.domain) {
            if (this.db && this.db.db) {
                try {
                    const stmt = this.db.db.prepare(`
                        UPDATE sessions SET domain = ? WHERE id = ?
                    `);
                    stmt.run(this.currentDomain, this.currentSession.id);
                } catch (e) {
                    console.warn('[ContextManager] Database error updating domain:', e.message);
                }
            }
            this.currentSession.domain = this.currentDomain;
        }
    }

    saveDomState(domSnapshot) {
        this.domHistory.push({
            timestamp: new Date(),
            dom: domSnapshot,
            url: this.urlHistory[this.urlHistory.length - 1] || null
        });

        // Keep only last 10 DOM states to manage memory
        if (this.domHistory.length > 10) {
            this.domHistory.shift();
        }
    }

    getCurrentContext() {
        return {
            session: this.currentSession,
            domain: this.currentDomain,
            currentUrl: this.urlHistory[this.urlHistory.length - 1] || null,
            urlHistory: this.urlHistory,
            recentActions: this.actionHistory.slice(-10),
            recentDomStates: this.domHistory.slice(-3)
        };
    }

    getSessionHistory(limit = 50) {
        if (!this.currentSession) return [];
        if (!this.db) return this.actionHistory.slice(-limit);
        try {
            return this.db.getSessionInteractions(this.currentSession.id, limit);
        } catch (e) {
            console.warn('[ContextManager] Database error getting session history:', e.message);
            return this.actionHistory.slice(-limit);
        }
    }

    getSessionStats(sessionId) {
        if (!this.db) return null;
        try {
            return this.db.getSessionStats(sessionId);
        } catch (e) {
            console.warn('[ContextManager] Database error getting session stats:', e.message);
            return null;
        }
    }

    // Chat message management
    addChatMessage(sender, message, messageType = 'text', context = null) {
        if (!this.currentSession) {
            console.warn('[ContextManager] Cannot add chat message: no active session');
            return null;
        }

        let messageId = Date.now();
        if (this.db) {
            try {
                messageId = this.db.addChatMessage(
                    this.currentSession.id,
                    sender,
                    message,
                    messageType,
                    context
                );
            } catch (e) {
                console.warn('[ContextManager] Database error adding chat message:', e.message);
            }
        }

        this.currentSession.chatMessages.push({
            id: messageId,
            sender: sender,
            message: message,
            timestamp: new Date(),
            type: messageType
        });

        return messageId;
    }

    getChatHistory(limit = 50) {
        if (!this.currentSession) return [];
        if (!this.db) {
            return this.currentSession.chatMessages.slice(-limit);
        }
        try {
            return this.db.getChatHistory(this.currentSession.id, limit);
        } catch (e) {
            console.warn('[ContextManager] Database error getting chat history:', e.message);
            return this.currentSession.chatMessages.slice(-limit);
        }
    }

    searchChatHistory(searchQuery, limit = 20) {
        if (!this.currentSession) return [];
        if (!this.db) {
            const lowerQuery = searchQuery.toLowerCase();
            return this.currentSession.chatMessages
                .filter(m => m.message.toLowerCase().includes(lowerQuery))
                .slice(-limit);
        }
        try {
            return this.db.searchChatHistory(this.currentSession.id, searchQuery, limit);
        } catch (e) {
            console.warn('[ContextManager] Database error searching chat history:', e.message);
            return [];
        }
    }

    // Challenge tracking
    recordChallenge(challengeType, description, attemptedSolutions = []) {
        if (!this.currentSession) return null;
        if (!this.db) return Date.now();

        try {
            return this.db.recordChallenge(
                this.currentSession.id,
                this.currentDomain,
                challengeType,
                description,
                attemptedSolutions
            );
        } catch (e) {
            console.warn('[ContextManager] Database error recording challenge:', e.message);
            return null;
        }
    }

    resolveChallenge(challengeId, resolution, userGuidance, success) {
        if (!this.db) return;
        try {
            this.db.resolveChallenge(challengeId, resolution, userGuidance, success);
        } catch (e) {
            console.warn('[ContextManager] Database error resolving challenge:', e.message);
        }
    }

    getSimilarChallenges(challengeType) {
        if (!this.currentDomain) return [];
        if (!this.db) return [];
        try {
            return this.db.getSimilarChallenges(this.currentDomain, challengeType);
        } catch (e) {
            console.warn('[ContextManager] Database error getting similar challenges:', e.message);
            return [];
        }
    }

    // Context analysis
    getRecentFailures(count = 5) {
        return this.actionHistory
            .filter(a => a.success === false)
            .slice(-count);
    }

    getSuccessRate() {
        const total = this.actionHistory.length;
        if (total === 0) return 1.0;

        const successful = this.actionHistory.filter(a => a.success === true).length;
        return successful / total;
    }

    detectLoop(threshold = 3) {
        // Detect if we're stuck in a loop by checking recent actions
        if (this.actionHistory.length < threshold) return false;

        const recent = this.actionHistory.slice(-threshold);
        const actionSignatures = recent.map(a => `${a.type}-${JSON.stringify(a.details)}`);

        // Check if the same action is repeated
        const uniqueActions = [...new Set(actionSignatures)];
        if (uniqueActions.length === 1) {
            return { type: 'exact_repeat', action: recent[0].type };
        }

        // Check for scroll loop specifically (scrolling 3+ times in a row)
        const recentTypes = recent.map(a => a.type);
        if (recentTypes.every(t => t === 'scroll' || t === 'scrolling')) {
            return { type: 'scroll_loop', count: threshold };
        }

        // Check for alternating pattern (e.g., scroll-click-scroll-click)
        if (threshold >= 4) {
            const lastFour = this.actionHistory.slice(-4);
            const pattern1 = lastFour[0]?.type;
            const pattern2 = lastFour[1]?.type;
            if (pattern1 && pattern2 &&
                lastFour[2]?.type === pattern1 && lastFour[3]?.type === pattern2) {
                return { type: 'alternating', actions: [pattern1, pattern2] };
            }
        }

        // Check for navigation regression (going back to same URL)
        if (this.urlHistory.length >= 3) {
            const recentUrls = this.urlHistory.slice(-3);
            if (recentUrls[0] === recentUrls[2] && recentUrls[0] !== recentUrls[1]) {
                return { type: 'navigation_regression', url: recentUrls[0] };
            }
        }

        return false;
    }

    // Get count of consecutive scroll actions
    getConsecutiveScrollCount() {
        let count = 0;
        for (let i = this.actionHistory.length - 1; i >= 0; i--) {
            if (this.actionHistory[i].type === 'scroll' || this.actionHistory[i].type === 'scrolling') {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    getProgress() {
        if (!this.currentSession) return null;

        const totalActions = this.actionHistory.length;
        const successfulActions = this.actionHistory.filter(a => a.success === true).length;
        const failedActions = this.actionHistory.filter(a => a.success === false).length;

        return {
            totalActions,
            successfulActions,
            failedActions,
            successRate: totalActions > 0 ? successfulActions / totalActions : 0,
            urlsVisited: this.urlHistory.length,
            duration: new Date() - this.currentSession.startTime
        };
    }

    // Utility methods
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (error) {
            return null;
        }
    }

    getRecentUrls(count = 5) {
        return this.urlHistory.slice(-count);
    }

    hasVisitedUrl(url) {
        return this.urlHistory.some(u => u.includes(url) || url.includes(u));
    }

    // Export session data
    exportSession() {
        if (!this.currentSession) return null;

        return {
            session: this.currentSession,
            urlHistory: this.urlHistory,
            actionHistory: this.actionHistory,
            progress: this.getProgress(),
            exportedAt: new Date().toISOString()
        };
    }

    // Resume previous session (if applicable)
    resumeSession(sessionId) {
        if (!this.db) {
            console.warn('[ContextManager] Cannot resume session: database not available');
            return false;
        }

        let session;
        try {
            session = this.db.getSession(sessionId);
        } catch (e) {
            console.warn('[ContextManager] Database error resuming session:', e.message);
            return false;
        }

        if (!session) {
            console.warn(`[ContextManager] Session ${sessionId} not found`);
            return false;
        }

        this.currentSession = {
            id: session.id,
            uuid: session.session_uuid,
            goal: session.goal,
            domain: session.domain,
            startTime: new Date(session.start_time),
            actions: [],
            chatMessages: []
        };

        this.currentDomain = session.domain;

        if (session.url_history) {
            try {
                this.urlHistory = JSON.parse(session.url_history);
            } catch (e) {
                this.urlHistory = [];
            }
        }

        console.log(`[ContextManager] Resumed session: ${session.session_uuid}`);
        return true;
    }
}

module.exports = ContextManager;
