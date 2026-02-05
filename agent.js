/**
 * ============================================================================
 * BROWSER AGENT - BASE CLASS
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * This file contains the BASE Agent class with core browser automation logic.
 * EnhancedAgent (enhancedAgent.js) EXTENDS this class and is used in production.
 * 
 * FILE RESPONSIBILITIES:
 * ----------------------
 * agent.js (this file):
 *   - DOM extraction & element detection (getSimplifiedDOM)
 *   - Decoy/fake element flagging
 *   - Filler text filtering
 *   - Hidden code/secret discovery
 *   - Action execution (click, type, scroll, navigate)
 *   - Base Gemini prompt (fallback only, not used in production)
 * 
 * enhancedAgent.js:
 *   - Production LLM prompt (askGeminiEnhanced) 
 *   - Context & session tracking
 *   - Loop/scroll detection
 *   - Learning engine integration
 *   - Retry logic with error recovery
 *   - User interaction & chat
 * 
 * WHEN MAKING CHANGES:
 * --------------------
 * - DOM extraction improvements    → Edit getSimplifiedDOM() in THIS file
 * - Action execution improvements  → Edit executeAction() in THIS file
 * - LLM prompt improvements        → Edit askGeminiEnhanced() in enhancedAgent.js
 * - Loop/stuck detection           → Edit loop() in enhancedAgent.js
 * - Learning/context features      → Edit enhancedAgent.js
 * 
 * ============================================================================
 * 
 * This project uses BrowserAgent by Trent Pierce
 * https://github.com/TrentPierce/BrowserAgent
 * Licensed under the BrowserAgent Non-Commercial License
 * 
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 * ============================================================================
 */

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
        // Enhanced script to tag elements, detect decoys, and extract hidden information
        const counterStart = this.agentIdCounter;
        const script = `
        (function() {
            const MAX_ELEMENTS = 50; // Increased for complex pages with popups
            const elements = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="option"], [onclick], label, h1, h2, h3, h4, p, span, .modal, .popup, .overlay, .dialog, [aria-label*="close" i], [class*="close" i], [class*="dismiss" i], [class*="accept" i]');
            const lines = [];
            const seenText = new Set();
            let counter = ${counterStart};
            
            // DECOY/FAKE DETECTION PATTERNS
            const suspiciousPatterns = {
                classNames: /fake|decoy|trick|trap|honey|spam|ad-|advert|promo|clickbait/i,
                textPatterns: /\\bfake\\b|\\bdecoy\\b|\\btrick\\b|\\btrap\\b|you('ve)? won|congratulations|claim.*(prize|reward)|urgent|act now|limited time/i,
                dataAttrs: /fake|decoy|trap|honey/i
            };
            
            // Helper to detect suspicious elements
            const isSuspicious = (el) => {
                const className = el.className || '';
                const text = (el.innerText || '').toLowerCase();
                const dataAttrs = Array.from(el.attributes).map(a => a.name + '=' + a.value).join(' ');
                
                // Check parent context for "(Fake)" or similar labels
                const parentText = el.parentElement?.innerText || '';
                if (/\\(fake\\)|\\(decoy\\)|fake button|decoy button/i.test(parentText)) return 'DECOY';
                
                // Check element's own attributes and text
                if (suspiciousPatterns.classNames.test(className)) return 'SUSPICIOUS-CLASS';
                if (suspiciousPatterns.textPatterns.test(text)) return 'SUSPICIOUS-TEXT';
                if (suspiciousPatterns.dataAttrs.test(dataAttrs)) return 'SUSPICIOUS-ATTR';
                
                return null;
            };
            
            // Helper to detect if element is part of a popup/modal
            const getPopupContext = (el) => {
                let parent = el.parentElement;
                let depth = 0;
                while (parent && depth < 10) {
                    const cls = (parent.className || '').toLowerCase();
                    const role = parent.getAttribute('role') || '';
                    if (cls.includes('modal') || cls.includes('popup') || cls.includes('overlay') || 
                        cls.includes('dialog') || role === 'dialog' || role === 'alertdialog') {
                        return '[IN-POPUP]';
                    }
                    if (cls.includes('cookie') || cls.includes('consent') || cls.includes('gdpr')) {
                        return '[COOKIE-BANNER]';
                    }
                    if (cls.includes('newsletter') || cls.includes('subscribe')) {
                        return '[NEWSLETTER]';
                    }
                    parent = parent.parentElement;
                    depth++;
                }
                return '';
            };
            
            // EXTRACT HIDDEN CODES/SECRETS from the page
            const extractSecrets = () => {
                const secrets = [];
                // Look for code patterns in text content
                const allText = document.body.innerText || '';
                
                // Common code patterns: "code: ABC123", "Code is: XYZ", "secret: 12345", etc.
                const codePatterns = [
                    /code[:\\s]+["']?([A-Za-z0-9]{4,12})["']?/gi,
                    /secret[:\\s]+["']?([A-Za-z0-9]{4,12})["']?/gi,
                    /password[:\\s]+["']?([A-Za-z0-9!@#$%]{4,20})["']?/gi,
                    /key[:\\s]+["']?([A-Za-z0-9]{4,12})["']?/gi,
                    /enter[:\\s]+["']?([A-Za-z0-9]{4,12})["']?/gi,
                    /the code is[:\\s]+["']?([A-Za-z0-9]{4,12})["']?/gi
                ];
                
                for (const pattern of codePatterns) {
                    let match;
                    while ((match = pattern.exec(allText)) !== null) {
                        if (match[1] && !secrets.includes(match[1])) {
                            secrets.push(match[1]);
                        }
                    }
                }
                
                // Check for hidden elements with codes
                const hiddenEls = document.querySelectorAll('[style*="display:none"], [style*="visibility:hidden"], [hidden], .hidden, .sr-only, .visually-hidden');
                hiddenEls.forEach(el => {
                    const text = el.innerText || el.textContent || '';
                    if (text.length > 2 && text.length < 50) {
                        const codeMatch = text.match(/[A-Za-z0-9]{4,12}/);
                        if (codeMatch && !secrets.includes(codeMatch[0])) {
                            secrets.push('[HIDDEN] ' + codeMatch[0]);
                        }
                    }
                });
                
                // Check HTML comments for hidden info
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
                while (walker.nextNode()) {
                    const comment = walker.currentNode.nodeValue;
                    if (comment && comment.length > 3 && comment.length < 100) {
                        const codeMatch = comment.match(/code[:\\s]*([A-Za-z0-9]{4,12})|secret[:\\s]*([A-Za-z0-9]{4,12})/i);
                        if (codeMatch) {
                            secrets.push('[COMMENT] ' + (codeMatch[1] || codeMatch[2]));
                        }
                    }
                }
                
                return secrets;
            };
            
            // Main element extraction
            for (const el of elements) {
                if (lines.length >= MAX_ELEMENTS) break;
                
                // Determine visibility
                const rect = el.getBoundingClientRect();
                if (rect.width < 5 || rect.height < 5) continue;
                if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
                
                // Skip if fully obscured (but still check visibility more carefully)
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none') continue;
                // Allow low opacity elements as they might be overlays we need to dismiss
                const opacity = parseFloat(style.opacity);
                if (opacity < 0.1) continue;

                // Get text context
                let text = el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.placeholder || "";
                text = text.replace(/\\s+/g, ' ').trim().substring(0, 80);
                
                // FILLER TEXT DETECTION - Skip placeholder/useless content
                const textLower = text.toLowerCase();
                const isFillerText = (
                    // Lorem ipsum and Latin placeholders
                    /lorem\\s*ipsum|dolor\\s*sit\\s*amet|consectetur\\s*adipiscing|sed\\s*do\\s*eiusmod|tempor\\s*incididunt|ut\\s*labore\\s*et|magna\\s*aliqua|enim\\s*ad\\s*minim|quis\\s*nostrud|exercitation\\s*ullamco|laboris\\s*nisi|aliquip\\s*ex\\s*ea|commodo\\s*consequat|duis\\s*aute\\s*irure|voluptate\\s*velit|esse\\s*cillum/i.test(textLower) ||
                    
                    // Common placeholder patterns
                    /^(placeholder|sample|example|test|demo|dummy|filler|default)\\s*(text|content|data|title|description)?$/i.test(textLower) ||
                    /^\\[.*\\]$/.test(text) || // [Placeholder], [Title], etc.
                    /^\\{.*\\}$/.test(text) || // {placeholder}
                    /^<.*>$/.test(text) ||   // <placeholder>
                    
                    // Generic filler phrases
                    /^(click here|read more|learn more|view more|see more|show more|load more)$/i.test(textLower) ||
                    /^(untitled|no title|title goes here|heading|subheading|paragraph)$/i.test(textLower) ||
                    /^(your (text|content|title|name|email) here)$/i.test(textLower) ||
                    /^(insert|add|enter|type) (text|content|title|name) here$/i.test(textLower) ||
                    /^(coming soon|under construction|work in progress|tbd|n\\/a|none|null|undefined)$/i.test(textLower) ||
                    
                    // Repeated characters or patterns (e.g., "aaaaa", "xxxxx", "-----")
                    /^(.)(\\1{4,})$/.test(text) ||
                    /^[-=_.]{5,}$/.test(text) ||
                    
                    // Generic marketing filler
                    /^(best|great|amazing|awesome|incredible|fantastic) (product|service|offer|deal)s?$/i.test(textLower) ||
                    
                    // Empty or whitespace-only after normalization
                    textLower.length === 0 ||
                    /^\\s*$/.test(text)
                );
                
                // Skip filler text unless it's an interactive element
                const isInteractive = ['button', 'input', 'select', 'textarea', 'a'].includes(el.tagName.toLowerCase()) ||
                                     el.getAttribute('role') === 'button' ||
                                     el.hasAttribute('onclick');
                
                if (isFillerText && !isInteractive) continue;
                
                // Skip duplicate text to reduce tokens
                const textKey = text.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (textKey.length > 3 && seenText.has(textKey)) continue;
                if (textKey.length > 3) seenText.add(textKey);


                // Assign incremental ID
                if (!el.hasAttribute('data-agent-id')) {
                    el.setAttribute('data-agent-id', (++counter).toString());
                }
                const agentId = el.getAttribute('data-agent-id');
                
                // Detect suspicious/decoy elements
                const suspiciousFlag = isSuspicious(el);
                const popupContext = getPopupContext(el);
                
                const tag = el.tagName.toLowerCase();
                const type = el.type ? \`type="\${el.type}"\` : "";
                const role = el.getAttribute('role') ? \`role="\${el.getAttribute('role')}"\` : "";
                const checked = el.checked ? 'CHECKED' : '';
                const disabled = el.disabled ? '[DISABLED]' : '';
                
                // Build flags string
                let flags = '';
                if (suspiciousFlag) flags += \`[\${suspiciousFlag}]\`;
                if (popupContext) flags += popupContext;
                if (disabled) flags += disabled;
                
                // Compact format with flags
                if (text || tag === 'input' || tag === 'select' || tag === 'textarea' || role || flags) {
                    lines.push(\`<\${tag} \${type} \${role} \${checked} id="\${agentId}">\${flags}\${text}</\${tag}>\`);
                }
            }
            
            // Add extracted secrets section if any found
            const secrets = extractSecrets();
            if (secrets.length > 0) {
                lines.push('');
                lines.push('=== DETECTED CODES/SECRETS ===');
                secrets.slice(0, 5).forEach(s => lines.push('CODE: ' + s));
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

    /**
     * Base Gemini prompt method.
     * NOTE: This method is ONLY used if Agent is instantiated directly.
     * In production, EnhancedAgent.askGeminiEnhanced() is used instead,
     * which has additional context awareness, decoy detection, and learning integration.
     * 
     * The DOM extraction (getSimplifiedDOM) and action execution (executeAction) 
     * methods ARE shared between both classes.
     */
    async askGemini(goal, dom, base64Image) {
        this.apiCalls++;
        this.sendStats();

        // Enterprise-grade prompt with strict guardrails
        const prompt = `You are a precise browser automation agent. Your task is to achieve a goal by analyzing a screenshot and a list of interactive elements, then outputting exactly ONE action as valid JSON.

## GOAL
"${goal}"

## AVAILABLE INTERACTIVE ELEMENTS (DOM)
These are the ONLY elements you can interact with. Each has a unique data-agent-id.
\`\`\`
${dom}
\`\`\`

## CRITICAL RULES

### 1. GROUNDING REQUIREMENT (MANDATORY)
- You can ONLY reference element IDs that appear in the DOM list above.
- If the element you need is NOT in the list, you MUST use "scroll" or "wait" to reveal it.
- NEVER invent or guess element IDs. If you reference an ID not in the DOM, the action will fail.

### 2. ACTION SELECTION
| Action | When to Use | Required Fields |
|--------|-------------|----------------|
| navigate | Go to a specific URL (only if not already there) | url, reason |
| click | Click a visible, interactive element | selector, reason |
| type | Enter text into an input/textarea | selector, text, reason |
| scroll | Reveal more content (element not visible) | reason |
| wait | Page is loading or dynamic content expected | reason |
| done | Goal has been FULLY achieved | reason |
| ask | Need user input (credentials, choices, etc.) | question, reason |

### 3. SELECTOR FORMAT
- Always use: \`[data-agent-id='X']\` where X is the exact ID from the DOM list.
- Example: \`[data-agent-id='5']\` NOT \`[data-agent-id=5]\` or \`#5\`

### 4. EDGE CASE HANDLING
- **Popups/Modals/Cookie banners**: Look for close buttons (X, "Close", "Accept", "Dismiss") and click them FIRST before proceeding.
- **Login walls**: If login is required but not part of the goal, use "ask" to get credentials.
- **CAPTCHAs**: Use "ask" action to request user intervention.
- **Multiple similar elements**: Choose the most contextually relevant one based on surrounding text.
- **Empty DOM list**: Page may still be loading - use "wait" action.

### 5. COMMON MISTAKES TO AVOID
✗ Do NOT click elements that don't exist in the DOM list
✗ Do NOT navigate if you're already on the correct page
✗ Do NOT type into non-input elements
✗ Do NOT mark "done" until the goal is verifiably complete
✗ Do NOT output anything except the JSON object

## OUTPUT FORMAT
Respond with ONLY a valid JSON object. No markdown, no explanation, no text before or after.

{"action": "<action>", "selector": "[data-agent-id='X']", "text": "<if typing>", "url": "<if navigating>", "question": "<if asking>", "reason": "<brief explanation>"}

## EXAMPLES

✓ Correct - Navigation:
{"action": "navigate", "url": "https://www.reddit.com", "reason": "Navigating to Reddit as requested"}

✓ Correct - Click (ID exists in DOM):
{"action": "click", "selector": "[data-agent-id='7']", "reason": "Clicking the Sign Up button"}

✓ Correct - Type into input:
{"action": "type", "selector": "[data-agent-id='12']", "text": "john@example.com", "reason": "Entering email address"}

✓ Correct - Element not visible:
{"action": "scroll", "reason": "The submit button is not visible, scrolling to reveal more content"}

✓ Correct - Need user input:
{"action": "ask", "question": "What username would you like me to use for registration?", "reason": "Need user-provided username"}

## YOUR RESPONSE (JSON only):`;

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
