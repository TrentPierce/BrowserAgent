/**
 * ============================================================================
 * LEARNING ENGINE - Pattern Recognition & Strategy Library
 * ============================================================================
 * 
 * Records successful/failed patterns and provides recommendations to the agent.
 * Learns from past interactions to improve future performance.
 * 
 * KEY FEATURES:
 * - Success/failure pattern recording
 * - Strategy library (navigation, forms, popups, etc.)
 * - Domain-specific learning
 * - Recommendation generation
 * - Clarifying question generation when stuck
 * - Alternative action suggestions
 * 
 * ============================================================================
 */

class LearningEngine {
    constructor(database, contextManager) {
        this.db = database;
        this.contextManager = contextManager;
        this.strategyLibrary = new Map();
        this.loadStrategies();
    }

    loadStrategies() {
        // Load common strategies into memory
        this.strategyLibrary.set('navigation', {
            patterns: ['navigate', 'goto', 'open'],
            priority: 1
        });
        this.strategyLibrary.set('form_interaction', {
            patterns: ['input', 'type', 'fill', 'enter'],
            priority: 2
        });
        this.strategyLibrary.set('click_interaction', {
            patterns: ['click', 'press', 'tap', 'select'],
            priority: 2
        });
        this.strategyLibrary.set('search', {
            patterns: ['search', 'find', 'lookup'],
            priority: 3
        });
    }

    // Record successful action for learning
    async recordSuccess(action, executionDetails) {
        if (!this.contextManager?.currentDomain) return;
        if (!this.db) return; // No database, skip recording

        const domain = this.contextManager.currentDomain;
        const actionType = this.categorizeAction(action);

        // Extract selector pattern
        const selectorPattern = this.extractSelectorPattern(action.selector);

        // Extract context keywords from DOM
        const contextKeywords = this.extractContextKeywords(executionDetails.domContext);

        try {
            // Record pattern
            this.db.recordPattern(
                actionType,
                domain,
                selectorPattern,
                contextKeywords,
                1.0 // Full success
            );

            // Update user preferences if applicable
            if (actionType === 'preference') {
                this.db.setPreference(domain, action.preferenceKey, action.preferenceValue, 0.9);
            }

            console.log(`[LearningEngine] Recorded success for ${actionType} on ${domain}`);
        } catch (e) {
            console.warn(`[LearningEngine] Database error recording success:`, e.message);
        }
    }

    // Record failed action
    async recordFailure(action, error, attemptNumber) {
        if (!this.contextManager?.currentDomain) return;
        if (!this.db) return; // No database, skip recording

        const domain = this.contextManager.currentDomain;
        const actionType = this.categorizeAction(action);

        // Record with lower success rate
        const selectorPattern = this.extractSelectorPattern(action.selector);
        const contextKeywords = this.extractContextKeywords(action.domContext);

        // Calculate success rate based on attempt number
        const successRate = Math.max(0, 1.0 - (attemptNumber * 0.3));

        try {
            this.db.recordPattern(
                actionType,
                domain,
                selectorPattern,
                contextKeywords,
                successRate
            );

            console.log(`[LearningEngine] Recorded failure for ${actionType} on ${domain} (attempt ${attemptNumber})`);
        } catch (e) {
            console.warn(`[LearningEngine] Database error recording failure:`, e.message);
        }
    }

    // Get learned strategies for current domain
    getStrategiesForCurrentDomain(actionType = null) {
        if (!this.contextManager?.currentDomain) return [];
        if (!this.db) return [];

        try {
            return this.db.getPatternsForDomain(
                this.contextManager.currentDomain,
                actionType,
                0.3 // Minimum 30% success rate
            );
        } catch (e) {
            console.warn(`[LearningEngine] Database error getting strategies:`, e.message);
            return [];
        }
    }

    // Apply learned modifications to an action
    applyLearnedStrategies(action, attemptNumber) {
        if (!this.contextManager?.currentDomain) return action;
        if (!this.db) return action;

        const domain = this.contextManager.currentDomain;
        const actionType = this.categorizeAction(action);

        let patterns = [];
        try {
            // Get learned patterns for this action type
            patterns = this.db.getPatternsForDomain(domain, actionType, 0.5);
        } catch (e) {
            console.warn(`[LearningEngine] Database error getting patterns:`, e.message);
            return action;
        }

        if (patterns.length === 0) return action;

        // Modify action based on learned patterns
        let modifiedAction = { ...action };

        // On second attempt, try alternative selector strategies
        if (attemptNumber === 2) {
            const alternativeSelector = this.findAlternativeSelector(patterns, action.selector);
            if (alternativeSelector) {
                modifiedAction.selector = alternativeSelector;
                modifiedAction._learnedModification = 'alternative_selector';
            }
        }

        // On third attempt, try context-based selection
        if (attemptNumber === 3) {
            const contextBasedSelector = this.findContextBasedSelector(patterns, action);
            if (contextBasedSelector) {
                modifiedAction.selector = contextBasedSelector;
                modifiedAction._learnedModification = 'context_based_selector';
            }

            // Also adjust timing
            modifiedAction._delay = 2000; // Add 2 second delay
        }

        return modifiedAction;
    }

    // Categorize action into types
    categorizeAction(action) {
        if (!action || !action.action) return 'unknown';

        const actionStr = action.action.toLowerCase();
        const text = (action.text || action.reason || '').toLowerCase();

        if (actionStr === 'navigate' || actionStr === 'goto') return 'navigation';
        if (actionStr === 'click' || actionStr === 'press') return 'click_interaction';
        if (actionStr === 'type' || actionStr === 'input' || actionStr === 'fill') return 'form_interaction';
        if (actionStr === 'scroll') return 'scrolling';
        if (text.includes('search') || text.includes('find')) return 'search';
        if (text.includes('submit') || text.includes('login') || text.includes('sign')) return 'form_submission';

        return 'general';
    }

    // Extract pattern from selector
    extractSelectorPattern(selector) {
        if (!selector) return 'unknown';

        // Simplify selector to pattern
        if (selector.includes('data-agent-id')) {
            return '[data-agent-id]';
        }
        if (selector.includes('id=') || selector.startsWith('#')) {
            return '#id';
        }
        if (selector.includes('class=') || selector.includes('.')) {
            return '.class';
        }
        if (selector.includes('button')) {
            return 'button';
        }
        if (selector.includes('input')) {
            return 'input';
        }
        if (selector.includes('a ') || selector.includes('a[')) {
            return 'link';
        }

        return selector.split(' ')[0]; // Return first part
    }

    // Extract keywords from DOM context
    extractContextKeywords(domContext) {
        if (!domContext) return '';

        // Extract important keywords
        const keywords = [];

        if (domContext.includes('search')) keywords.push('search');
        if (domContext.includes('form')) keywords.push('form');
        if (domContext.includes('login')) keywords.push('login');
        if (domContext.includes('menu')) keywords.push('menu');
        if (domContext.includes('nav')) keywords.push('navigation');
        if (domContext.includes('modal')) keywords.push('modal');
        if (domContext.includes('popup')) keywords.push('popup');
        if (domContext.includes('cart')) keywords.push('cart');
        if (domContext.includes('checkout')) keywords.push('checkout');

        return keywords.join(',');
    }

    // Find alternative selector based on learned patterns
    findAlternativeSelector(patterns, currentSelector) {
        // Try to find a pattern with better success rate
        const betterPatterns = patterns.filter(p => p.success_rate > 0.7);

        if (betterPatterns.length > 0) {
            // Return the selector pattern with highest success
            return betterPatterns[0].selector_pattern;
        }

        return null;
    }

    // Find context-based selector
    findContextBasedSelector(patterns, action) {
        const actionText = (action.text || action.reason || '').toLowerCase();

        // Match context keywords
        for (const pattern of patterns) {
            if (pattern.context_keywords) {
                const keywords = pattern.context_keywords.split(',');
                for (const keyword of keywords) {
                    if (actionText.includes(keyword.trim())) {
                        return pattern.selector_pattern;
                    }
                }
            }
        }

        return null;
    }

    // Get recommendations for current state
    getRecommendations() {
        if (!this.contextManager?.currentDomain) return [];
        if (!this.db) return [];

        const domain = this.contextManager.currentDomain;
        const recentActions = this.contextManager.actionHistory?.slice(-5) || [];

        const recommendations = [];

        try {
            // Check for common patterns on this domain
            const topPatterns = this.db.getPatternsForDomain(domain, null, 0.8);

            if (topPatterns.length > 0) {
                recommendations.push({
                    type: 'learned_pattern',
                    message: `This site often uses "${topPatterns[0].selector_pattern}" selectors`,
                    confidence: topPatterns[0].success_rate
                });
            }

            // Check for user preferences
            const preferences = this.db.getAllPreferencesForDomain(domain);
            if (preferences.length > 0) {
                recommendations.push({
                    type: 'user_preference',
                    message: `You have ${preferences.length} saved preferences for this site`,
                    preferences: preferences
                });
            }
        } catch (e) {
            console.warn(`[LearningEngine] Database error getting recommendations:`, e.message);
        }

        // Detect potential issues
        const recentFailures = recentActions.filter(a => a.success === false);
        if (recentFailures.length >= 2) {
            recommendations.push({
                type: 'warning',
                message: 'Multiple recent failures detected. Consider asking for help.',
                severity: 'medium'
            });
        }

        return recommendations;
    }

    // Analyze patterns and suggest improvements
    analyzePatterns() {
        const domain = this.contextManager?.currentDomain;
        if (!domain) return null;
        if (!this.db) return { domain, totalPatterns: 0, averageSuccessRate: 0, totalUses: 0, effectiveness: 'learning' };

        try {
            const stats = this.db.getDomainLearningStats(domain);

            return {
                domain: domain,
                totalPatterns: stats?.total_patterns || 0,
                averageSuccessRate: stats?.avg_success_rate || 0,
                totalUses: stats?.total_uses || 0,
                effectiveness: this.calculateEffectiveness(stats)
            };
        } catch (e) {
            console.warn(`[LearningEngine] Database error analyzing patterns:`, e.message);
            return { domain, totalPatterns: 0, averageSuccessRate: 0, totalUses: 0, effectiveness: 'learning' };
        }
    }

    calculateEffectiveness(stats) {
        if (!stats.total_patterns || stats.total_patterns === 0) return 'learning';

        const avgRate = stats.avg_success_rate || 0;

        if (avgRate > 0.8) return 'excellent';
        if (avgRate > 0.6) return 'good';
        if (avgRate > 0.4) return 'fair';
        return 'needs_improvement';
    }

    // Generate helpful question when stuck
    generateClarifyingQuestion(action, error, context) {
        const actionType = this.categorizeAction(action);
        const recentActions = this.contextManager?.actionHistory?.slice(-3) || [];
        const domain = this.contextManager?.currentDomain || 'this site';
        const currentUrl = context?.currentUrl || 'current page';

        let question = '';
        let options = [];
        let severity = 'medium';

        // Extract useful details from the action
        const selectorInfo = action?.selector ? ` (selector: ${action.selector})` : '';
        const actionReason = action?.reason ? ` Reason: "${action.reason}"` : '';

        // Check for specific failure patterns
        const failureCount = recentActions.filter(a => a.success === false).length;
        const isRepeatedFailure = failureCount >= 2;

        if (this.contextManager.detectLoop()) {
            // LOOP DETECTION - highest priority
            severity = 'high';
            question = `🔄 **Loop Detected on ${domain}**\n\nI've attempted the same action ${failureCount + 1} times without progress.${actionReason}`;
            options = [
                '1️⃣ Skip this step and continue',
                '2️⃣ Try a completely different approach',
                '3️⃣ Scroll down to reveal more options',
                '4️⃣ Go back to previous page',
                '5️⃣ Give me specific instructions'
            ];
        } else if (actionType === 'click_interaction') {
            const elementDesc = selectorInfo || 'the target element';
            question = `🖱️ **Click Failed on ${domain}**\n\nUnable to click ${elementDesc}.\n${error ? `Error: ${error}` : 'The element may be hidden, disabled, or covered by another element.'}`;
            options = [
                '1️⃣ Try clicking a different element',
                '2️⃣ Scroll down first to reveal it',
                '3️⃣ Wait longer for page to load',
                '4️⃣ Skip this step'
            ];
            severity = isRepeatedFailure ? 'high' : 'medium';

        } else if (actionType === 'form_interaction') {
            question = `⌨️ **Form Input Failed on ${domain}**\n\nUnable to enter text${selectorInfo}.\n${error ? `Error: ${error}` : 'The field may require specific formatting or have validation rules.'}`;
            options = [
                '1️⃣ Clear the field and try again',
                '2️⃣ Try a different input format',
                '3️⃣ Look for a different input field',
                '4️⃣ Skip this field'
            ];
            severity = 'medium';

        } else if (actionType === 'navigation') {
            question = `🌐 **Navigation Issue on ${domain}**\n\nUnable to navigate to the target page.\n${error ? `Error: ${error}` : 'The URL may be incorrect or the site may be blocking access.'}`;
            options = [
                '1️⃣ Try a different URL',
                '2️⃣ Search for the page instead',
                '3️⃣ Refresh and try again',
                '4️⃣ Skip this navigation'
            ];
            severity = 'high';

        } else if (error && error.toLowerCase().includes('timeout')) {
            question = `⏱️ **Timeout on ${domain}**\n\nThe action took too long to complete.\n${actionReason}`;
            options = [
                '1️⃣ Wait longer and retry',
                '2️⃣ Refresh the page',
                '3️⃣ Try a different approach',
                '4️⃣ Skip this step'
            ];
            severity = 'medium';

        } else if (error && (error.toLowerCase().includes('captcha') || error.toLowerCase().includes('verify'))) {
            question = `🤖 **Human Verification Required on ${domain}**\n\nThe site is asking for CAPTCHA or human verification.`;
            options = [
                '1️⃣ Please complete the verification manually',
                '2️⃣ Try to proceed without verification',
                '3️⃣ Abort this task'
            ];
            severity = 'high';

        } else {
            question = `⚠️ **Action Failed on ${domain}**\n\n${error || 'An unexpected issue occurred.'}\n${actionReason}`;
            options = [
                '1️⃣ Retry the action',
                '2️⃣ Try a different approach',
                '3️⃣ Wait and try again',
                '4️⃣ Skip this step',
                '5️⃣ Provide specific guidance'
            ];
            severity = isRepeatedFailure ? 'high' : 'low';
        }

        return {
            question,
            options,
            severity,
            context: {
                action: action,
                actionType: actionType,
                recentFailures: this.contextManager.getRecentFailures(3),
                domain: domain,
                currentUrl: currentUrl,
                failureCount: failureCount
            }
        };
    }

    // Update strategy based on user feedback
    updateStrategyFromFeedback(action, userFeedback, success) {
        if (!this.contextManager?.currentDomain) return;
        if (!this.db) return;

        const domain = this.contextManager.currentDomain;
        const actionType = this.categorizeAction(action);

        try {
            // Extract what user corrected
            if (userFeedback.toLowerCase().includes('click') && userFeedback.toLowerCase().includes('instead')) {
                // User suggested a different element to click
                this.db.setPreference(domain, 'click_strategy', 'user_corrected', 0.95);
            }

            if (userFeedback.toLowerCase().includes('wait') || userFeedback.toLowerCase().includes('slow')) {
                // User wants slower execution
                this.db.setPreference(domain, 'timing', 'slower', 0.9);
            }

            if (userFeedback.toLowerCase().includes('scroll')) {
                // User wants scrolling
                this.db.setPreference(domain, 'scroll_first', 'true', 0.85);
            }

            // Record this as a high-confidence pattern
            const selectorPattern = this.extractSelectorPattern(action.selector);
            const contextKeywords = this.extractContextKeywords(userFeedback);

            this.db.recordPattern(
                actionType,
                domain,
                selectorPattern,
                contextKeywords,
                success ? 0.95 : 0.3
            );
        } catch (e) {
            console.warn(`[LearningEngine] Database error updating strategy:`, e.message);
        }
    }

    // Cross-domain learning - transfer knowledge from similar domains
    getCrossDomainTips(currentDomain) {
        if (!this.db || !this.db.db) return [];

        try {
            // Get patterns from similar domains
            const allPatterns = this.db.db.prepare(`
                SELECT * FROM patterns 
                WHERE success_rate > 0.8 
                ORDER BY use_count DESC 
                LIMIT 20
            `).all();

            // Group by pattern type
            const patternsByType = {};
            for (const pattern of allPatterns) {
                if (!patternsByType[pattern.pattern_type]) {
                    patternsByType[pattern.pattern_type] = [];
                }
                patternsByType[pattern.pattern_type].push(pattern);
            }

            // Return most universal patterns
            const tips = [];
            for (const [type, patterns] of Object.entries(patternsByType)) {
                if (patterns.length > 2) {
                    tips.push({
                        patternType: type,
                        commonStrategy: patterns[0].selector_pattern,
                        successRate: patterns[0].success_rate,
                        source: 'cross_domain_learning'
                    });
                }
            }

            return tips;
        } catch (e) {
            console.warn(`[LearningEngine] Database error getting cross-domain tips:`, e.message);
            return [];
        }
    }

    // Export learned data for backup/analysis
    exportLearnedData() {
        const domain = this.contextManager?.currentDomain;
        if (!this.db) {
            return {
                domain: domain,
                patterns: [],
                preferences: [],
                timestamp: new Date().toISOString(),
                effectiveness: { domain, totalPatterns: 0, averageSuccessRate: 0, totalUses: 0, effectiveness: 'learning' }
            };
        }

        try {
            return {
                domain: domain,
                patterns: this.db.getPatternsForDomain(domain),
                preferences: this.db.getAllPreferencesForDomain(domain),
                timestamp: new Date().toISOString(),
                effectiveness: this.analyzePatterns()
            };
        } catch (e) {
            console.warn(`[LearningEngine] Database error exporting data:`, e.message);
            return {
                domain: domain,
                patterns: [],
                preferences: [],
                timestamp: new Date().toISOString(),
                effectiveness: { domain, totalPatterns: 0, averageSuccessRate: 0, totalUses: 0, effectiveness: 'learning' }
            };
        }
    }
}

module.exports = LearningEngine;
