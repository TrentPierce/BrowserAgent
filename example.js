/**
 * Simple BrowserAgent Example
 * Run with: node example.js
 */

const { createAgent } = require('./src/index.js');

async function main() {
    console.log('🚀 Starting BrowserAgent...\n');

    // Check for API key
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
        console.error('❌ Error: No API key found!');
        console.log('\nPlease set one of these environment variables:');
        console.log('  - GEMINI_API_KEY (for Google Gemini)');
        console.log('  - OPENAI_API_KEY (for OpenAI)');
        console.log('  - ANTHROPIC_API_KEY (for Claude)');
        console.log('\nOr create a .env file with your API key.');
        process.exit(1);
    }

    try {
        // Create agent
        const agent = await createAgent({
            provider: process.env.GEMINI_API_KEY ? 'gemini' : 'openai',
            apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
            headless: false  // Set to true to hide browser window
        });

        console.log('✅ Agent initialized successfully!\n');

        // Navigate to a website
        console.log('🌐 Navigating to example.com...');
        await agent.goto('https://example.com');
        console.log('✅ Navigation complete!\n');

        // Extract information
        console.log('📄 Extracting page information...');
        const pageInfo = await agent.page();
        console.log('Page Title:', pageInfo.title);
        console.log('Page URL:', pageInfo.url);
        console.log('');

        // Take a screenshot
        console.log('📸 Taking screenshot...');
        await agent.core.page.screenshot({ path: 'example-screenshot.png' });
        console.log('✅ Screenshot saved to example-screenshot.png\n');

        // Clean up
        console.log('🧹 Cleaning up...');
        await agent.close();
        console.log('✅ Done! BrowserAgent closed successfully.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
