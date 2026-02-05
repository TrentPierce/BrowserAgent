/**
 * LLM Provider Factory
 * Creates and manages different LLM provider instances
 * @module LLMProviderFactory
 */

const { GeminiProvider } = require('./GeminiProvider');
const { OpenAIProvider } = require('./OpenAIProvider');
const { AnthropicProvider } = require('./AnthropicProvider');

class LLMProviderFactory {
    /**
     * Create an LLM provider instance
     * @param {string} provider - Provider name: 'gemini', 'openai', 'anthropic'
     * @param {string} apiKey - API key
     * @param {Object} config - Provider-specific configuration
     * @returns {Object} Provider instance
     */
    static createProvider(provider, apiKey, config = {}) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        
        switch (provider.toLowerCase()) {
            case 'gemini':
                return new GeminiProvider(apiKey, config);
            
            case 'openai':
                return new OpenAIProvider(apiKey, config);
            
            case 'anthropic':
                return new AnthropicProvider(apiKey, config);
            
            default:
                throw new Error(`Unknown provider: ${provider}. Supported: gemini, openai, anthropic`);
        }
    }
    
    /**
     * Get list of supported providers
     * @returns {Array<string>} Provider names
     */
    static getSupportedProviders() {
        return ['gemini', 'openai', 'anthropic'];
    }
    
    /**
     * Validate provider configuration
     * @param {string} provider - Provider name
     * @param {Object} config - Configuration
     * @returns {boolean} Valid or not
     */
    static validateConfig(provider, config) {
        const providers = LLMProviderFactory.getSupportedProviders();
        
        if (!providers.includes(provider.toLowerCase())) {
            return false;
        }
        
        // Provider-specific validation
        switch (provider.toLowerCase()) {
            case 'gemini':
                return GeminiProvider.validateConfig(config);
            case 'openai':
                return OpenAIProvider.validateConfig(config);
            case 'anthropic':
                return AnthropicProvider.validateConfig(config);
            default:
                return false;
        }
    }
}

module.exports = { LLMProviderFactory };