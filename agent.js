const { GoogleGenerativeAI } = require("@google/generative-ai");
console.log('[Agent] *** AGENT.JS VERSION 2.0 LOADED ***');

// JSON Schema for structured output (using plain strings for compatibility)
const ACTION_SCHEMA = {
    type: "object",
    properties: {
        action: {
            type: "string",
            enum: ["click", "type", "scroll", "done", "navigate", "wait", "ask"],
            description: "The action to perform"
        },
        selector: {
            type: "string",
            description: "Element selector using data-agent-id format"
        },
        text: {
            type: "string",
            description: "Text to type if action is 'type'"
        },
        url: {
            type: "string",
            description: "URL to navigate to if action is 'navigate'"
        },
        question: {
            type: "string",
            description: "Question to ask user if action is 'ask'"
        },
        reason: {
            type: "string",
            description: "Short explanation of why this action helps achieve the goal"
        }
    },
    required: ["action", "reason"]
};

class Agent {
    constructor(guestWebContents, uiWebContents) {
        this.guestWebContents = guestWebContents;
        this.uiWebContents = uiWebContents;
        this.active = false;
        this.goal = "";

        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
            this.log("⚠️ ERROR: Invalid or missing GEMINI_API_KEY in .env file.");
            this.active = false;
        }

        // Initialize Gemini with current model
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        this.model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash"
        });

        this.startTime = 0;
        this.apiCalls = 0;
        this.totalTokens = 0;
        this.agentIdCounter = 0;
    }

    log(message) {
        // Log to terminal
        console.log(`[Agent] ${message}`);
        // Log to UI Window
        if (!this.uiWebContents.isDestroyed()) {
            this.uiWebContents.send('agent-log', message);
        }
    }

    sendStats() {
        if (!this.uiWebContents.isDestroyed()) {
            const duration = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
            const seconds = (duration % 60).toString().padStart(2, '0');

            this.uiWebContents.send('agent-stats', {
                time: `${minutes}:${seconds}`,
                apiCalls: this.apiCalls,
                tokens: this.totalTokens
            });
        }
    }

    async start(goal) {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
            this.log("⚠️ Cannot start: API Key invalid. Please check .env file.");
            return;
        }
        this.active = true;
        this.goal = goal;
        this.startTime = Date.now();
        this.apiCalls = 0;
        this.totalTokens = 0;

        this.log(`Received goal: ${goal}`);
        this.loop();
    }

    stop() {
        this.active = false;
        this.log("Stopping agent Loop.");
        if (!this.uiWebContents.isDestroyed()) {
            this.uiWebContents.send('agent-stopped');
        }
    }

    async loop() {
        if (!this.active) return;

        // Safety check
        if (this.guestWebContents.isDestroyed()) {
            this.active = false;
            return;
        }

        try {
            // Wait for page to be ready
            if (this.guestWebContents.isLoading()) {
                this.log("Waiting for page load...");
                await this.waitForPageLoad();
            }

            this.log("📸 Capturing state...");

            // Capture State (DOM + Screenshot) used from the Guest
            const simplifiedDOM = await this.getSimplifiedDOM();
            const screenshot = await this.guestWebContents.capturePage();
            const base64Image = screenshot.toJPEG(70).toString('base64'); // Reduced quality to save tokens

            // Think (Gemini)
            this.log("🧠 Thinking...");
            this.sendStats();
            const actionPlan = await this.askGemini(this.goal, simplifiedDOM, base64Image);

            if (!this.active) return;

            // Act
            await this.executeAction(actionPlan);
            this.sendStats();

            // Wait/Loop
            if (actionPlan.action !== 'done') {
                await new Promise(r => setTimeout(r, 3000));
                this.loop();
            } else {
                this.log("🎉 Goal achieved (according to agent).");
                this.stop();
            }

        } catch (error) {
            this.log(`❌ Error in loop: ${error.message}`);
            console.error(error);
            this.stop();
        }
    }

    async waitForPageLoad() {
        try {
            await this.guestWebContents.executeJavaScript(`
                new Promise((resolve) => {
                    if (document.readyState === 'complete') {
                        resolve();
                    } else {
                        window.addEventListener('load', resolve, { once: true });
                        setTimeout(resolve, 5000); // Timeout after 5s
                    }
                });
            `);
        } catch (e) {
            // Fallback to simple wait
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    async getSimplifiedDOM() {
        // Script to tag elements and extract minimal info with token optimization
        const counterStart = this.agentIdCounter;
        const script = `
        (function() {
            const MAX_ELEMENTS = 30; // Limit DOM size for token efficiency
            const elements = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="option"], [onclick], label, h1, h2, h3, h4, .modal, .popup, [aria-label*="close" i], [class*="close" i]');
            const lines = [];
            const seenText = new Set();
            let counter = ${counterStart};
            
            for (const el of elements) {
                if (lines.length >= MAX_ELEMENTS) break;
                
                // Determine visibility
                const rect = el.getBoundingClientRect();
                if (rect.width < 5 || rect.height < 5) continue;
                if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
                
                // Skip if fully obscured
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') continue;

                // Get text context
                let text = el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.placeholder || "";
                text = text.replace(/\\s+/g, ' ').trim().substring(0, 60);
                
                // Skip duplicate text to reduce tokens
                if (text && seenText.has(text.toLowerCase())) continue;
                if (text) seenText.add(text.toLowerCase());

                // Assign incremental ID (more reliable than random)
                if (!el.hasAttribute('data-agent-id')) {
                    el.setAttribute('data-agent-id', (++counter).toString());
                }
                const agentId = el.getAttribute('data-agent-id');
                
                const tag = el.tagName.toLowerCase();
                const type = el.type ? \`type="\${el.type}"\` : "";
                const role = el.getAttribute('role') ? \`role="\${el.getAttribute('role')}"\` : "";
                const checked = el.checked ? 'CHECKED' : '';
                
                // Compact format to reduce tokens
                if (text || tag === 'input' || tag === 'select' || tag === 'textarea' || role) {
                    lines.push(\`<\${tag} \${type} \${role} \${checked} id="\${agentId}">\${text}</\${tag}>\`);
                }
            }
            
            window._agentIdCounter = counter;
            return lines.join('\\n');
        })();
        `;

        const result = await this.guestWebContents.executeJavaScript(script);

        // Update counter for next call
        try {
            this.agentIdCounter = await this.guestWebContents.executeJavaScript('window._agentIdCounter || 0');
        } catch (e) {
            this.agentIdCounter += 30;
        }

        return result;
    }

    async askGemini(goal, dom, base64Image) {
        this.apiCalls++;
        this.sendStats();

        // Prompt with strict JSON output requirement
        const prompt = `You are a browser automation agent. Analyze the screenshot and HTML to decide the next action.

Goal: "${goal}"

Interactive elements (use id as data-agent-id selector):
${dom}

RULES:
1. For websites like "reddit", "amazon" - use "navigate" action with full URL (https://www.reddit.com)
2. For "click" - use selector: [data-agent-id='ID'] where ID is from the HTML above
3. For "type" - provide both selector and text
4. If element not found, use "scroll" or "wait"

ACTIONS: navigate, click, type, scroll, wait, done, ask

YOU MUST RESPOND WITH ONLY A VALID JSON OBJECT. No explanation, no markdown, no text before or after.

JSON Schema:
{"action": "click|type|scroll|done|navigate|wait|ask", "selector": "[data-agent-id='X']", "text": "text if typing", "url": "url if navigating", "reason": "brief explanation"}

Example responses:
{"action": "navigate", "url": "https://www.reddit.com", "reason": "Going to Reddit as requested"}
{"action": "click", "selector": "[data-agent-id='5']", "reason": "Clicking sign up button"}
{"action": "type", "selector": "[data-agent-id='12']", "text": "username123", "reason": "Entering username"}

Respond with JSON only:`;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
            },
        };

        try {
            const result = await this.model.generateContent([prompt, imagePart]);
            const response = await result.response;

            // Track usage if available
            if (response.usageMetadata) {
                this.totalTokens += (response.usageMetadata.totalTokenCount || 0);
                this.sendStats();
            }

            let text = response.text();
            console.log('[Agent] Raw Gemini response:', text.substring(0, 200));

            // Clean up response - extract JSON if wrapped in extra text or markdown
            text = text.trim();

            // Remove markdown code blocks if present
            if (text.startsWith('```json')) {
                text = text.slice(7);
            } else if (text.startsWith('```')) {
                text = text.slice(3);
            }
            if (text.endsWith('```')) {
                text = text.slice(0, -3);
            }
            text = text.trim();

            // Try to find JSON object in response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                text = jsonMatch[0];
            }

            // Try parsing as JSON first
            try {
                const parsed = JSON.parse(text);
                this.log(`🤖 Plan: ${JSON.stringify(parsed)}`);
                return parsed;
            } catch (jsonError) {
                // Fallback: Try to parse natural language response
                this.log('⚠️ JSON parse failed, trying natural language fallback. Text: ' + text);

                // create a clean version for regex matching - remove quotes and extra whitespace
                const cleanText = text.replace(/^["']|["']$/g, '').trim();

                // Check for "navigate" command
                // Matches: navigate to https://..., navigate https://..., goto https://...
                // Also handles quotes: navigate "https://..."
                const navigateMatch = cleanText.match(/(?:navigate|go)(?:\s+to)?\s+["']?(https?:\/\/[^\s"']+)["']?/i);
                if (navigateMatch) {
                    this.log('✅ Navigate matched: ' + navigateMatch[1]);
                    return { action: "navigate", url: navigateMatch[1], reason: "Natural language parsed" };
                }

                // Check for ANY URL anywhere in the text
                const anyUrlMatch = text.match(/(https?:\/\/[^\s"'<>]+)/i);
                if (anyUrlMatch) {
                    this.log('✅ URL found in text: ' + anyUrlMatch[1]);
                    return { action: "navigate", url: anyUrlMatch[1], reason: "URL extracted from text" };
                }

                // Check for URL at start
                if (/^https?:\/\//i.test(cleanText)) {
                    return { action: "navigate", url: cleanText.split(' ')[0], reason: "Natural language parsed (URL only)" };
                }

                // Check for "click" command
                // Matches: click 5, click [data-agent-id='5'], click element 5
                const clickMatch = cleanText.match(/click\s+(?:on\s+)?(?:element\s+)?(?:id\s+)?(?:\[?data-agent-id=['"]?)?(\d+)/i);
                if (clickMatch) {
                    this.log('✅ Click matched: element ' + clickMatch[1]);
                    return { action: "click", selector: `[data-agent-id='${clickMatch[1]}']`, reason: "Natural language parsed" };
                }

                // Check for "type" command  
                // Matches: type "yahoo", type yahoo into 5, type "search term" in element 3
                const typeMatch = cleanText.match(/type\s+["']?([^"']+?)["']?\s*(?:in(?:to)?|on)?\s*(?:element\s*)?(?:\[?data-agent-id=['"]?)?(\d+)?/i);
                if (typeMatch && typeMatch[1]) {
                    const textToType = typeMatch[1].trim();
                    const elementId = typeMatch[2] || '1';
                    this.log('✅ Type matched: "' + textToType + '" into element ' + elementId);
                    return { action: "type", text: textToType, selector: `[data-agent-id='${elementId}']`, reason: "Natural language parsed" };
                }

                // Check for scroll
                if (/scroll\s*down/i.test(cleanText)) {
                    return { action: "scroll", reason: "Natural language parsed" };
                }

                // Check for done
                if (/done|goal achieved/i.test(cleanText)) {
                    return { action: "done", reason: "Natural language parsed" };
                }

                // Default fallback
                this.log("Failed to parse Gemini response: " + jsonError.message);
                return { action: "wait", reason: "Response parse error: " + text.substring(0, 50) };
            }
        } catch (e) {
            this.log("Failed to call Gemini API: " + e.message);
            return { action: "wait", reason: "API error" };
        }
    }

    /**
     * Safely escape a string for use in JavaScript
     */
    escapeForJS(str) {
        if (!str) return '';
        return str
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/</g, '\\x3c')
            .replace(/>/g, '\\x3e');
    }

    async executeAction(plan) {
        if (plan.action === "done") return;

        this.log(`👉 Performing: ${plan.action} on ${plan.selector || plan.url || 'page'}`);

        if (plan.action === "navigate" && plan.url) {
            let url = plan.url;
            if (!url.startsWith('http')) url = 'https://' + url;
            this.log(`🌐 Navigating to ${url}...`);
            await this.guestWebContents.loadURL(url);
        } else if (plan.action === "click" && plan.selector) {
            try {
                // Escape the selector safely
                const safeSelector = this.escapeForJS(plan.selector);

                const clickResult = await this.guestWebContents.executeJavaScript(`
                    (function() {
                        try {
                            const findElement = (sel) => {
                                // 1. Try exact selector match
                                try {
                                    let el = document.querySelector(sel);
                                    if (el) return el;
                                } catch(e) { /* invalid selector, continue */ }
                                
                                // 2. Try wrapping as data-agent-id if it looks like a number
                                if (!sel.includes('[') && !sel.includes('#') && !sel.includes('.')) {
                                    let el = document.querySelector('[data-agent-id="' + sel + '"]');
                                    if (el) return el;
                                }
                                
                                // 3. Extract ID from selector format [data-agent-id='123']
                                const idMatch = sel.match(/data-agent-id[='"]+([^'"\\]]+)/);
                                if (idMatch) {
                                    let el = document.querySelector('[data-agent-id="' + idMatch[1] + '"]');
                                    if (el) return el;
                                }
                                
                                return null;
                            };

                            const selector = '${safeSelector}';
                            const el = findElement(selector);
                            
                            if (el) {
                                // Scroll into view first
                                el.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
                                
                                // Get element center coordinates for realistic mouse events
                                const rect = el.getBoundingClientRect();
                                const centerX = rect.left + rect.width / 2;
                                const centerY = rect.top + rect.height / 2;
                                
                                // Simulate full mouse interaction sequence with coordinates
                                const eventOpts = { 
                                    bubbles: true, 
                                    cancelable: true, 
                                    view: window,
                                    clientX: centerX,
                                    clientY: centerY,
                                    screenX: centerX,
                                    screenY: centerY,
                                    button: 0,
                                    buttons: 1
                                };
                                
                                el.dispatchEvent(new MouseEvent('mouseover', eventOpts));
                                el.dispatchEvent(new MouseEvent('mouseenter', eventOpts));
                                el.dispatchEvent(new MouseEvent('mousedown', eventOpts));
                                el.dispatchEvent(new MouseEvent('mouseup', eventOpts));
                                el.dispatchEvent(new MouseEvent('click', eventOpts));
                                
                                // Also try native click for shadow DOM
                                el.click();
                                
                                return true;
                            }
                            return false;
                        } catch(e) {
                            console.error('Click error:', e);
                            return false;
                        }
                    })();
                `);

                if (!clickResult) {
                    this.log(`⚠️ Click failed for selector: ${plan.selector} (Element not found or not clickable)`);
                }
            } catch (error) {
                this.log(`❌ Error executing click: ${error.message}`);
            }
        } else if (plan.action === "type" && plan.selector && plan.text) {
            const safeSelector = this.escapeForJS(plan.selector);
            const safeText = this.escapeForJS(plan.text);

            await this.guestWebContents.executeJavaScript(`
                (function() {
                    const findElement = (sel) => {
                        try {
                            let el = document.querySelector(sel);
                            if (el) return el;
                        } catch(e) {}
                        
                        if (!sel.includes('[') && !sel.includes('#') && !sel.includes('.')) {
                            return document.querySelector('[data-agent-id="' + sel + '"]');
                        }
                        
                        const idMatch = sel.match(/data-agent-id[='"]+([^'"\\]]+)/);
                        if (idMatch) {
                            return document.querySelector('[data-agent-id="' + idMatch[1] + '"]');
                        }
                        return null;
                    };
                    
                    const el = findElement('${safeSelector}');
                    if (el) {
                        el.focus();
                        
                        // Clear existing value
                        el.value = '';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        // React/Angular/Vue hack: directly call native setter
                        const proto = Object.getPrototypeOf(el);
                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || 
                                       Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
                                       Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                        
                        const textToType = '${safeText}';
                        
                        if (setter && setter.call) {
                            setter.call(el, textToType);
                        } else {
                            el.value = textToType;
                        }
                        
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                })();
            `);

            // Press Enter just in case, and maybe Tab to trigger blur
            this.guestWebContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
            this.guestWebContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
        } else if (plan.action === "scroll") {
            const safeSelector = plan.selector ? this.escapeForJS(plan.selector) : '';

            await this.guestWebContents.executeJavaScript(`
                (function() {
                    const selector = '${safeSelector}';
                    let el = null;
                    
                    if (selector) {
                        try {
                            el = document.querySelector(selector);
                        } catch(e) {}
                        
                        if (!el && !selector.includes('[')) {
                            el = document.querySelector('[data-agent-id="' + selector + '"]');
                        }
                    }
                    
                    if (el) {
                        el.scrollBy(0, 500);
                    } else {
                        window.scrollBy(0, 500);
                    }
                })();
            `);
        }
    }
}

module.exports = Agent;
