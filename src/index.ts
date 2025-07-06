import { WebSocket } from 'ws';
import { MCPServer } from './mcp-server';
import * as path from 'path';
import log from 'log';
import { authenticate } from './utils/authenticate';
require("log-node")();

// VTube Studio WebSocket connection
const connectToVTubeStudio = async (): Promise<void> => {
    const ws = new WebSocket('ws://0.0.0.0:8001');
    const tokenPath = path.join(__dirname, '..', 'auth_token.json');

    ws.on('open', () => {
        log.info('Connected to VTube Studio');
        authenticate(ws, tokenPath).catch((err) => {
            log.error('Authentication failed: ' + String(err));
        });
    });

    ws.on('close', () => {
        log.error('Disconnected from VTube Studio');
    });

    ws.on('error', (err) => {
        log.error('WebSocket error: ' + String(err));
    });

    log.info('Connecting to VTube Studio...');
};

// MCP Server setup
const startMCPServer = async (): Promise<void> => {
    const server = new MCPServer({
        name: 'vtube-studio-mcp-server',
        description: 'An MCP server for VTube Studio integration',
        version: '1.0.0',
        tools: [],
        resources: []
    });

    try {
        log.info('Initiating MCP Server start process...');
        await server.start();
        log.info('MCP Server started successfully');
        // Attempt to connect to VTube Studio once the server starts
        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount < maxRetries) {
            try {
                await connectToVTubeStudio();
                break; // Exit loop if connection succeeds
            } catch (error) {
                retryCount++;
                log.error(`Connection attempt ${retryCount} failed: ${String(error)}. Retrying in 3 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retrying
                if (retryCount === maxRetries) {
                    log.error(`Failed to connect to VTube Studio after ${maxRetries} attempts. Please ensure VTube Studio is running and accepting connections on ws://0.0.0.0:8001.`);
                }
            }
        }
    } catch (error) {
        log.error('Failed to start MCP Server: ' + String(error));
    }
};

// Start the MCP Server with a debug log to ensure output
log.info('Starting VTube Studio MCP Server with debug logs enabled...');
startMCPServer().catch((err) => {
    log.error('Error starting the application: ' + String(err));
});
