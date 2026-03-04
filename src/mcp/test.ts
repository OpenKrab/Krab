// ============================================================
// 🦀 Krab — MCP Inter-Agent Communication Test
// ============================================================
import { MCPClient } from './client.js';
import { MCPServer } from './server.js';
import { MCPTools } from './tools.js';
import { logger } from '../utils/logger.js';

export class MCPCommunicationTest {
  private server: MCPServer | null = null;
  private client1: MCPClient | null = null;
  private client2: MCPClient | null = null;
  private mcpTools: MCPTools;

  constructor() {
    this.mcpTools = new MCPTools();
  }

  async runFullTest(): Promise<boolean> {
    logger.info('[MCPTest] Starting full MCP inter-agent communication test');

    try {
      // Start MCP server
      logger.info('[MCPTest] Starting MCP server...');
      const serverStarted = await this.mcpTools.startMCPServer('test-server', 3002);
      if (!serverStarted) {
        throw new Error('Failed to start MCP server');
      }

      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Connect first client (stdio transport)
      logger.info('[MCPTest] Connecting client 1 (stdio)...');
      const client1Connected = await this.mcpTools.connectToMCP('test-client-1', {
        transport: 'websocket',
        websocketUrl: 'ws://localhost:3002',
        name: 'test-client-1'
      });

      if (!client1Connected) {
        throw new Error('Failed to connect client 1');
      }

      // Connect second client (websocket transport)
      logger.info('[MCPTest] Connecting client 2 (websocket)...');
      const client2Connected = await this.mcpTools.connectToMCP('test-client-2', {
        transport: 'websocket',
        websocketUrl: 'ws://localhost:3002',
        name: 'test-client-2'
      });

      if (!client2Connected) {
        throw new Error('Failed to connect client 2');
      }

      // Test tool discovery
      logger.info('[MCPTest] Testing tool discovery...');
      const tools1 = await this.mcpTools.listMCPTools('test-client-1');
      const tools2 = await this.mcpTools.listMCPTools('test-client-2');

      if (tools1.length === 0) {
        logger.warn('[MCPTest] No tools discovered (expected for basic test)');
      }

      // Test inter-agent messaging
      logger.info('[MCPTest] Testing inter-agent messaging...');
      const messageSent = await this.mcpTools.sendMessageToAgent('test-client-2', {
        type: 'test_message',
        content: 'Hello from client 1!',
        priority: 'medium'
      });

      if (messageSent) {
        logger.info('[MCPTest] Message sent successfully');
      }

      // Test broadcast messaging
      logger.info('[MCPTest] Testing broadcast messaging...');
      const broadcastCount = await this.mcpTools.broadcastMessage({
        type: 'broadcast_test',
        content: 'Broadcast message from test suite',
        priority: 'low'
      });

      logger.info(`[MCPTest] Broadcast sent to ${broadcastCount} agents`);

      // Test resource discovery
      logger.info('[MCPTest] Testing resource discovery...');
      const resources = await this.mcpTools.listMCPResources('test-client-1');
      logger.info(`[MCPTest] Discovered ${resources.length} resources`);

      // Test tool execution (if tools are available)
      if (tools1.length > 0) {
        logger.info('[MCPTest] Testing tool execution...');
        try {
          const result = await this.mcpTools.callMCPTool('test-client-1', tools1[0].name, {});
          logger.info(`[MCPTest] Tool execution result: ${result ? 'success' : 'failed'}`);
        } catch (error) {
          logger.warn(`[MCPTest] Tool execution failed (expected in basic test): ${error}`);
        }
      }

      // Cleanup
      logger.info('[MCPTest] Cleaning up...');
      await this.mcpTools.disconnectFromMCP('test-client-1');
      await this.mcpTools.disconnectFromMCP('test-client-2');
      await this.mcpTools.stopMCPServer('test-server');

      logger.info('[MCPTest] Full MCP test completed successfully ✅');
      return true;

    } catch (error) {
      logger.error('[MCPTest] Test failed:', error);

      // Cleanup on failure
      try {
        await this.mcpTools.disconnectFromMCP('test-client-1');
        await this.mcpTools.disconnectFromMCP('test-client-2');
        await this.mcpTools.stopMCPServer('test-server');
      } catch (cleanupError) {
        logger.error('[MCPTest] Cleanup failed:', cleanupError);
      }

      return false;
    }
  }

  async runBasicConnectivityTest(): Promise<boolean> {
    logger.info('[MCPTest] Running basic connectivity test');

    try {
      // Start server
      const serverStarted = await this.mcpTools.startMCPServer('basic-test-server', 3003);
      if (!serverStarted) return false;

      await new Promise(resolve => setTimeout(resolve, 500));

      // Connect client
      const clientConnected = await this.mcpTools.connectToMCP('basic-test-client', {
        transport: 'websocket',
        websocketUrl: 'ws://localhost:3003',
        name: 'basic-test-client'
      });

      if (!clientConnected) {
        await this.mcpTools.stopMCPServer('basic-test-server');
        return false;
      }

      // Basic tool discovery
      const tools = await this.mcpTools.listMCPTools('basic-test-client');

      // Cleanup
      await this.mcpTools.disconnectFromMCP('basic-test-client');
      await this.mcpTools.stopMCPServer('basic-test-server');

      logger.info('[MCPTest] Basic connectivity test passed ✅');
      return true;

    } catch (error) {
      logger.error('[MCPTest] Basic connectivity test failed:', error);
      return false;
    }
  }

  async runPerformanceTest(iterations: number = 100): Promise<any> {
    logger.info(`[MCPTest] Running performance test (${iterations} iterations)`);

    try {
      // Start server
      const serverStarted = await this.mcpTools.startMCPServer('perf-test-server', 3004);
      if (!serverStarted) throw new Error('Failed to start performance test server');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Connect client
      const clientConnected = await this.mcpTools.connectToMCP('perf-test-client', {
        transport: 'websocket',
        websocketUrl: 'ws://localhost:3004',
        name: 'perf-test-client'
      });

      if (!clientConnected) throw new Error('Failed to connect performance test client');

      // Run performance test
      const startTime = Date.now();
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < iterations; i++) {
        try {
          const tools = await this.mcpTools.listMCPTools('perf-test-client');
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      // Cleanup
      await this.mcpTools.disconnectFromMCP('perf-test-client');
      await this.mcpTools.stopMCPServer('perf-test-server');

      const results = {
        totalIterations: iterations,
        successfulRequests: successCount,
        failedRequests: errorCount,
        successRate: (successCount / iterations) * 100,
        totalTimeMs: totalTime,
        averageTimeMs: avgTime,
        requestsPerSecond: iterations / (totalTime / 1000)
      };

      logger.info('[MCPTest] Performance test completed:', results);
      return results;

    } catch (error) {
      logger.error('[MCPTest] Performance test failed:', error);
      throw error;
    }
  }

  async runLoadTest(concurrentClients: number = 10, requestsPerClient: number = 50): Promise<any> {
    logger.info(`[MCPTest] Running load test (${concurrentClients} clients, ${requestsPerClient} requests each)`);

    try {
      // Start server
      const serverStarted = await this.mcpTools.startMCPServer('load-test-server', 3005);
      if (!serverStarted) throw new Error('Failed to start load test server');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const startTime = Date.now();
      const clientPromises = [];

      // Create concurrent clients
      for (let i = 0; i < concurrentClients; i++) {
        clientPromises.push(this.runClientLoadTest(i, requestsPerClient));
      }

      const results = await Promise.all(clientPromises);
      const endTime = Date.now();

      // Cleanup
      for (let i = 0; i < concurrentClients; i++) {
        await this.mcpTools.disconnectFromMCP(`load-test-client-${i}`);
      }
      await this.mcpTools.stopMCPServer('load-test-server');

      // Aggregate results
      const aggregatedResults = {
        totalClients: concurrentClients,
        requestsPerClient,
        totalRequests: concurrentClients * requestsPerClient,
        totalTimeMs: endTime - startTime,
        clientResults: results,
        averageRequestsPerSecond: (concurrentClients * requestsPerClient) / ((endTime - startTime) / 1000),
        successRate: results.reduce((sum, r) => sum + r.successRate, 0) / concurrentClients
      };

      logger.info('[MCPTest] Load test completed:', aggregatedResults);
      return aggregatedResults;

    } catch (error) {
      logger.error('[MCPTest] Load test failed:', error);
      throw error;
    }
  }

  private async runClientLoadTest(clientIndex: number, requestCount: number): Promise<any> {
    const clientName = `load-test-client-${clientIndex}`;

    try {
      const connected = await this.mcpTools.connectToMCP(clientName, {
        transport: 'websocket',
        websocketUrl: 'ws://localhost:3005',
        name: clientName
      });

      if (!connected) {
        return { clientIndex, successRate: 0, errors: ['Connection failed'] };
      }

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < requestCount; i++) {
        try {
          await this.mcpTools.listMCPTools(clientName);
          successCount++;
        } catch (error) {
          errors.push((error as Error).message);
        }
      }

      return {
        clientIndex,
        successCount,
        totalRequests: requestCount,
        successRate: (successCount / requestCount) * 100,
        errors: errors.slice(0, 5) // Keep only first 5 errors
      };

    } catch (error) {
      return {
        clientIndex,
        successRate: 0,
        errors: [(error as Error).message]
      };
    }
  }
}

// Test runner functions
export async function runMCPTests(): Promise<{
  basicConnectivity: boolean;
  fullCommunication: boolean;
  performance?: any;
  load?: any;
}> {
  const testSuite = new MCPCommunicationTest();
  const results: any = {};

  logger.info('🧪 Starting MCP Integration Tests');

  // Basic connectivity test
  logger.info('📡 Running basic connectivity test...');
  results.basicConnectivity = await testSuite.runBasicConnectivityTest();

  // Full communication test
  if (results.basicConnectivity) {
    logger.info('💬 Running full communication test...');
    results.fullCommunication = await testSuite.runFullTest();
  } else {
    results.fullCommunication = false;
    logger.warn('⏭️ Skipping full communication test due to connectivity failure');
  }

  // Performance test (only if basic tests pass)
  if (results.basicConnectivity && results.fullCommunication) {
    try {
      logger.info('⚡ Running performance test...');
      results.performance = await testSuite.runPerformanceTest(50);
    } catch (error) {
      logger.error('Performance test failed:', error);
      results.performance = { error: (error as Error).message };
    }

    // Load test (lighter version)
    try {
      logger.info('🔥 Running light load test...');
      results.load = await testSuite.runLoadTest(3, 20);
    } catch (error) {
      logger.error('Load test failed:', error);
      results.load = { error: (error as Error).message };
    }
  }

  logger.info('✅ MCP Integration Tests Completed');
  logger.info('📊 Results:', results);

  return results;
}

// Quick test for development
export async function quickMCPTest(): Promise<boolean> {
  const testSuite = new MCPCommunicationTest();
  return await testSuite.runBasicConnectivityTest();
}

export default MCPCommunicationTest;
