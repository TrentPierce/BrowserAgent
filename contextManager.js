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

        // Create session in database
        const session = this.db.createSession(goal, domain);
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

        // Update session in database
        this.db.endSession(this.currentSession.id, status);

        // Save URL history
        const stmt = this.db.db.prepare(`
            UPDATE sessions SET url_history = ? WHERE id = ?
        `);
        stmt.run(JSON.stringify(this.urlHistory), this.currentSession.id);

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

        const interactionId = this.db.logInteraction(
            this.currentSession.id,
            actionType,
            interaction
        );

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
        this.db.updateInteractionSuccess(interactionId, success, feedback);

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
            const stmt = this.db.db.prepare(`
                UPDATE sessions SET domain = ? WHERE id = ?
            `);
            stmt.run(this.currentDomain, this.currentSession.id);
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
        return this.db.getSessionInteractions(this.currentSession.id, limit);
    }

    getSessionStats(sessionId) {
        return this.db.getSessionStats(sessionId);
    }

    // Chat message management
    addChatMessage(sender, message, messageType = 'text', context = null) {
        if (!this.currentSession) {
            console.warn('[ContextManager] Cannot add chat message: no active session');
            return null;
        }

        const messageId = this.db.addChatMessage(
            this.currentSession.id,
            sender,
            message,
            messageType,
            context
        );

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
        return this.db.getChatHistory(this.currentSession.id, limit);
    }

    searchChatHistory(searchQuery, limit = 20) {
        if (!this.currentSession) return [];
        return this.db.searchChatHistory(this.currentSession.id, searchQuery, limit);
    }

    // Challenge tracking
    recordChallenge(challengeType, description, attemptedSolutions = []) {
        if (!this.currentSession) return null;

        return this.db.recordChallenge(
            this.currentSession.id,
            this.currentDomain,
            challengeType,
            description,
            attemptedSolutions
        );
    }

    resolveChallenge(challengeId, resolution, userGuidance, success) {
        this.db.resolveChallenge(challengeId, resolution, userGuidance, success);
    }

    getSimilarChallenges(challengeType) {
        if (!this.currentDomain) return [];
        return this.db.getSimilarChallenges(this.currentDomain, challengeType);
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
        return uniqueActions.length === 1;
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
        const session = this.db.getSession(sessionId);
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
