/**
 * Computer Vision Module
 * Provides advanced visual element detection for elements not in DOM
 * Uses latest vision models and image processing techniques
 * @module vision/computerVision
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const cv = require('opencv4nodejs');

class ComputerVision {
  constructor(config = {}) {
    this.config = {
      model: config.model || 'gemini-2.0-flash-exp',
      confidenceThreshold: config.confidenceThreshold || 0.75,
      enableOCR: config.enableOCR !== false,
      enableObjectDetection: config.enableObjectDetection !== false,
      enableSemanticSegmentation: config.enableSemanticSegmentation || false,
      ...config
    };
    
    if (config.geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
      this.visionModel = this.genAI.getGenerativeModel({ model: this.config.model });
    }
    
    this.cache = new Map();
    this.detectionHistory = [];
  }

  /**
   * Detect visual elements not present in DOM
   * @param {Buffer|string} screenshot - Screenshot buffer or base64 string
   * @param {Object} options - Detection options
   * @returns {Promise<Array>} Detected elements with coordinates
   */
  async detectVisualElements(screenshot, options = {}) {
    const startTime = Date.now();
    
    try {
      // Prepare image
      const imageBuffer = await this.prepareImage(screenshot);
      const cacheKey = this.generateCacheKey(imageBuffer);
      
      // Check cache
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      const results = {
        elements: [],
        text: [],
        objects: [],
        regions: [],
        processingTime: 0
      };
      
      // Run detections in parallel
      const detectionPromises = [];
      
      if (this.config.enableOCR) {
        detectionPromises.push(this.performOCR(imageBuffer));
      }
      
      if (this.config.enableObjectDetection) {
        detectionPromises.push(this.detectObjects(imageBuffer, options));
      }
      
      if (this.config.enableSemanticSegmentation) {
        detectionPromises.push(this.performSemanticSegmentation(imageBuffer));
      }
      
      // Execute AI vision analysis
      detectionPromises.push(this.analyzeWithAI(imageBuffer, options));
      
      const detectionResults = await Promise.all(detectionPromises);
      
      // Merge results
      detectionResults.forEach(result => {
        if (result.text) results.text.push(...result.text);
        if (result.objects) results.objects.push(...result.objects);
        if (result.regions) results.regions.push(...result.regions);
        if (result.elements) results.elements.push(...result.elements);
      });
      
      // Post-process and filter results
      results.elements = this.deduplicateElements(results.elements);
      results.elements = this.filterByConfidence(results.elements);
      
      results.processingTime = Date.now() - startTime;
      
      // Cache results
      this.cache.set(cacheKey, results);
      
      // Track detection history
      this.detectionHistory.push({
        timestamp: Date.now(),
        elementCount: results.elements.length,
        processingTime: results.processingTime
      });
      
      return results;
      
    } catch (error) {
      console.error('Visual element detection failed:', error);
      throw new Error(`Computer vision error: ${error.message}`);
    }
  }

  /**
   * Perform OCR on image
   */
  async performOCR(imageBuffer) {
    try {
      const mat = await cv.imdecodeAsync(imageBuffer);
      const gray = await mat.cvtColorAsync(cv.COLOR_BGR2GRAY);
      
      // Enhance text regions
      const binary = await gray.thresholdAsync(0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      
      // Use Gemini for OCR with layout understanding
      if (this.visionModel) {
        const base64 = imageBuffer.toString('base64');
        const result = await this.visionModel.generateContent([
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64
            }
          },
          'Extract all text from this image with their approximate bounding box coordinates. Return as JSON array with format: [{"text": "...", "x": 0, "y": 0, "width": 0, "height": 0, "confidence": 0.0}]'
        ]);
        
        const response = await result.response;
        const text = response.text();
        
        try {
          const parsed = JSON.parse(text.replace(/```json\n?|```/g, ''));
          return { text: parsed };
        } catch {
          return { text: [] };
        }
      }
      
      return { text: [] };
      
    } catch (error) {
      console.error('OCR failed:', error);
      return { text: [] };
    }
  }

  /**
   * Detect objects and UI elements
   */
  async detectObjects(imageBuffer, options = {}) {
    try {
      if (!this.visionModel) {
        return { objects: [] };
      }
      
      const base64 = imageBuffer.toString('base64');
      const targetElements = options.targetElements || [
        'buttons', 'links', 'inputs', 'images', 'icons', 'menus',
        'dropdowns', 'checkboxes', 'radio buttons', 'sliders'
      ];
      
      const prompt = `Analyze this screenshot and identify all interactive UI elements including: ${targetElements.join(', ')}.
      
For each element, provide:
      1. Element type (button, link, input, etc.)
      2. Visual description
      3. Approximate coordinates (x, y, width, height) as percentages of image dimensions
      4. Confidence score (0-1)
      5. Any visible text or label
      
Return as JSON array: [{"type": "...", "description": "...", "x": 0, "y": 0, "width": 0, "height": 0, "confidence": 0.0, "text": "..."}]`;
      
      const result = await this.visionModel.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64
          }
        },
        prompt
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      try {
        const objects = JSON.parse(text.replace(/```json\n?|```/g, ''));
        return { 
          objects: objects.map(obj => ({
            ...obj,
            source: 'ai-vision'
          }))
        };
      } catch (error) {
        console.error('Failed to parse object detection response:', error);
        return { objects: [] };
      }
      
    } catch (error) {
      console.error('Object detection failed:', error);
      return { objects: [] };
    }
  }

  /**
   * Perform semantic segmentation
   */
  async performSemanticSegmentation(imageBuffer) {
    try {
      const mat = await cv.imdecodeAsync(imageBuffer);
      
      // Convert to different color spaces for analysis
      const hsv = await mat.cvtColorAsync(cv.COLOR_BGR2HSV);
      const lab = await mat.cvtColorAsync(cv.COLOR_BGR2LAB);
      
      // Apply edge detection
      const gray = await mat.cvtColorAsync(cv.COLOR_BGR2GRAY);
      const edges = await gray.cannyAsync(50, 150);
      
      // Find contours
      const contours = await edges.findContoursAsync(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      const regions = [];
      for (const contour of contours) {
        const area = contour.area;
        if (area > 100) { // Filter small regions
          const rect = contour.boundingRect();
          const moments = contour.moments();
          
          regions.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: area,
            center: {
              x: moments.m10 / moments.m00,
              y: moments.m01 / moments.m00
            },
            type: 'region'
          });
        }
      }
      
      return { regions };
      
    } catch (error) {
      console.error('Semantic segmentation failed:', error);
      return { regions: [] };
    }
  }

  /**
   * AI-powered visual analysis
   */
  async analyzeWithAI(imageBuffer, options = {}) {
    try {
      if (!this.visionModel) {
        return { elements: [] };
      }
      
      const base64 = imageBuffer.toString('base64');
      const userQuery = options.query || 'Identify all clickable and interactive elements';
      
      const prompt = `${userQuery}
      
Provide a comprehensive analysis including:
      1. All visible interactive elements with coordinates
      2. Visual hierarchy and layout structure
      3. Color scheme and design patterns
      4. Any elements that might be difficult to interact with
      
Return as structured JSON.`;
      
      const result = await this.visionModel.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64
          }
        },
        prompt
      ]);
      
      const response = await result.response;
      const analysis = response.text();
      
      return {
        elements: [],
        analysis: analysis
      };
      
    } catch (error) {
      console.error('AI analysis failed:', error);
      return { elements: [] };
    }
  }

  /**
   * Find visual element by description
   */
  async findElementByVisualDescription(screenshot, description) {
    const results = await this.detectVisualElements(screenshot, {
      query: `Find element matching: ${description}`
    });
    
    // Filter results matching description
    const matches = results.elements.filter(el => 
      el.description && 
      el.description.toLowerCase().includes(description.toLowerCase())
    );
    
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Detect visual changes between screenshots
   */
  async detectVisualChanges(screenshot1, screenshot2, options = {}) {
    try {
      const img1 = await cv.imdecodeAsync(await this.prepareImage(screenshot1));
      const img2 = await cv.imdecodeAsync(await this.prepareImage(screenshot2));
      
      // Ensure same dimensions
      const size = new cv.Size(img1.cols, img1.rows);
      const img2Resized = await img2.resizeAsync(size);
      
      // Calculate difference
      const diff = img1.absdiff(img2Resized);
      const gray = await diff.cvtColorAsync(cv.COLOR_BGR2GRAY);
      const threshold = await gray.thresholdAsync(30, 255, cv.THRESH_BINARY);
      
      // Find changed regions
      const contours = await threshold.findContoursAsync(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      const changes = contours
        .filter(c => c.area > 100)
        .map(c => {
          const rect = c.boundingRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: c.area
          };
        });
      
      return {
        changed: changes.length > 0,
        changes: changes,
        changePercentage: (changes.reduce((sum, c) => sum + c.area, 0) / (img1.cols * img1.rows)) * 100
      };
      
    } catch (error) {
      console.error('Visual change detection failed:', error);
      return { changed: false, changes: [] };
    }
  }

  /**
   * Helper methods
   */
  async prepareImage(screenshot) {
    if (Buffer.isBuffer(screenshot)) {
      return screenshot;
    }
    
    if (typeof screenshot === 'string') {
      if (screenshot.startsWith('data:')) {
        const base64Data = screenshot.split(',')[1];
        return Buffer.from(base64Data, 'base64');
      }
      return Buffer.from(screenshot, 'base64');
    }
    
    throw new Error('Invalid screenshot format');
  }

  generateCacheKey(imageBuffer) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(imageBuffer).digest('hex');
  }

  deduplicateElements(elements) {
    const seen = new Set();
    return elements.filter(el => {
      const key = `${el.type}-${el.x}-${el.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  filterByConfidence(elements) {
    return elements.filter(el => 
      !el.confidence || el.confidence >= this.config.confidenceThreshold
    );
  }

  clearCache() {
    this.cache.clear();
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      detectionCount: this.detectionHistory.length,
      averageProcessingTime: this.detectionHistory.reduce((sum, h) => sum + h.processingTime, 0) / this.detectionHistory.length || 0,
      averageElementsDetected: this.detectionHistory.reduce((sum, h) => sum + h.elementCount, 0) / this.detectionHistory.length || 0
    };
  }
}

module.exports = ComputerVision;
