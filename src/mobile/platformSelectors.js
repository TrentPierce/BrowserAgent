/**
 * Platform-Agnostic Selectors
 * Automatically converts selectors between web, iOS, and Android
 */

class PlatformSelectors {
  constructor(platform) {
    this.platform = platform.toLowerCase();
  }

  /**
     * Convert a generic selector to platform-specific selector
     * @param {string} selector - Generic selector (id, class, xpath, etc.)
     * @param {string} type - Selector type: 'id', 'class', 'text', 'xpath', 'accessibility'
     * @returns {object} Platform-specific selector object
     */
  convert(selector, type = 'auto') {
    if (type === 'auto') {
      type = this.detectSelectorType(selector);
    }

    const converters = {
      web: () => this.convertForWeb(selector, type),
      ios: () => this.convertForIOS(selector, type),
      android: () => this.convertForAndroid(selector, type)
    };

    const converter = converters[this.platform] || converters.web;
    return converter();
  }

  detectSelectorType(selector) {
    if (selector.startsWith('#')) return 'id';
    if (selector.startsWith('.')) return 'class';
    if (selector.startsWith('//') || selector.startsWith('(//')) return 'xpath';
    if (selector.startsWith('[') && selector.includes('=')) return 'attribute';
    if (selector.includes('~')) return 'accessibility';
    if (/^[a-z]+$/i.test(selector)) return 'tag';
    return 'text';
  }

  convertForWeb(selector, type) {
    switch (type) {
      case 'id':
        return selector.startsWith('#') ? selector : `#${selector}`;
      case 'class':
        return selector.startsWith('.') ? selector : `.${selector}`;
      case 'xpath':
        return selector;
      case 'attribute':
        return selector;
      case 'text':
        return `text=${selector}`;
      case 'tag':
        return selector;
      default:
        return selector;
    }
  }

  convertForIOS(selector, type) {
    switch (type) {
      case 'id': {
        const idValue = selector.replace('#', '');
        return {
          strategy: 'id',
          selector: idValue
        };
      }
      case 'class': {
        const className = selector.replace('.', '');
        return {
          strategy: 'class name',
          selector: className
        };
      }
      case 'xpath':
        return {
          strategy: 'xpath',
          selector: selector
        };
      case 'accessibility':
        return {
          strategy: 'accessibility id',
          selector: selector.replace('~', '')
        };
      case 'text':
        return {
          strategy: 'xpath',
          selector: `//*[@label='${selector}' or @name='${selector}' or @value='${selector}']`
        };
      case 'tag':
        return {
          strategy: 'xpath',
          selector: `//${this.mapToIOSTag(selector)}`
        };
      default:
        return {
          strategy: 'accessibility id',
          selector: selector
        };
    }
  }

  convertForAndroid(selector, type) {
    switch (type) {
      case 'id': {
        const idValue = selector.replace('#', '');
        return {
          strategy: 'id',
          selector: idValue.includes(':id/') ? idValue : `${idValue}`
        };
      }
      case 'class': {
        const className = selector.replace('.', '');
        return {
          strategy: 'class name',
          selector: className.includes('.') ? className : `android.widget.${className}`
        };
      }
      case 'xpath':
        return {
          strategy: 'xpath',
          selector: selector
        };
      case 'accessibility':
        return {
          strategy: 'accessibility id',
          selector: selector.replace('~', '')
        };
      case 'text':
        return {
          strategy: 'xpath',
          selector: `//*[@text='${selector}' or @content-desc='${selector}']`
        };
      case 'tag':
        return {
          strategy: 'xpath',
          selector: `//${this.mapToAndroidTag(selector)}`
        };
      default:
        return {
          strategy: 'xpath',
          selector: `//*[@text='${selector}' or @content-desc='${selector}' or @resource-id='${selector}']`
        };
    }
  }

  mapToIOSTag(tag) {
    const mapping = {
      'button': 'XCUIElementTypeButton',
      'input': 'XCUIElementTypeTextField',
      'textarea': 'XCUIElementTypeTextView',
      'text': 'XCUIElementTypeStaticText',
      'image': 'XCUIElementTypeImage',
      'link': 'XCUIElementTypeLink',
      'cell': 'XCUIElementTypeCell',
      'switch': 'XCUIElementTypeSwitch',
      'slider': 'XCUIElementTypeSlider',
      'picker': 'XCUIElementTypePicker',
      'scrollview': 'XCUIElementTypeScrollView',
      'table': 'XCUIElementTypeTable'
    };
    return mapping[tag.toLowerCase()] || `XCUIElementType${tag}`;
  }

  mapToAndroidTag(tag) {
    const mapping = {
      'button': 'android.widget.Button',
      'input': 'android.widget.EditText',
      'textarea': 'android.widget.EditText',
      'text': 'android.widget.TextView',
      'image': 'android.widget.ImageView',
      'link': 'android.widget.TextView',
      'checkbox': 'android.widget.CheckBox',
      'switch': 'android.widget.Switch',
      'slider': 'android.widget.SeekBar',
      'scrollview': 'android.widget.ScrollView',
      'listview': 'android.widget.ListView'
    };
    return mapping[tag.toLowerCase()] || `android.widget.${tag}`;
  }

  /**
     * Build a selector that works across all platforms
     * @param {object} options - Selector options with id, class, text, xpath
     * @returns {string|object} Platform-specific selector
     */
  buildUniversal(options) {
    const { id, className, text, xpath, accessibility, tag } = options;

    if (id) return this.convert(id, 'id');
    if (className) return this.convert(className, 'class');
    if (xpath) return this.convert(xpath, 'xpath');
    if (accessibility) return this.convert(accessibility, 'accessibility');
    if (text) return this.convert(text, 'text');
    if (tag) return this.convert(tag, 'tag');

    throw new Error('No valid selector provided in options');
  }

  /**
     * Create a combined selector that tries multiple strategies
     * @param {array} selectors - Array of selector objects
     * @returns {array} Platform-specific selector array
     */
  buildMultiple(selectors) {
    return selectors.map(sel => this.convert(sel.value, sel.type));
  }
}

module.exports = PlatformSelectors;
