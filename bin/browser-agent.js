#!/usr/bin/env node

/**
 * BrowserAgent CLI
 * Command-line interface for BrowserAgent
 */

const { program } = require('commander');
const packageJson = require('../package.json');

program
    .name('browser-agent')
    .description('Intelligent Browser Automation with Multi-LLM Support')
    .version(packageJson.version);

// Standalone mode
program
    .command('standalone')
    .description('Run BrowserAgent in standalone mode (Electron UI)')
    .option('-h, --headless', 'Run in headless mode')
    .action((options) => {
        console.log('Starting BrowserAgent in standalone mode...');
        
        // Check if electron is available
        let electronPath;
        try {
            electronPath = require('electron');
        } catch (error) {
            console.error('❌ Electron is not installed.');
            console.log('\nTo use standalone mode, install electron:');
            console.log('  npm install -D electron');
            console.log('\nAlternatively, use one of these modes:');
            console.log('  - Server mode:    node bin/browser-agent.js server');
            console.log('  - Library mode:   See QUICKSTART.md for examples');
            process.exit(1);
        }
        
        // Spawn electron process
        const { spawn } = require('child_process');
        const path = require('path');
        
        const child = spawn(electronPath, [path.join(__dirname, '..')], {
            stdio: 'inherit',
            windowsHide: false
        });
        
        child.on('close', (code) => {
            process.exit(code);
        });
    });

// Server mode
program
    .command('server')
    .description('Run BrowserAgent as API server')
    .option('-p, --port <port>', 'HTTP API port', '3000')
    .option('-w, --ws-port <port>', 'WebSocket port', '3001')
    .option('--host <host>', 'Host to bind to', '0.0.0.0')
    .action(async (options) => {
        console.log('Starting BrowserAgent API server...');
        
        const { RestAPIServer } = require('../src/api/RestAPIServer');
        const { WebSocketServer } = require('../src/api/WebSocketServer');
        
        // Create servers
        const apiServer = new RestAPIServer({
            port: parseInt(options.port),
            host: options.host
        });
        
        const wsServer = new WebSocketServer({
            port: parseInt(options.wsPort)
        });
        
        // Setup event handlers
        apiServer.on('started', ({ port, host }) => {
            console.log(`API Server listening on http://${host}:${port}`);
            console.log(`Health check: http://${host}:${port}/health`);
        });
        
        wsServer.on('started', ({ port }) => {
            console.log(`WebSocket Server listening on ws://0.0.0.0:${port}`);
        });
        
        apiServer.on('error', (error) => {
            console.error('API Server error:', error.message);
        });
        
        wsServer.on('error', (error) => {
            console.error('WebSocket Server error:', error.message);
        });
        
        // Start servers
        try {
            await apiServer.start();
            await wsServer.start();
            
            console.log('\nBrowserAgent is ready!');
            console.log('Press Ctrl+C to stop');
            
            // Graceful shutdown
            const shutdown = async () => {
                console.log('\nShutting down gracefully...');
                await apiServer.stop();
                await wsServer.stop();
                console.log('Goodbye!');
                process.exit(0);
            };
            
            process.on('SIGTERM', shutdown);
            process.on('SIGINT', shutdown);
            
        } catch (error) {
            console.error('Failed to start servers:', error.message);
            process.exit(1);
        }
    });

// Test mode
program
    .command('test')
    .description('Run a test automation task')
    .requiredOption('-u, --url <url>', 'Starting URL')
    .requiredOption('-g, --goal <goal>', 'Goal description')
    .option('-p, --provider <provider>', 'LLM provider (gemini, openai, anthropic)', 'gemini')
    .option('-k, --api-key <key>', 'API key (or use env var)')
    .option('--headless', 'Run in headless mode', false)
    .action(async (options) => {
        console.log('Running test automation...');
        console.log(`URL: ${options.url}`);
        console.log(`Goal: ${options.goal}`);
        console.log(`Provider: ${options.provider}\n`);
        
        const { createAgent } = require('../src/index');
        
        try {
            const agent = await createAgent({
                provider: options.provider,
                apiKey: options.apiKey || process.env[`${options.provider.toUpperCase()}_API_KEY`],
                headless: options.headless
            });
            
            await agent.goto(options.url);
            console.log('Navigated to URL');
            
            const result = await agent.act(options.goal);
            console.log('\nResult:', result);
            
            const stats = agent.getStats();
            console.log('\nStatistics:', stats);
            
            await agent.close();
            console.log('\nTest completed successfully!');
            
        } catch (error) {
            console.error('Test failed:', error.message);
            process.exit(1);
        }
    });

// Info command
program
    .command('info')
    .description('Show system information')
    .action(() => {
        console.log('BrowserAgent System Information');
        console.log('================================');
        console.log(`Version: ${packageJson.version}`);
        console.log(`Node.js: ${process.version}`);
        console.log(`Platform: ${process.platform}`);
        console.log(`Architecture: ${process.arch}`);
        console.log('\nSupported LLM Providers:');
        console.log('  - Gemini (Google)');
        console.log('  - OpenAI (GPT-4, GPT-3.5)');
        console.log('  - Anthropic (Claude)');
        console.log('\nDeployment Modes:');
        console.log('  - Standalone (Electron UI)');
        console.log('  - Server (REST API + WebSocket)');
        console.log('  - Library (npm package)');
    });

program.parse();