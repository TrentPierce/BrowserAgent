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

        // Build compact context summary (not full history)
        let contextStr = '';
        if (context.recentActions && context.recentActions.length > 0) {
            const actionSummary = context.recentActions.slice(-5).map((a, idx) => {
                const status = a.success === true ? '✓' : a.success === false ? '✗' : '?';
                return `${status}${a.type}`;
            }).join(', ');
            contextStr = `\nRecent: ${actionSummary}`;
        }

        // Add learned recommendations (limit to 2)
        const recommendations = this.learningEngine.getRecommendations().slice(0, 2);
        if (recommendations.length > 0) {
            contextStr += '\nTips: ' + recommendations.map(r => r.message).join('; ');
        }

        // Compact prompt format
        this.lastPrompt = `You are a browser automation agent.

Goal: "${goal}"
URL: ${context.currentUrl || 'unknown'}
${contextStr}

Elements (id=data-agent-id):
${dom}

Rules:
1. For sites like "reddit", use "navigate" directly to https://www.reddit.com
2. For "click", selector must be: [data-agent-id='ID']
3. For "ask", include a question for the user
4. If stuck, use "scroll" or "ask"

Choose ONE action to achieve the goal.`;

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
