/**
 * ============================================================================
 * UI ELEMENT CLASSIFIER - Visual Element Recognition
 * ============================================================================
 * 
 * Classifies UI elements based on visual characteristics, patterns, and
 * contextual information. Provides confidence scoring for element type
 * identification and supports detection of custom framework patterns.
 * 
 * FEATURES:
 * - UI element type classification (button, input, link, etc.)
 * - Visual pattern recognition
 * - Confidence-based scoring
 * - Accessibility element detection
 * - Framework pattern recognition (React, Vue, Angular)
 * - Interactive element identification
 * 
 * USAGE:
 * const classifier = new UIElementClassifier();
 * const classification = classifier.classifyElement({
 *   tag: 'button',
 *   className: 'btn btn-primary',
 *   text: 'Submit',
 *   bounds: { x: 100, y: 200, width: 120, height: 40 }
 * });
 * 
 * ============================================================================
 */

const EventEmitter = require('events');

/**
 * UI element types
 * @enum {string}
 */
const ElementType = {
    BUTTON: 'button',
    INPUT: 'input',
    TEXTAREA: 'textarea',
    SELECT: 'select',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    LINK: 'link',
    IMAGE: 'image',
    VIDEO: 'video',
    HEADING: 'heading',
    TEXT: 'text',
    ICON: 'icon',
    MENU: 'menu',
    MODAL: 'modal',
    CARD: 'card',
    TABLE: 'table',
    LIST: 'list',
    NAVIGATION: 'navigation',
    FORM: 'form',
    UNKNOWN: 'unknown'
};

/**
 * UI framework types
 * @enum {string}
 */
const FrameworkType = {
    REACT: 'react',
    VUE: 'vue',
    ANGULAR: 'angular',
    BOOTSTRAP: 'bootstrap',
    MATERIAL: 'material',
    TAILWIND: 'tailwind',
    CUSTOM: 'custom',
    NONE: 'none'
};

/**
 * Element interaction types
 * @enum {string}
 */
const InteractionType = {
    CLICKABLE: 'clickable',
    EDITABLE: 'editable',
    SELECTABLE: 'selectable',
    HOVERABLE: 'hoverable',
    DRAGGABLE: 'draggable',
    SCROLLABLE: 'scrollable',
    NONE: 'none'
};

/**
 * UI Element Classifier for visual element recognition
 * @class
 * @extends EventEmitter
 */
class UIElementClassifier extends EventEmitter {
    /**
     * Create a new UIElementClassifier instance
     * @param {Object} options - Configuration options
     * @param {number} [options.minConfidence=0.5] - Minimum confidence threshold
     * @param {boolean} [options.detectFrameworks=true] - Enable framework detection
     * @param {boolean} [options.detectAccessibility=true] - Enable accessibility detection
     */
    constructor(options = {}) {
        super();
        
        this.minConfidence = options.minConfidence || 0.5;
        this.detectFrameworks = options.detectFrameworks !== undefined ? options.detectFrameworks : true;
        this.detectAccessibility = options.detectAccessibility !== undefined ? options.detectAccessibility : true;
        
        // Classification patterns
        this.patterns = this.initializePatterns();
        
        // Statistics
        this.stats = {
            totalClassifications: 0,
            byType: {},
            byFramework: {},
            averageConfidence: 0
        };
        
        console.log('[UIElementClassifier] Initialized');
    }
    
    /**
     * Initialize classification patterns
     * @private
     * @returns {Object} Pattern definitions
     */
    initializePatterns() {
        return {
            button: {
                tags: ['button', 'input[type="button"]', 'input[type="submit"]', 'a'],
                classPatterns: /btn|button|cta|action|submit|primary|secondary/i,
                rolePatterns: /button/i,
                textPatterns: /^(submit|cancel|save|delete|ok|yes|no|confirm|send|add|create|edit|update|remove|search|login|sign|register|buy|checkout|continue|next|back|close|dismiss)$/i,
                ariaPatterns: /button/i
            },
            input: {
                tags: ['input', 'textarea'],
                classPatterns: /input|field|form-control|textbox/i,
                typePatterns: /text|email|password|number|tel|url|search/i,
                rolePatterns: /textbox/i,
                ariaPatterns: /textbox/i
            },
            checkbox: {
                tags: ['input[type="checkbox"]'],
                classPatterns: /checkbox|check|toggle/i,
                rolePatterns: /checkbox/i,
                ariaPatterns: /checkbox/i
            },
            radio: {
                tags: ['input[type="radio"]'],
                classPatterns: /radio|option/i,
                rolePatterns: /radio/i,
                ariaPatterns: /radio/i
            },
            select: {
                tags: ['select'],
                classPatterns: /select|dropdown|picker/i,
                rolePatterns: /listbox|combobox/i,
                ariaPatterns: /listbox|combobox/i
            },
            link: {
                tags: ['a'],
                classPatterns: /link|anchor|nav-link/i,
                rolePatterns: /link/i,
                ariaPatterns: /link/i
            },
            heading: {
                tags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
                classPatterns: /heading|title|header/i,
                rolePatterns: /heading/i,
                ariaPatterns: /heading/i
            },
            icon: {
                tags: ['i', 'svg', 'span'],
                classPatterns: /icon|fa-|glyphicon|material-icons|icon-|svg-inline/i,
                ariaPatterns: /icon|img/i
            },
            menu: {
                tags: ['nav', 'ul', 'ol'],
                classPatterns: /menu|nav|navigation|navbar|sidebar/i,
                rolePatterns: /menu|navigation/i,
                ariaPatterns: /menu|navigation/i
            },
            modal: {
                tags: ['div', 'dialog'],
                classPatterns: /modal|dialog|popup|overlay|lightbox/i,
                rolePatterns: /dialog|alertdialog/i,
                ariaPatterns: /dialog/i
            },
            card: {
                tags: ['div', 'article'],
                classPatterns: /card|panel|tile|box/i,
                rolePatterns: /article|region/i,
                ariaPatterns: /article/i
            }
        };
    }
    
    /**
     * Classify a UI element
     * @param {Object} element - Element to classify
     * @param {string} element.tag - HTML tag name
     * @param {string} [element.className] - CSS classes
     * @param {string} [element.id] - Element ID
     * @param {string} [element.type] - Input type
     * @param {string} [element.role] - ARIA role
     * @param {string} [element.text] - Element text content
     * @param {Object} [element.bounds] - Element bounds {x, y, width, height}
     * @param {Object} [element.styles] - Computed styles
     * @param {Object} [element.attributes] - HTML attributes
     * @returns {Object} Classification result
     */
    classifyElement(element) {
        console.log('[UIElementClassifier] Classifying element:', element.tag);
        
        const startTime = Date.now();
        
        try {
            // Determine element type
            const typeClassification = this.determineElementType(element);
            
            // Determine interaction type
            const interactionType = this.determineInteractionType(element, typeClassification.type);
            
            // Detect framework patterns
            const framework = this.detectFrameworks ? this.detectFramework(element) : null;
            
            // Check accessibility
            const accessibility = this.detectAccessibility ? this.checkAccessibility(element) : null;
            
            // Calculate visual characteristics
            const visual = this.analyzeVisualCharacteristics(element);
            
            // Build classification result
            const classification = {
                type: typeClassification.type,
                confidence: typeClassification.confidence,
                interaction: interactionType,
                framework: framework,
                accessibility: accessibility,
                visual: visual,
                metadata: {
                    tag: element.tag,
                    hasText: !!element.text,
                    hasId: !!element.id,
                    hasClasses: !!element.className,
                    classifiedAt: Date.now()
                }
            };
            
            // Update statistics
            const duration = Date.now() - startTime;
            this.updateStats(classification, duration);
            
            console.log(`[UIElementClassifier] Classified as ${classification.type} with confidence ${classification.confidence.toFixed(3)}`);
            this.emit('element:classified', { element, classification, duration });
            
            return classification;
            
        } catch (error) {
            console.error('[UIElementClassifier] Classification failed:', error.message);
            this.emit('classification:error', { element, error });
            
            return {
                type: ElementType.UNKNOWN,
                confidence: 0,
                error: error.message
            };
        }
    }
    
    /**
     * Determine element type
     * @private
     * @param {Object} element - Element data
     * @returns {Object} Type classification with confidence
     */
    determineElementType(element) {
        const scores = {};
        
        // Check each pattern type
        for (const [type, pattern] of Object.entries(this.patterns)) {
            let score = 0;
            let maxScore = 0;
            
            // Tag matching (highest weight)
            maxScore += 40;
            if (pattern.tags) {
                for (const tagPattern of pattern.tags) {
                    const cleanTag = tagPattern.replace(/\[.*\]/, '');
                    if (element.tag === cleanTag) {
                        score += 40;
                        
                        // Check type attribute if specified
                        if (tagPattern.includes('[type=')) {
                            const typeMatch = tagPattern.match(/type="([^"]+)"/);
                            if (typeMatch && element.type === typeMatch[1]) {
                                score += 10;
                                maxScore += 10;
                            }
                        }
                        break;
                    }
                }
            }
            
            // Class matching (medium weight)
            maxScore += 25;
            if (pattern.classPatterns && element.className) {
                if (pattern.classPatterns.test(element.className)) {
                    score += 25;
                }
            }
            
            // Role matching (medium weight)
            maxScore += 20;
            if (pattern.rolePatterns && element.role) {
                if (pattern.rolePatterns.test(element.role)) {
                    score += 20;
                }
            }
            
            // Text matching (lower weight)
            maxScore += 10;
            if (pattern.textPatterns && element.text) {
                if (pattern.textPatterns.test(element.text)) {
                    score += 10;
                }
            }
            
            // ARIA matching (lower weight)
            maxScore += 5;
            if (pattern.ariaPatterns && element.attributes) {
                const ariaLabel = element.attributes['aria-label'] || '';
                if (pattern.ariaPatterns.test(ariaLabel)) {
                    score += 5;
                }
            }
            
            // Calculate confidence for this type
            if (maxScore > 0) {
                scores[type] = score / maxScore;
            }
        }
        
        // Find best match
        let bestType = ElementType.UNKNOWN;
        let bestConfidence = 0;
        
        for (const [type, confidence] of Object.entries(scores)) {
            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestType = type;
            }
        }
        
        // Fallback to tag-based classification
        if (bestConfidence < 0.3) {
            const tagFallback = this.getTagFallbackType(element.tag);
            if (tagFallback) {
                return { type: tagFallback, confidence: 0.5 };
            }
        }
        
        return {
            type: bestType,
            confidence: bestConfidence
        };
    }
    
    /**
     * Get fallback type based on tag
     * @private
     * @param {string} tag - HTML tag
     * @returns {string|null} Element type
     */
    getTagFallbackType(tag) {
        const tagMap = {
            'button': ElementType.BUTTON,
            'input': ElementType.INPUT,
            'textarea': ElementType.TEXTAREA,
            'select': ElementType.SELECT,
            'a': ElementType.LINK,
            'img': ElementType.IMAGE,
            'video': ElementType.VIDEO,
            'h1': ElementType.HEADING,
            'h2': ElementType.HEADING,
            'h3': ElementType.HEADING,
            'h4': ElementType.HEADING,
            'h5': ElementType.HEADING,
            'h6': ElementType.HEADING,
            'nav': ElementType.NAVIGATION,
            'ul': ElementType.LIST,
            'ol': ElementType.LIST,
            'table': ElementType.TABLE,
            'form': ElementType.FORM,
            'p': ElementType.TEXT,
            'span': ElementType.TEXT,
            'div': ElementType.UNKNOWN
        };
        
        return tagMap[tag.toLowerCase()] || null;
    }
    
    /**
     * Determine interaction type
     * @private
     * @param {Object} element - Element data
     * @param {string} elementType - Classified element type
     * @returns {string} Interaction type
     */
    determineInteractionType(element, elementType) {
        // Based on element type
        const typeInteractions = {
            [ElementType.BUTTON]: InteractionType.CLICKABLE,
            [ElementType.LINK]: InteractionType.CLICKABLE,
            [ElementType.INPUT]: InteractionType.EDITABLE,
            [ElementType.TEXTAREA]: InteractionType.EDITABLE,
            [ElementType.SELECT]: InteractionType.SELECTABLE,
            [ElementType.CHECKBOX]: InteractionType.CLICKABLE,
            [ElementType.RADIO]: InteractionType.CLICKABLE,
            [ElementType.MENU]: InteractionType.CLICKABLE
        };
        
        if (typeInteractions[elementType]) {
            return typeInteractions[elementType];
        }
        
        // Check for click handlers
        if (element.attributes && (
            element.attributes.onclick || 
            element.attributes['data-action'] ||
            element.attributes['data-click']
        )) {
            return InteractionType.CLICKABLE;
        }
        
        // Check for draggable
        if (element.attributes && element.attributes.draggable === 'true') {
            return InteractionType.DRAGGABLE;
        }
        
        // Check styles for cursor pointer
        if (element.styles && element.styles.cursor === 'pointer') {
            return InteractionType.CLICKABLE;
        }
        
        return InteractionType.NONE;
    }
    
    /**
     * Detect framework patterns
     * @private
     * @param {Object} element - Element data
     * @returns {Object} Framework detection result
     */
    detectFramework(element) {
        const frameworks = {
            react: /^(react|_react|__react)/i,
            vue: /^(v-|vue-|data-v-)/i,
            angular: /^(ng-|data-ng-|\[ng|_ng)/i,
            bootstrap: /^(bs-|bootstrap)/i,
            material: /^(mat-|md-|mdc-)/i,
            tailwind: /^(tw-|tailwind)/i
        };
        
        const detected = [];
        const className = element.className || '';
        const attributes = element.attributes || {};
        
        // Check class names
        for (const [framework, pattern] of Object.entries(frameworks)) {
            if (pattern.test(className)) {
                detected.push(framework);
            }
        }
        
        // Check attributes
        for (const attr of Object.keys(attributes)) {
            for (const [framework, pattern] of Object.entries(frameworks)) {
                if (pattern.test(attr)) {
                    if (!detected.includes(framework)) {
                        detected.push(framework);
                    }
                }
            }
        }
        
        if (detected.length === 0) {
            return { type: FrameworkType.NONE, detected: [] };
        }
        
        return {
            type: detected[0],
            detected: detected,
            confidence: detected.length > 1 ? 0.8 : 0.9
        };
    }
    
    /**
     * Check accessibility compliance
     * @private
     * @param {Object} element - Element data
     * @returns {Object} Accessibility analysis
     */
    checkAccessibility(element) {
        const issues = [];
        const attributes = element.attributes || {};
        
        // Check for ARIA attributes
        const hasAriaLabel = !!attributes['aria-label'];
        const hasAriaDescribedBy = !!attributes['aria-describedby'];
        const hasRole = !!element.role;
        
        // Check for alt text on images
        if (element.tag === 'img' && !attributes.alt) {
            issues.push('Missing alt text for image');
        }
        
        // Check for label on inputs
        if (['input', 'textarea', 'select'].includes(element.tag)) {
            const hasLabel = !!attributes['aria-labelledby'] || hasAriaLabel || !!attributes.id;
            if (!hasLabel) {
                issues.push('Input missing associated label');
            }
        }
        
        // Check for interactive element accessibility
        if ([ElementType.BUTTON, ElementType.LINK].includes(element.type)) {
            if (!element.text && !hasAriaLabel) {
                issues.push('Interactive element missing accessible name');
            }
        }
        
        // Check for keyboard accessibility
        const isFocusable = element.attributes && (
            element.attributes.tabindex !== undefined ||
            ['a', 'button', 'input', 'select', 'textarea'].includes(element.tag)
        );
        
        return {
            hasAriaLabel: hasAriaLabel,
            hasAriaDescribedBy: hasAriaDescribedBy,
            hasRole: hasRole,
            isFocusable: isFocusable,
            issues: issues,
            score: Math.max(0, 1 - (issues.length * 0.25)),
            compliant: issues.length === 0
        };
    }
    
    /**
     * Analyze visual characteristics
     * @private
     * @param {Object} element - Element data
     * @returns {Object} Visual analysis
     */
    analyzeVisualCharacteristics(element) {
        const bounds = element.bounds || {};
        const styles = element.styles || {};
        
        // Size analysis
        const width = bounds.width || 0;
        const height = bounds.height || 0;
        const area = width * height;
        
        let sizeCategory = 'medium';
        if (area < 1000) sizeCategory = 'small';
        else if (area > 10000) sizeCategory = 'large';
        
        // Position analysis
        const position = {
            x: bounds.x || 0,
            y: bounds.y || 0,
            isTopArea: (bounds.y || 0) < 200,
            isBottomArea: (bounds.y || 0) > 800,
            isLeftArea: (bounds.x || 0) < 200,
            isRightArea: (bounds.x || 0) > 1000
        };
        
        // Visual prominence
        let prominence = 0.5;
        
        // Larger elements are more prominent
        if (area > 10000) prominence += 0.2;
        
        // Top position is more prominent
        if (position.isTopArea) prominence += 0.15;
        
        // Bright colors are more prominent (simplified)
        if (styles.backgroundColor && !styles.backgroundColor.includes('rgb(255, 255, 255)')) {
            prominence += 0.1;
        }
        
        prominence = Math.min(1.0, prominence);
        
        return {
            bounds: bounds,
            size: {
                width: width,
                height: height,
                area: area,
                category: sizeCategory
            },
            position: position,
            prominence: prominence,
            aspectRatio: height > 0 ? (width / height).toFixed(2) : 0
        };
    }
    
    /**
     * Classify multiple elements in batch
     * @param {Array<Object>} elements - Elements to classify
     * @returns {Array<Object>} Classification results
     */
    classifyBatch(elements) {
        console.log(`[UIElementClassifier] Classifying batch of ${elements.length} elements`);
        
        const results = elements.map(element => {
            try {
                return this.classifyElement(element);
            } catch (error) {
                console.error('[UIElementClassifier] Batch classification error:', error.message);
                return {
                    type: ElementType.UNKNOWN,
                    confidence: 0,
                    error: error.message
                };
            }
        });
        
        return results;
    }
    
    /**
     * Update statistics
     * @private
     * @param {Object} classification - Classification result
     * @param {number} duration - Processing duration
     */
    updateStats(classification, duration) {
        this.stats.totalClassifications++;
        
        // Count by type
        const type = classification.type;
        this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
        
        // Count by framework
        if (classification.framework && classification.framework.type !== FrameworkType.NONE) {
            const framework = classification.framework.type;
            this.stats.byFramework[framework] = (this.stats.byFramework[framework] || 0) + 1;
        }
        
        // Update average confidence
        const totalConf = this.stats.averageConfidence * (this.stats.totalClassifications - 1);
        this.stats.averageConfidence = (totalConf + classification.confidence) / this.stats.totalClassifications;
    }
    
    /**
     * Get classifier statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            averageConfidence: this.stats.averageConfidence.toFixed(3),
            mostCommonType: this.getMostCommonType(),
            mostCommonFramework: this.getMostCommonFramework()
        };
    }
    
    /**
     * Get most common element type
     * @private
     * @returns {string} Most common type
     */
    getMostCommonType() {
        let maxCount = 0;
        let mostCommon = ElementType.UNKNOWN;
        
        for (const [type, count] of Object.entries(this.stats.byType)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = type;
            }
        }
        
        return mostCommon;
    }
    
    /**
     * Get most common framework
     * @private
     * @returns {string} Most common framework
     */
    getMostCommonFramework() {
        let maxCount = 0;
        let mostCommon = FrameworkType.NONE;
        
        for (const [framework, count] of Object.entries(this.stats.byFramework)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = framework;
            }
        }
        
        return mostCommon;
    }
}

module.exports = { 
    UIElementClassifier, 
    ElementType, 
    FrameworkType, 
    InteractionType 
};
