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
        if (this.currentSession) {
            const status = this.active ? 'cancelled' : 'completed';
            this.contextManager.endSession(status);
            this.addChatMessage('agent', `Session ${status}`);
        }

        this.isWaitingForUser = false;
        this.pendingQuestion = null;
        super.stop();
    }

    async loop() {
        if (!this.active || this.isWaitingForUser) return;

        if (this.guestWebContents.isDestroyed()) {
            this.active = false;
            return;
        }

        try {
            // Check for loops
            if (this.contextManager.detectLoop(3)) {
                this.log("⚠️ Loop detected! Pausing for user guidance.");
                this.handleStuckState('loop_detected');
                return;
            }

            // Wait for page if loading
            if (this.guestWebContents.isLoading()) {
                this.log("Waiting for page load...");
                await this.sleep(2000);
            }

            this.log("📸 Capturing state...");
            this.actionStartTime = Date.now();

            // Capture state
            const simplifiedDOM = await this.getSimplifiedDOM();
            const screenshot = await this.guestWebContents.capturePage();
            const base64Image = screenshot.toJPEG(80).toString('base64');
            const currentUrl = this.guestWebContents.getURL();

            // Update context
            this.contextManager.recordNavigation(currentUrl);
            this.contextManager.saveDomState(simplifiedDOM);

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

    async executeWithRetry(actionPlan, context) {
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
                        domState: context.domState,
                        geminiPrompt: this.lastPrompt,
                        geminiResponse: JSON.stringify(modifiedPlan),
                        success: true,
                        retryCount: attempt - 1,
                        executionTimeMs: execTime + executionTime
                    }
                );

                // Record success for learning
                await this.learningEngine.recordSuccess(modifiedPlan, {
                    domContext: context.domState,
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
                    this.stop();
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
                        domState: context.domState,
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

    async askGeminiEnhanced(goal, dom, base64Image, context) {
        this.apiCalls++;
        this.sendStats();

        // Build enhanced prompt with context
        let contextStr = '';
        if (context.recentActions && context.recentActions.length > 0) {
            contextStr = '\nRecent actions taken:\n';
            context.recentActions.forEach((action, idx) => {
                const status = action.success === true ? '✓' : action.success === false ? '✗' : '?';
                contextStr += `${idx + 1}. ${status} ${action.type}\n`;
            });
        }

        // Add learned recommendations
        const recommendations = this.learningEngine.getRecommendations();
        if (recommendations.length > 0) {
            contextStr += '\nLearned insights for this site:\n';
            recommendations.forEach(rec => {
                contextStr += `- ${rec.message}\n`;
            });
        }

        // Add progress info
        const progress = this.contextManager.getProgress();
        if (progress) {
            contextStr += `\nProgress: ${progress.successfulActions}/${progress.totalActions} actions successful\n`;
        }

        this.lastPrompt = `
You are an intelligent browser automation agent.
User Goal: "${goal}"

Current URL: ${context.currentUrl || 'unknown'}
Domain: ${context.domain || 'unknown'}

Here is the simplified HTML of interactive elements on the screen:
${dom}

${contextStr}

Analyze the screenshot and the HTML.
Decide the single next best action to achieve the goal.

Supported actions:
- "click": Click an element. Requires "selector".
- "type": Type text into an input. Requires "selector" and "text".
- "scroll": Scroll down or up.
- "navigate": Go to a URL. Requires "url".
- "done": Goal is achieved.
- "wait": Wait for page to load or update.
- "ask": Ask user for clarification (use when uncertain).

Return ONLY a JSON object. No markdown formatting.
Schema:
{
    "action": "click" | "type" | "scroll" | "done" | "navigate" | "wait" | "ask",
    "selector": "[data-agent-id='...']",
    "text": "text to type if typing",
    "url": "full url if navigating",
    "question": "question to ask user if action is 'ask'",
    "reason": "short explanation of why this action helps achieve the goal"
}
`;

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

            const text = response.text();
            const cleanJSON = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

            this.log(`🤖 Plan: ${cleanJSON}`);
            return JSON.parse(cleanJSON);
        } catch (e) {
            this.log("Failed to parse Gemini JSON: " + e.message);
            return { action: "wait", reason: "JSON parse error, waiting for stability" };
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
