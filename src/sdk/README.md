// ============================================================
// 🦀 Krab SDK — Documentation and Examples
// ============================================================

/**
 * # Krab SDK Documentation
 *
 * The Krab SDK provides a comprehensive set of tools and utilities for integrating
 * with Krab AGI agents in your applications.
 *
 * ## Table of Contents
 * - [Installation](#installation)
 * - [Quick Start](#quick-start)
 * - [Configuration](#configuration)
 * - [Core Features](#core-features)
 * - [Tool Integration](#tool-integration)
 * - [Plugin System](#plugin-system)
 * - [Examples](#examples)
 * - [API Reference](#api-reference)
 */

/**
 * ## Installation
 *
 * ### Node.js
 * ```bash
 * npm install @krab/sdk
 * # or
 * yarn add @krab/sdk
 * ```
 *
 * ### Browser
 * ```html
 * <script src="https://cdn.jsdelivr.net/npm/@krab/sdk@latest/dist/browser.js"></script>
 * ```
 */

/**
 * ## Quick Start
 *
 * ### Basic Usage
 *
 * ```typescript
 * import { createKrabSDK } from '@krab/sdk';
 *
 * // Create SDK instance
 * const sdk = createKrabSDK({
 *   apiUrl: 'https://api.krab.ai',
 *   apiKey: 'your-api-key',
 *   enableLogging: true
 * });
 *
 * // Connect to Krab
 * await sdk.connect();
 *
 * // Send a message
 * const response = await sdk.sendMessage('Hello Krab!');
 * console.log(response.data); // "Hello! How can I help you today?"
 *
 * // Execute a tool
 * const result = await sdk.executeTool({
 *   tool: 'web_search',
 *   parameters: { query: 'latest AI news' }
 * });
 * ```
 */

/**
 * ## Configuration
 *
 * ### SDK Configuration Options
 *
 * ```typescript
 * interface KrabSDKConfig {
 *   apiUrl?: string;           // Krab API URL
 *   websocketUrl?: string;     // WebSocket URL
 *   apiKey?: string;           // API key for authentication
 *   timeout?: number;          // Request timeout (ms)
 *   retryAttempts?: number;    // Number of retry attempts
 *   retryDelay?: number;       // Delay between retries (ms)
 *   autoConnect?: boolean;     // Auto-connect on initialization
 *   enableLogging?: boolean;   // Enable logging
 *   customLogger?: Function;   // Custom logging function
 * }
 * ```
 *
 * ### Environment Variables
 *
 * ```bash
 * # .env
 * KRAB_API_URL=https://api.krab.ai
 * KRAB_API_KEY=your-api-key-here
 * KRAB_WEBSOCKET_URL=wss://api.krab.ai
 * ```
 */

/**
 * ## Core Features
 *
 * ### Agent Management
 *
 * ```typescript
 * // Create an agent
 * const agentId = sdk.createAgent({
 *   name: 'My Assistant',
 *   description: 'A helpful AI assistant',
 *   capabilities: ['chat', 'web-search', 'file-processing'],
 *   personality: 'friendly and helpful'
 * });
 *
 * // Update agent
 * sdk.updateAgent(agentId, {
 *   personality: 'professional and concise'
 * });
 *
 * // Get agent info
 * const agent = sdk.getAgent(agentId);
 * ```
 *
 * ### Conversation Management
 *
 * ```typescript
 * // Start a conversation
 * const sessionId = await sdk.startConversation({
 *   agentId: agentId,
 *   context: { userId: 'user123' }
 * });
 *
 * // Send messages
 * const response = await sdk.sendMessage(
 *   'What\'s the weather like?',
 *   { sessionId, agentId }
 * );
 *
 * // End conversation
 * await sdk.endConversation(sessionId);
 * ```
 */

/**
 * ## Tool Integration
 *
 * ### Using Built-in Tools
 *
 * ```typescript
 * import { createToolManager, webToolsSet } from '@krab/sdk';
 *
 * // Create tool manager
 * const toolManager = createToolManager(sdk);
 *
 * // Register tool sets
 * toolManager.registerToolSet(webToolsSet);
 *
 * // Execute a tool
 * const result = await toolManager.executeTool('web_search', {
 *   query: 'TypeScript tutorials',
 *   limit: 10
 * });
 *
 * console.log(result.data.results);
 * ```
 *
 * ### Creating Custom Tools
 *
 * ```typescript
 * import { ToolManager } from '@krab/sdk';
 *
 * // Create a custom tool
 * const customTool = ToolManager.createToolWrapper(
 *   'calculate_fibonacci',
 *   'Calculate nth Fibonacci number',
 *   async (params: { n: number }) => {
 *     function fibonacci(n: number): number {
 *       if (n <= 1) return n;
 *       return fibonacci(n - 1) + fibonacci(n - 2);
 *     }
 *     return { result: fibonacci(params.n) };
 *   },
 *   {
 *     validateParams: (params) => params && typeof params.n === 'number' && params.n >= 0,
 *     transformResult: (result) => `Fibonacci(${result.n}) = ${result.result}`
 *   }
 * );
 *
 * // Add to tool manager
 * toolManager.addCustomTool(customTool);
 *
 * // Use the tool
 * const result = await toolManager.executeTool('calculate_fibonacci', { n: 10 });
 * ```
 */

/**
 * ## Plugin System
 *
 * ### Creating a Plugin
 *
 * ```typescript
 * import { KrabPlugin, createPluginManager } from '@krab/sdk';
 *
 * const myPlugin: KrabPlugin = {
 *   name: 'analytics-plugin',
 *   version: '1.0.0',
 *   description: 'Analytics and usage tracking',
 *   author: 'Your Name',
 *
 *   async init(sdk) {
 *     console.log('Analytics plugin initialized');
 *
 *     // Track messages
 *     sdk.on('chatResponse', (response) => {
 *       this.trackEvent('message_sent', {
 *         sessionId: response.sessionId,
 *         timestamp: response.timestamp
 *       });
 *     });
 *   },
 *
 *   async destroy() {
 *     console.log('Analytics plugin destroyed');
 *     // Cleanup resources
 *   },
 *
 *   onConnect() {
 *     this.trackEvent('connection_established');
 *   },
 *
 *   onDisconnect() {
 *     this.trackEvent('connection_lost');
 *   },
 *
 *   onError(error) {
 *     this.trackEvent('error_occurred', { error: error.message });
 *   },
 *
 *   private trackEvent(event: string, data?: any) {
 *     // Send to analytics service
 *     console.log(`[Analytics] ${event}`, data);
 *   }
 * };
 *
 * // Load the plugin
 * const pluginManager = createPluginManager(sdk);
 * await pluginManager.loadPlugin(myPlugin);
 * await pluginManager.initializePlugin('analytics-plugin');
 * ```
 */

/**
 * ## Examples
 *
 * ### Complete Application
 *
 * ```typescript
 * import {
 *   createKrabSDK,
 *   createToolManager,
 *   createConfigurationManager,
 *   webToolsSet,
 *   aiToolsSet
 * } from '@krab/sdk';
 *
 * async function main() {
 *   // Configuration
 *   const configManager = createConfigurationManager();
 *   const config = configManager.getCurrentConfig() || {
 *     apiUrl: 'https://api.krab.ai',
 *     apiKey: process.env.KRAB_API_KEY,
 *     enableLogging: true
 *   };
 *
 *   // Create SDK
 *   const sdk = createKrabSDK(config);
 *
 *   // Setup tools
 *   const toolManager = createToolManager(sdk);
 *   toolManager.registerToolSet(webToolsSet);
 *   toolManager.registerToolSet(aiToolsSet);
 *
 *   // Create agent
 *   const agentId = sdk.createAgent({
 *     name: 'Research Assistant',
 *     description: 'Helps with research and information gathering',
 *     capabilities: ['web-search', 'analysis', 'summarization']
 *   });
 *
 *   // Connect
 *   await sdk.connect();
 *
 *   // Start conversation
 *   const sessionId = await sdk.startConversation({ agentId });
 *
 *   // Interactive chat loop
 *   const readline = require('readline');
 *   const rl = readline.createInterface({
 *     input: process.stdin,
 *     output: process.stdout
 *   });
 *
 *   function askQuestion() {
 *     rl.question('You: ', async (input: string) => {
 *       if (input.toLowerCase() === 'quit') {
 *         await sdk.endConversation(sessionId);
 *         sdk.disconnect();
 *         rl.close();
 *         return;
 *       }
 *
 *       try {
 *         const response = await sdk.sendMessage(input, { sessionId, agentId });
 *         console.log(`Krab: ${response.data}`);
 *       } catch (error) {
 *         console.error('Error:', error);
 *       }
 *
 *       askQuestion();
 *     });
 *   }
 *
 *   askQuestion();
 * }
 *
 * main().catch(console.error);
 * ```
 *
 * ### Browser Usage
 *
 * ```html
 * <!DOCTYPE html>
 * <html>
 * <head>
 *   <title>Krab Chat</title>
 * </head>
 * <body>
 *   <div id="chat-container">
 *     <div id="messages"></div>
 *     <input type="text" id="message-input" placeholder="Type your message...">
 *     <button id="send-button">Send</button>
 *   </div>
 *
 *   <script type="module">
 *     import { createKrabSDKBrowser } from 'https://cdn.jsdelivr.net/npm/@krab/sdk@latest/dist/browser.js';
 *
 *     const sdk = createKrabSDKBrowser({
 *       apiUrl: 'https://api.krab.ai',
 *       apiKey: 'your-api-key'
 *     });
 *
 *     const messagesDiv = document.getElementById('messages');
 *     const input = document.getElementById('message-input');
 *     const sendButton = document.getElementById('send-button');
 *
 *     // Connect
 *     sdk.connect().then(() => {
 *       addMessage('Krab', 'Connected! How can I help you?');
 *     });
 *
 *     // Send messages
 *     sendButton.addEventListener('click', async () => {
 *       const message = input.value.trim();
 *       if (!message) return;
 *
 *       addMessage('You', message);
 *       input.value = '';
 *
 *       try {
 *         const response = await sdk.sendMessage(message);
 *         addMessage('Krab', response.data);
 *       } catch (error) {
 *         addMessage('Error', error.message);
 *       }
 *     });
 *
 *     function addMessage(sender, text) {
 *       const messageDiv = document.createElement('div');
 *       messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
 *       messagesDiv.appendChild(messageDiv);
 *       messagesDiv.scrollTop = messagesDiv.scrollHeight;
 *     }
 *   </script>
 * </body>
 * </html>
 * ```
 */

/**
 * ## API Reference
 *
 * ### KrabSDK Class
 *
 * #### Constructor
 * ```typescript
 * new KrabSDK(config?: KrabSDKConfig)
 * ```
 *
 * #### Connection Methods
 * ```typescript
 * connect(): Promise<SDKResponse<boolean>>
 * disconnect(): void
 * isConnected(): boolean
 * ```
 *
 * #### Agent Methods
 * ```typescript
 * createAgent(config: AgentConfig): string
 * updateAgent(agentId: string, updates: Partial<AgentConfig>): boolean
 * deleteAgent(agentId: string): boolean
 * getAgent(agentId: string): AgentConfig | null
 * listAgents(): AgentConfig[]
 * ```
 *
 * #### Conversation Methods
 * ```typescript
 * startConversation(options?: ConversationOptions): Promise<SDKResponse<string>>
 * sendMessage(message: string, options?: ConversationOptions): Promise<SDKResponse<string>>
 * endConversation(sessionId: string): Promise<SDKResponse<boolean>>
 * ```
 *
 * #### Tool Methods
 * ```typescript
 * executeTool(options: ToolExecutionOptions): Promise<SDKResponse<any>>
 * ```
 *
 * #### Event Methods
 * ```typescript
 * on(event: string, listener: Function): void
 * off(event: string, listener?: Function): void
 * ```
 */

/**
 * ## Best Practices
 *
 * ### Error Handling
 * ```typescript
 * try {
 *   const response = await sdk.sendMessage('Hello');
 *   if (response.success) {
 *     console.log(response.data);
 *   } else {
 *     console.error('Error:', response.error);
 *   }
 * } catch (error) {
 *   console.error('Network error:', error);
 * }
 * ```
 *
 * ### Connection Management
 * ```typescript
 * sdk.on('disconnected', () => {
 *   console.log('Disconnected, attempting to reconnect...');
 *   setTimeout(() => sdk.connect(), 1000);
 * });
 *
 * sdk.on('error', (error) => {
 *   console.error('Connection error:', error);
 * });
 * ```
 *
 * ### Resource Cleanup
 * ```typescript
 * // Always clean up conversations
 * process.on('SIGINT', async () => {
 *   const conversations = sdk.getActiveConversations();
 *   for (const conv of conversations) {
 *     await sdk.endConversation(conv.sessionId);
 *   }
 *   sdk.disconnect();
 *   process.exit(0);
 * });
 * ```
 */

/**
 * ## Troubleshooting
 *
 * ### Common Issues
 *
 * **Connection Failed**
 * - Check your API key and URL configuration
 * - Ensure the Krab API server is running
 * - Check network connectivity
 *
 * **Tool Execution Failed**
 * - Verify the tool name and parameters
 * - Check if the tool is registered
 * - Ensure you have proper permissions
 *
 * **Timeout Errors**
 * - Increase the timeout configuration
 * - Check server response times
 * - Verify network stability
 *
 * ### Debug Mode
 * ```typescript
 * const sdk = createKrabSDK({
 *   enableLogging: true,
 *   customLogger: (level, message, meta) => {
 *     console.log(`[${level.toUpperCase()}] ${message}`, meta || '');
 *   }
 * });
 * ```
 */

/**
 * ## Contributing
 *
 * ### Development Setup
 * ```bash
 * git clone https://github.com/pollinations/krab-sdk.git
 * cd krab-sdk
 * npm install
 * npm run build
 * ```
 *
 * ### Testing
 * ```bash
 * npm test
 * npm run test:watch
 * npm run test:coverage
 * ```
 *
 * ### Building
 * ```bash
 * npm run build         # Build for Node.js
 * npm run build:browser # Build for browser
 * npm run build:all     # Build all targets
 * ```
 */

/**
 * ## License
 *
 * MIT License - see LICENSE file for details
 */

export {}; // Make this a module
