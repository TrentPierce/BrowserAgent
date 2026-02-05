/**
 * ============================================================================
 * ENHANCED AGENT - PRODUCTION CLASS
 * ============================================================================
 * 
 * This is the MAIN agent class used in production. It extends the base Agent
 * class (agent.js) to add intelligent features.
 * 
 * THIS FILE HANDLES:
 * ------------------
 * - Production LLM prompt (askGeminiEnhanced) - THE MAIN PROMPT
 * - Decoy detection & avoidance in prompts
 * - Popup handling priority
 * - Navigation regression prevention
 * - Code/secret discovery guidance
 * - Context & session tracking
 * - Loop/scroll detection
 * - Learning engine integration
 * - Retry logic with error recovery
 * - User interaction & chat
 * 
 * INHERITS FROM agent.js:
 * -----------------------
 * - DOM extraction (getSimplifiedDOM) - detects decoys, filler text, hidden codes
 * - Action execution (executeAction) - click, type, scroll, navigate
 * - Screenshot capture
 * - Basic logging
 * 
 * WHEN MAKING CHANGES:
 * --------------------
 * - LLM prompt improvements        → Edit askGeminiEnhanced() in THIS file
 * - Loop/stuck detection           → Edit loop() in THIS file
 * - Learning/context features      → Edit THIS file
 * - DOM extraction improvements    → Edit getSimplifiedDOM() in agent.js
 * - Action execution improvements  → Edit executeAction() in agent.js
 * 
 * ============================================================================
 */

const Agent = require('./agent');

class EnhancedAgent extends Agent {
    constructor(guestWebContents, uiWebContents, contextManager, learningEngine) {
        super(guestWebContents, uiWebContents);

        this.contextManager = contextManager;
        this.learningEngine = learningEngine;

        // Enhanced state
        this.currentSession = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isWaitingForUser = false;
        this.pendingQuestion = null;
        this.currentAction = null;
        this.lastInteractionId = null;

        // Performance tracking
        this.actionStartTime = 0;
        this.totalExecutionTime = 0;
    }

    sendStats() {
        if (!this.uiWebContents.isDestroyed()) {
            const duration = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
            const seconds = (duration % 60).toString().padStart(2, '0');

            // Get success rate from learning engine
            let successRate = 0;
            if (this.learningEngine && this.contextManager && this.contextManager.currentDomain) {
                const analysis = this.learningEngine.analyzePatterns();
                successRate = Math.round((analysis.averageSuccessRate || 0) * 100);
            }

            this.uiWebContents.send('agent-stats', {
                time: `${minutes}:${seconds}`,
                apiCalls: this.apiCalls,
                tokens: this.totalTokens,
                successRate: successRate
            });
        }
    }

    async start(goal) {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
            this.log("⚠️ Cannot start: API Key invalid. Please check .env file.");
            return;
        }

        // Start session tracking
        let currentUrl = 'about:blank';
        try {
            currentUrl = this.guestWebContents.getURL();
        } catch (e) {
            console.error('[EnhancedAgent] Failed to get URL:', e);
        }
        this.currentSession = this.contextManager.startSession(goal, currentUrl);

        this.log(`🚀 Session started: ${this.currentSession.uuid}`);
        this.log(`🎯 Goal: ${goal}`);
        this.log(`🌐 Domain: ${this.currentSession.domain || 'unknown'}`);

        // Add initial chat message
        this.addChatMessage('agent', `Starting task: ${goal}`);

        // Check for learned patterns on this domain
        const recommendations = this.learningEngine.getRecommendations();
        if (recommendations.length > 0) {
            this.log(`💡 Learned ${recommendations.length} recommendation(s) for this domain`);
        }

        // Start the base agent
        this.active = true;
        this.goal = goal;
        this.startTime = Date.now();
        this.apiCalls = 0;
        this.totalTokens = 0;
        this.retryCount = 0;

        this.loop();
    }

    stop() {
        const wasActive = this.active;

        if (this.currentSession) {
            const status = wasActive ? 'cancelled' : 'completed';
            this.contextManager.endSession(status);
            this.addChatMessage('agent', `Session ${status}`);
        }

        this.isWaitingForUser = false;
        this.pendingQuestion = null;
        this.active = false;

        // Call parent stop - it handles sending the signal
        super.stop();
    }

    async loop() {
        if (!this.active || this.isWaitingForUser) return;

        if (this.guestWebContents.isDestroyed()) {
            this.active = false;
            return;
        }

        try {
            // Check for loops with enhanced detection
            const loopInfo = this.contextManager.detectLoop(3);
            if (loopInfo) {
                if (loopInfo.type === 'scroll_loop') {
                    this.log(`⚠️ Scroll loop detected (${loopInfo.count} scrolls)! Trying alternative action.`);
                    // Instead of pausing, try a click action
                    this.handleStuckState('scroll_loop', 'Scrolled multiple times without finding target element');
                } else if (loopInfo.type === 'navigation_regression') {
                    this.log(`⚠️ Navigation regression to ${loopInfo.url}! Pausing.`);
                    this.handleStuckState('navigation_regression', `Keep navigating back to ${loopInfo.url}`);
                } else if (loopInfo.type === 'domain_loop') {
                    this.log(`⚠️ Domain loop detected (${loopInfo.domains.join(' ↔ ')})! Pausing.`);
                    this.handleStuckState('domain_loop', `Stuck iterating between ${loopInfo.domains.join(' and ')}`);
                } else if (loopInfo.type === 'alternating') {
                    this.log(`⚠️ Alternating loop detected (${loopInfo.actions.join(' ↔ ')})! Pausing.`);
                    this.handleStuckState('alternating_loop', `Stuck alternating between ${loopInfo.actions.join(' and ')}`);
                } else {
                    this.log(`⚠️ Loop detected (${loopInfo.type})! Pausing for user guidance.`);
                    this.handleStuckState('loop_detected');
                }
                return;
            }

            // Wait for page if loading
            if (this.guestWebContents.isLoading()) {
                this.log("Waiting for page load...");
                await this.waitForPageLoad();
            }

            this.log("📸 Capturing state...");
            this.actionStartTime = Date.now();

            // Capture state
            const simplifiedDOM = await this.getSimplifiedDOM();
            const screenshot = await this.guestWebContents.capturePage();
            const base64Image = screenshot.toJPEG(70).toString('base64');
            const currentUrl = this.guestWebContents.getURL();

            // Update context
            this.contextManager.recordNavigation(currentUrl);
            this.contextManager.saveDomState(simplifiedDOM);

            // ================================================================
            // POPUP PRE-CHECK: Auto-handle popups before consulting Gemini
            // Returns an array of actions to close ALL detected popups at once
            // ================================================================
            const popupActions = this.detectAndHandlePopups(simplifiedDOM);
            if (popupActions && popupActions.length > 0) {
                this.log(`🚨 ${popupActions.length} popup(s) detected! Auto-closing...`);

                // Execute ALL popup close actions in sequence (no API calls)
                for (const popupAction of popupActions) {
                    if (!this.active) return;

                    this.log(`  → Closing: ${popupAction.reason}`);
                    this.currentAction = popupAction;

                    const success = await this.executeWithRetry(popupAction);

                    if (success) {
                        this.contextManager.logAction(popupAction.action, {
                            selector: popupAction.selector,
                            autoHandled: true
                        }, true);

                        // Brief pause between popup closes
                        await this.sleep(500);
                    } else {
                        this.log(`  ⚠️ Failed to close: ${popupAction.selector}`);
                    }
                }

                // Wait for popups to fully close, then continue loop
                await this.sleep(800);
                if (this.active) this.loop();
                return;
            }
            // ================================================================

            // Get context for Gemini
            const context = this.contextManager.getCurrentContext();

            this.log("🧠 Thinking...");
            this.sendStats();

            // Get action plan from Gemini
            const actionPlan = await this.askGeminiEnhanced(this.goal, simplifiedDOM, base64Image, context);

            if (!this.active) return;

            this.currentAction = actionPlan;

            // Execute with retry logic
            await this.executeWithRetry(actionPlan, {
                domState: simplifiedDOM,
                screenshot: base64Image,
                url: currentUrl
            });

        } catch (error) {
            this.log(`❌ Error in loop: ${error.message}`);
            console.error(error);

            // Log error
            this.contextManager.logAction('error', { message: error.message }, {
                success: false,
                errorMessage: error.message
            });

            this.handleStuckState('error', error.message);
        }
    }

    async executeWithRetry(actionPlan, context = {}) {
        const executionTime = Date.now() - this.actionStartTime;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            this.retryCount = attempt;

            try {
                this.log(`👉 Attempt ${attempt}/${this.maxRetries}: ${actionPlan.action}`);

                // Apply learned strategies on retry
                let modifiedPlan = actionPlan;
                if (attempt > 1) {
                    modifiedPlan = this.learningEngine.applyLearnedStrategies(actionPlan, attempt);
                    if (modifiedPlan._learnedModification) {
                        this.log(`💡 Applying learned strategy: ${modifiedPlan._learnedModification}`);
                    }
                }

                // Execute action
                const startExec = Date.now();
                await this.executeAction(modifiedPlan);
                const execTime = Date.now() - startExec;

                // Wait a moment to check if action had intended effect
                await this.sleep(1000);

                // Log successful action
                this.lastInteractionId = this.contextManager.logAction(
                    modifiedPlan.action,
                    modifiedPlan,
                    {
                        domState: context?.domState,
                        geminiPrompt: this.lastPrompt,
                        geminiResponse: JSON.stringify(modifiedPlan),
                        success: true,
                        retryCount: attempt - 1,
                        executionTimeMs: execTime + executionTime
                    }
                );

                // Record success for learning
                await this.learningEngine.recordSuccess(modifiedPlan, {
                    domContext: context?.domState,
                    executionTime: execTime
                });

                // Add success message to chat
                this.addChatMessage('agent', `✓ ${modifiedPlan.action} completed successfully`);

                // Reset retry count on success
                this.retryCount = 0;

                // Continue loop if not done
                if (modifiedPlan.action !== 'done') {
                    await this.sleep(2000);
                    this.loop();
                } else {
                    this.log("🎉 Goal achieved!");
                    this.addChatMessage('agent', '🎉 Task completed successfully!');
                    // Mark as completed and stop
                    this.active = false;
                    // Don't call this.stop() here - it will be called by the parent
                    // Just send the stopped signal once
                    if (!this.uiWebContents.isDestroyed()) {
                        this.uiWebContents.send('agent-stopped');
                    }
                }

                return;

            } catch (error) {
                this.log(`❌ Attempt ${attempt} failed: ${error.message}`);

                // Record failure
                await this.learningEngine.recordFailure(actionPlan, error, attempt);

                // Log attempt
                this.contextManager.logAction(
                    actionPlan.action,
                    actionPlan,
                    {
                        domState: context?.domState,
                        success: false,
                        errorMessage: error.message,
                        retryCount: attempt
                    }
                );

                if (attempt < this.maxRetries) {
                    // Wait before retry with increasing delay
                    const delay = attempt * 2000;
                    this.log(`⏳ Waiting ${delay / 1000}s before retry...`);
                    await this.sleep(delay);
                } else {
                    // All retries exhausted - ask user
                    this.handleStuckState('max_retries', error.message, actionPlan);
                }
            }
        }
    }

    /**
     * Detects ALL popups/modals in the DOM and returns actions to close them.
     * This runs BEFORE consulting Gemini to ensure popups are handled immediately.
     * Returns an array so multiple popups can be closed in one pass (batch operation).
     * 
     * AGGRESSIVE MODE: Looks for close buttons even without explicit popup flags.
     * 
     * @param {string} dom - The simplified DOM string
     * @returns {Array} - Array of action plans to close all detected popups
     */
    detectAndHandlePopups(dom) {
        // Check for popup indicators in DOM (flags from getSimplifiedDOM)
        const hasPopupFlag = dom.includes('[IN-POPUP]');
        const hasCookieBanner = dom.includes('[COOKIE-BANNER]');
        const hasNewsletter = dom.includes('[NEWSLETTER]');

        // ALSO check for common popup keywords in the DOM text
        const domLower = dom.toLowerCase();
        const hasPopupKeywords = (
            domLower.includes('cookie') ||
            domLower.includes('consent') ||
            domLower.includes('privacy') ||
            domLower.includes('newsletter') ||
            domLower.includes('subscribe') ||
            domLower.includes('modal') ||
            domLower.includes('popup') ||
            domLower.includes('overlay') ||
            domLower.includes('accept all') ||
            domLower.includes('dismiss') ||
            domLower.includes('got it') ||
            domLower.includes('no thanks')
        );

        const hasAnyPopupIndicator = hasPopupFlag || hasCookieBanner || hasNewsletter || hasPopupKeywords;

        if (!hasAnyPopupIndicator) {
            return []; // No popup indicators at all
        }

        this.log(`[PopupCheck] Flags: popup=${hasPopupFlag}, cookie=${hasCookieBanner}, newsletter=${hasNewsletter}, keywords=${hasPopupKeywords}`);

        // Parse DOM to find safe close buttons
        // Match elements with their IDs and text content
        const elementRegex = /<(\w+)[^>]*id="(\d+)"[^>]*>([^<]*)<\/\w+>/gi;
        const elements = [];
        let match;

        while ((match = elementRegex.exec(dom)) !== null) {
            elements.push({
                tag: match[1],
                id: match[2],
                text: match[3].trim(),
                fullMatch: match[0]
            });
        }

        // Priority list of safe close button patterns (NOT decoys)
        const safeClosePatterns = [
            // Cookie banners - prefer accept buttons
            { pattern: /^accept(\s+all)?$/i, priority: 1, type: 'cookie' },
            { pattern: /^(i\s+)?accept$/i, priority: 1, type: 'cookie' },
            { pattern: /^(got\s+it|okay?|ok)$/i, priority: 2, type: 'cookie' },
            { pattern: /^agree(\s+&\s+continue)?$/i, priority: 2, type: 'cookie' },
            { pattern: /^allow(\s+all)?(\s+cookies)?$/i, priority: 2, type: 'cookie' },

            // Newsletter/modals - prefer dismiss buttons
            { pattern: /^(no,?\s*)?(thanks|thank you)$/i, priority: 1, type: 'newsletter' },
            { pattern: /^(maybe\s+)?later$/i, priority: 1, type: 'newsletter' },
            { pattern: /^not\s+now$/i, priority: 1, type: 'newsletter' },
            { pattern: /^skip$/i, priority: 2, type: 'newsletter' },

            // Generic close buttons
            { pattern: /^(close|dismiss|cancel)$/i, priority: 3, type: 'generic' },
            { pattern: /^[×✕✖xX]$/i, priority: 3, type: 'generic' },
        ];

        // Find ALL matching close buttons (NOT marked as decoy)
        // Collect all matches, will deduplicate by keeping best priority
        const allMatches = []; // { priority, action }

        for (const el of elements) {
            // Skip elements marked as decoys or suspicious
            if (el.fullMatch.includes('[DECOY]') || el.fullMatch.includes('[SUSPICIOUS')) {
                this.log(`[PopupCheck] Skipping decoy: id=${el.id} "${el.text}"`);
                continue;
            }

            // Skip disabled elements
            if (el.fullMatch.includes('[DISABLED]')) {
                continue;
            }

            // Determine which popup type this element belongs to
            let elementPopupType = null;
            if (el.fullMatch.includes('[COOKIE-BANNER]')) {
                elementPopupType = 'cookie';
            } else if (el.fullMatch.includes('[NEWSLETTER]')) {
                elementPopupType = 'newsletter';
            } else if (el.fullMatch.includes('[IN-POPUP]')) {
                elementPopupType = 'popup';
            }

            for (const closePattern of safeClosePatterns) {
                if (closePattern.pattern.test(el.text)) {
                    // Calculate effective priority (lower is better)
                    let effectivePriority = closePattern.priority;

                    // Boost priority if element is actually in a popup
                    if (elementPopupType) {
                        effectivePriority -= 0.5;
                    }

                    // Prefer buttons over other elements
                    if (el.tag.toLowerCase() === 'button') {
                        effectivePriority -= 0.3;
                    }

                    // Use element's popup type, or pattern's type as fallback
                    const actionType = elementPopupType || closePattern.type;

                    this.log(`[PopupCheck] Found close button: id=${el.id} "${el.text}" type=${actionType} priority=${effectivePriority.toFixed(1)}`);

                    allMatches.push({
                        priority: effectivePriority,
                        elementId: el.id,
                        action: {
                            action: 'click',
                            selector: `[data-agent-id='${el.id}']`,
                            reason: `Closing ${actionType}: '${el.text}'`,
                            autoHandled: true,
                            popupType: actionType
                        }
                    });
                    break; // Move to next element once a pattern matches
                }
            }
        }

        if (allMatches.length === 0) {
            this.log(`[PopupCheck] No matching close buttons found`);
            return [];
        }

        // Sort by priority and return all actions (limit to 5 to prevent infinite loops)
        const sortedActions = allMatches
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 5)
            .map(item => item.action);

        this.log(`[PopupCheck] Returning ${sortedActions.length} popup close actions`);
        return sortedActions;
    }

    async askGeminiEnhanced(goal, dom, base64Image, context) {
        this.apiCalls++;
        this.sendStats();

        // Build compact context summary
        let contextStr = '';
        let historyStr = '';

        if (context.recentActions && context.recentActions.length > 0) {
            const actionSummary = context.recentActions.slice(-5).map((a, idx) => {
                const status = a.success === true ? '✓' : a.success === false ? '✗' : '?';
                let detail = '';
                if (a.details) {
                    if (a.details.selector) detail = ` ${a.details.selector}`;
                    else if (a.details.url) detail = ` ${a.details.url}`;
                }
                return `${status}${a.type}${detail}`;
            }).join(', ');
            historyStr = `\nRecent Actions: ${actionSummary}`;
        }

        // Add learned recommendations (limit to 2)
        const recommendations = this.learningEngine.getRecommendations().slice(0, 2);
        if (recommendations.length > 0) {
            contextStr = '\nLearned Tips: ' + recommendations.map(r => r.message).join('; ');
        }

        // Add scroll count warning
        const scrollCount = this.contextManager.getConsecutiveScrollCount();
        if (scrollCount >= 2) {
            contextStr += `\n⚠️ WARNING: Scrolled ${scrollCount}x in a row. Try clicking an element instead of scrolling again.`;
        }

        // Extract element count and detect special flags
        const elementCount = (dom.match(/data-agent-id/g) || []).length;
        const hasDecoys = dom.includes('[DECOY]') || dom.includes('[SUSPICIOUS');
        const hasPopups = dom.includes('[IN-POPUP]') || dom.includes('[COOKIE-BANNER]') || dom.includes('[NEWSLETTER]');
        const hasCodes = dom.includes('=== DETECTED CODES/SECRETS ===');

        // Detect if we're on a step-based challenge
        const stepMatch = context.currentUrl?.match(/step(\d+)/i);
        const currentStep = stepMatch ? stepMatch[1] : null;

        // Enterprise-grade prompt with decoy detection and popup handling
        this.lastPrompt = `You are a precise browser automation agent specializing in navigating complex pages with popups, decoys, and multi-step challenges.

## GOAL
"${goal}"

## CURRENT STATE
- URL: ${context.currentUrl || 'unknown'}
- Elements: ${elementCount}${currentStep ? ` | Step: ${currentStep}` : ''}${hasPopups ? ' | ⚠️ POPUPS DETECTED' : ''}${hasDecoys ? ' | ⚠️ DECOYS DETECTED' : ''}${hasCodes ? ' | 🔑 CODES FOUND' : ''}${historyStr}${contextStr}

## AVAILABLE ELEMENTS (DOM)
Elements are tagged with metadata flags. PAY ATTENTION TO THESE FLAGS:
- \`[DECOY]\` = FAKE button that won't work - DO NOT CLICK
- \`[SUSPICIOUS-TEXT]\` = Scam/spam content - AVOID
- \`[IN-POPUP]\` = Inside a popup/modal overlay
- \`[COOKIE-BANNER]\` = Cookie consent element
- \`[NEWSLETTER]\` = Newsletter/subscription popup
- \`[DISABLED]\` = Element is disabled - cannot interact

\`\`\`
${dom}
\`\`\`

## CRITICAL RULES

### 1. DECOY DETECTION (HIGHEST PRIORITY)
- NEVER click elements marked \`[DECOY]\` or \`[SUSPICIOUS-*]\`
- If a button says "Close" but is marked \`[DECOY]\`, find the REAL close button
- Look for alternative dismiss options: "Dismiss", "No thanks", "Maybe later", "X", "✕"
- Decoys often have siblings that are the real buttons - check nearby elements

### 2. POPUP HANDLING PRIORITY
**Order of operations when popups exist:**
1. Look for LEGITIMATE close buttons (NOT marked as decoy)
2. Check for "Accept", "Dismiss", "No thanks", "Continue" buttons
3. Click outside overlay if possible (but this may not work)
4. Scroll within popup if content is hidden
5. If truly stuck, use "ask" action

**Safe popup dismissal options (prefer these):**
- Cookie banners: "Accept", "Accept All", "OK", "Got it"
- Newsletters: "No thanks", "Maybe later", "Close", "X"
- Alerts: "Dismiss", "Close", "OK", "Continue"

### 3. NAVIGATION RULES
- ❌ NEVER navigate back to the start URL if you're already making progress (e.g., on /step1, /step2)
- ❌ NEVER re-navigate to the same domain you're already on
- ✅ Only use "navigate" when going to a completely NEW site
- Check the URL before navigating - if it contains the target domain, you're already there

### 4. CODE/SECRET DISCOVERY
- If "DETECTED CODES/SECRETS" section exists, USE those codes for any input fields
- Codes marked \`[HIDDEN]\` or \`[COMMENT]\` are intentionally hidden - use them!
- Don't guess codes from URLs - use codes found in the DOM

### 5. PROGRESS TRACKING (for step-based challenges)
- Note which step you're on (Step 1, Step 2, etc.)
- Complete each step fully before moving to the next
- If stuck on a step, scroll to find hidden navigation buttons
- After 3+ scrolls without progress, try clicking visible navigation elements

### 6. ACTION REFERENCE
| Action | Use Case | Required Fields |
|--------|----------|----------------|
| navigate | Go to NEW site only | url, reason |
| click | Click element (must exist, NOT decoy) | selector, reason |
| type | Enter text (use detected codes!) | selector, text, reason |
| scroll | Reveal hidden content | reason |
| wait | Page loading | reason |
| done | Goal FULLY complete | reason |
| ask | Need user help | question, reason |

### 7. SELECTOR FORMAT
Always: \`[data-agent-id='X']\` where X is the exact ID from DOM.

## FAILURE MODES TO AVOID
❌ Clicking \`[DECOY]\` or \`[SUSPICIOUS-*]\` elements
❌ Navigating when already on the correct domain
❌ Guessing codes instead of using detected codes
❌ Clicking the same failed element repeatedly
❌ Scrolling infinitely without trying clicks
❌ Marking "done" before goal is verifiably complete

## OUTPUT FORMAT
JSON only. No markdown, no explanation.
{"action": "<action>", "selector": "[data-agent-id='X']", "text": "<if typing>", "url": "<if navigating>", "question": "<if asking>", "reason": "<why>"}

## EXAMPLES

✓ Dismiss popup (safe button, not decoy):
{"action": "click", "selector": "[data-agent-id='47']", "reason": "Clicking 'Accept' to dismiss cookie banner - not marked as decoy"}

✓ Avoid decoy, use real button:
{"action": "click", "selector": "[data-agent-id='52']", "reason": "Clicking real 'Continue' button - id='51' is marked [DECOY]"}

✓ Use discovered code:
{"action": "type", "selector": "[data-agent-id='34']", "text": "SECRETCODE123", "reason": "Using code from DETECTED CODES section"}

✓ Already on site - don't re-navigate:
{"action": "scroll", "reason": "Already on target site, scrolling to find next step button"}

## YOUR RESPONSE (JSON only):`;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
            },
        };

        try {
            const result = await this.model.generateContent([this.lastPrompt, imagePart]);
            const response = await result.response;

            // Track usage
            if (response.usageMetadata) {
                this.totalTokens += (response.usageMetadata.totalTokenCount || 0);
                this.sendStats();
            }

            let text = response.text();
            console.log('[EnhancedAgent] Raw response:', text.substring(0, 150));

            // Clean up response - extract JSON if wrapped in markdown
            text = text.trim();
            if (text.startsWith('```json')) text = text.slice(7);
            else if (text.startsWith('```')) text = text.slice(3);
            if (text.endsWith('```')) text = text.slice(0, -3);
            text = text.trim();

            // Try to find JSON object in response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                text = jsonMatch[0];
            }

            // Try JSON parse first
            try {
                const parsed = JSON.parse(text);
                this.log(`🤖 Plan: ${JSON.stringify(parsed)}`);
                return parsed;
            } catch (jsonError) {
                // Fallback: Parse natural language response
                this.log('⚠️ JSON parse failed, trying fallback. Text: ' + text.substring(0, 80));
                const cleanText = text.replace(/^["']|["']$/g, '').trim();

                // Check for navigate command
                const navigateMatch = cleanText.match(/(?:navigate|go)(?:\s+to)?\s+["']?(https?:\/\/[^\s"']+)["']?/i);
                if (navigateMatch) {
                    this.log('✅ Navigate: ' + navigateMatch[1]);
                    return { action: "navigate", url: navigateMatch[1], reason: "Parsed from text" };
                }

                // Check for ANY URL in text
                const urlMatch = text.match(/(https?:\/\/[^\s"'<>]+)/i);
                if (urlMatch) {
                    this.log('✅ URL found: ' + urlMatch[1]);
                    return { action: "navigate", url: urlMatch[1], reason: "URL extracted" };
                }

                // Check for click command
                const clickMatch = cleanText.match(/click\s+(?:on\s+)?(?:element\s+)?(?:id\s+)?(?:\[?data-agent-id=['"]?)?(\d+)/i);
                if (clickMatch) {
                    this.log('✅ Click: element ' + clickMatch[1]);
                    return { action: "click", selector: `[data-agent-id='${clickMatch[1]}']`, reason: "Parsed from text" };
                }

                // Check for type command
                const typeMatch = cleanText.match(/type\s+["']?([^"']+?)["']?\s*(?:in(?:to)?|on)?\s*(?:element\s*)?(?:\[?data-agent-id=['"]?)?(\d+)?/i);
                if (typeMatch && typeMatch[1]) {
                    const textToType = typeMatch[1].trim();
                    const elementId = typeMatch[2] || '1';
                    this.log('✅ Type: "' + textToType + '" into ' + elementId);
                    return { action: "type", text: textToType, selector: `[data-agent-id='${elementId}']`, reason: "Parsed from text" };
                }

                // Check for scroll
                if (/scroll\s*down/i.test(cleanText)) {
                    return { action: "scroll", reason: "Parsed from text" };
                }

                // Check for done
                if (/done|goal achieved|finished/i.test(cleanText)) {
                    return { action: "done", reason: "Parsed from text" };
                }

                // Check for ask command (model wants to ask user something)
                const askMatch = cleanText.match(/ask\s+["']?(.+?)["']?$/i);
                if (askMatch) {
                    this.log('✅ Ask: ' + askMatch[1].substring(0, 50));
                    return { action: "ask", question: askMatch[1], reason: "Model needs clarification" };
                }

                this.log("❌ All parsing failed: " + jsonError.message);
                return { action: "wait", reason: "Parse error: " + text.substring(0, 40) };
            }
        } catch (e) {
            this.log("Failed to call Gemini API: " + e.message);
            return { action: "wait", reason: "API error" };
        }
    }

    handleStuckState(reason, errorMessage = null, lastAction = null) {
        this.isWaitingForUser = true;

        // Generate clarifying question
        const question = this.learningEngine.generateClarifyingQuestion(
            lastAction || this.currentAction,
            errorMessage,
            this.contextManager.getCurrentContext()
        );

        this.pendingQuestion = {
            reason: reason,
            question: question.question,
            options: question.options,
            context: question.context
        };

        // Log challenge
        this.contextManager.recordChallenge(
            reason,
            errorMessage || question.question,
            question.options
        );

        // Send to UI
        this.uiWebContents.send('agent-question', this.pendingQuestion);

        // Add to chat
        this.addChatMessage('agent', `❓ ${question.question}`);
        question.options.forEach((option, idx) => {
            this.addChatMessage('agent', `   ${idx + 1}. ${option}`, 'option');
        });

        this.log(`❓ Asking user: ${question.question}`);
    }

    async handleUserResponse(response) {
        this.log(`👤 User responded: ${response}`);

        if (!this.pendingQuestion) {
            // Handle general user message
            this.addChatMessage('user', response);
            this.handleGeneralUserInput(response);
            return;
        }

        // Handle question response
        this.addChatMessage('user', response);
        this.isWaitingForUser = false;

        // Update learning engine with user feedback
        if (this.currentAction) {
            this.learningEngine.updateStrategyFromFeedback(
                this.currentAction,
                response,
                true // Assume success with user guidance
            );
        }

        // Parse user response
        const responseLower = response.toLowerCase();

        if (responseLower.includes('skip') || responseLower.includes('1')) {
            // Skip current action
            this.log("⏭️ Skipping current action");
            this.addChatMessage('agent', "⏭️ Skipping this step and continuing...");
            this.pendingQuestion = null;
            this.loop();

        } else if (responseLower.includes('different') || responseLower.includes('try') || responseLower.includes('2')) {
            // Try different approach
            this.log("🔄 Trying different approach");
            this.addChatMessage('agent', "🔄 I'll try a different approach...");
            this.pendingQuestion = null;
            this.retryCount = 0; // Reset retry count
            this.loop();

        } else if (responseLower.includes('scroll') || responseLower.includes('3')) {
            // Scroll first
            this.log("📜 Scrolling as requested");
            this.addChatMessage('agent', "📜 Scrolling down first...");
            await this.executeAction({ action: 'scroll' });
            this.pendingQuestion = null;
            this.loop();

        } else if (responseLower.includes('back') || responseLower.includes('start') || responseLower.includes('4')) {
            // User wants to go back or restart
            this.log("🔄 User requested to go back/start over");
            this.addChatMessage('agent', "🔄 Going back to try again...");
            await this.guestWebContents.executeJavaScript('history.back()');
            await this.sleep(2000);
            this.pendingQuestion = null;
            this.loop();

        } else {
            // Treat as specific guidance
            this.log(`💡 Using user guidance: ${response}`);
            this.addChatMessage('agent', `💡 Thanks for the guidance! I'll use that information.`);

            // Store user preference
            if (this.contextManager.currentDomain) {
                this.contextManager.db.setPreference(
                    this.contextManager.currentDomain,
                    'user_guidance',
                    response,
                    0.9
                );
            }

            this.pendingQuestion = null;
            this.loop();
        }
    }

    async handleGeneralUserInput(input) {
        // Handle user input when not in a question state
        this.log(`💬 User message: ${input}`);

        // Check if user is giving instructions
        if (input.toLowerCase().includes('click') ||
            input.toLowerCase().includes('type') ||
            input.toLowerCase().includes('go to')) {

            this.addChatMessage('agent', "👍 I'll follow your instructions!");
            // Parse simple commands could be added here
            this.isWaitingForUser = false;
            this.loop();
        } else {
            this.addChatMessage('agent', "👍 I've noted that. Let me continue with the task.");
            this.isWaitingForUser = false;
            this.loop();
        }
    }

    addChatMessage(sender, message, type = 'text') {
        if (this.contextManager && this.contextManager.currentSession) {
            this.contextManager.addChatMessage(sender, message, type);
        }

        // Send to UI
        if (!this.uiWebContents.isDestroyed()) {
            this.uiWebContents.send('chat-message', {
                sender: sender,
                message: message,
                type: type,
                timestamp: new Date().toISOString()
            });
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Override executeAction to add error handling
    async executeAction(plan) {
        try {
            await super.executeAction(plan);
        } catch (error) {
            // Enhanced error handling
            if (error.message && error.message.includes('element not found')) {
                throw new Error(`Element not found: ${plan.selector}. The page may have changed.`);
            } else if (error.message && error.message.includes('timeout')) {
                throw new Error(`Timeout: The action took too long. The page might be slow.`);
            } else {
                throw error;
            }
        }
    }

    // Get session stats for display
    getSessionStats() {
        if (!this.currentSession || !this.contextManager || !this.contextManager.currentSession) {
            return null;
        }

        const stats = this.contextManager.getSessionStats(this.contextManager.currentSession.id);
        const progress = this.contextManager.getProgress();
        const learning = this.learningEngine.analyzePatterns();

        return {
            ...stats,
            ...progress,
            learning: learning,
            currentUrl: this.contextManager.urlHistory[this.contextManager.urlHistory.length - 1]
        };
    }

    // Search chat history
    searchChatHistory(query) {
        return this.contextManager.searchChatHistory(query);
    }

    // Get all chat messages
    getChatHistory() {
        return this.contextManager.getChatHistory();
    }
}

module.exports = EnhancedAgent;
