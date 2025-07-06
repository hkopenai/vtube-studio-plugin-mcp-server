import { WebSocket } from 'ws';
import { MCPServer } from './mcp-server';
import * as fs from 'fs';
import * as path from 'path';

// Define log levels (higher number means more severe logging)
enum LogLevel {
    DEBUG = 1,
    INFO = 2,
    ERROR = 3
}

// Current log level, default to ERROR to show only error logs
let currentLogLevel: LogLevel = LogLevel.ERROR;

// Define logging function with log level support
const log = (level: LogLevel, message: string) => {
    if (level >= currentLogLevel) {
        if (level === LogLevel.ERROR) {
            console.error(`[VTS-MCP-SERVER-ERROR] ${message}`);
        } else if (level === LogLevel.INFO) {
            console.log(`[VTS-MCP-SERVER-INFO] ${message}`);
        } else if (level === LogLevel.DEBUG) {
            console.log(`[VTS-MCP-SERVER-DEBUG] ${message}`);
        }
    }
};

// VTube Studio WebSocket connection
const connectToVTubeStudio = async (): Promise<void> => {
    const ws = new WebSocket('ws://0.0.0.0:8001');
    const tokenPath = path.join(__dirname, '..', 'auth_token.json');
    let authToken = '';

    ws.on('open', () => {
        log(LogLevel.INFO, 'Connected to VTube Studio');

        // Check if token exists in storage
        if (fs.existsSync(tokenPath)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                authToken = tokenData.authenticationToken;
                log(LogLevel.INFO, 'Using stored authentication token');

                // Send authentication request with stored token
                const authRequest = {
                    apiName: 'VTubeStudioPublicAPI',
                    apiVersion: '1.0',
                    requestID: 'auth-request-1',
                    messageType: 'AuthenticationRequest',
                    data: {
                        pluginName: 'VTubeStudioMCPServer',
                        pluginDeveloper: 'DeveloperName',
                        authenticationToken: authToken
                    }
                };
                ws.send(JSON.stringify(authRequest));
                return;
            } catch (err) {
                log(LogLevel.ERROR, 'Error reading stored token: ' + String(err));
            }
        }

        // If no token or error, request a new one
        log(LogLevel.INFO, 'Requesting new authentication token');
        const tokenRequest = {
            apiName: 'VTubeStudioPublicAPI',
            apiVersion: '1.0',
            requestID: 'token-request-1',
            messageType: 'AuthenticationTokenRequest',
            data: {
                pluginName: 'VTubeStudioMCPServer',
                pluginDeveloper: 'DeveloperName'
            }
        };
        ws.send(JSON.stringify(tokenRequest));
    });

    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        log(LogLevel.DEBUG, 'Received: ' + JSON.stringify(message, null, 2));

        // Handle authentication token response
        if (message.messageType === 'AuthenticationTokenResponse') {
            const tokenData = {
                authenticationToken: message.data.authenticationToken,
                timestamp: new Date().toISOString()
            };
            try {
                fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
                log(LogLevel.INFO, 'Authentication token saved to auth_token.json');
            } catch (err) {
                log(LogLevel.ERROR, 'Error saving token: ' + String(err));
            }

            const authRequest = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: 'auth-request-1',
                messageType: 'AuthenticationRequest',
                data: {
                    pluginName: 'VTubeStudioMCPServer',
                    pluginDeveloper: 'DeveloperName',
                    authenticationToken: message.data.authenticationToken
                }
            };
            ws.send(JSON.stringify(authRequest));
        }

        // Handle authentication response
        if (message.messageType === 'AuthenticationResponse') {
            if (message.data.authenticated) {
                log(LogLevel.INFO, 'Authentication successful');
            } else {
                log(LogLevel.ERROR, 'Authentication failed: ' + message.data.reason);
                log(LogLevel.INFO, 'Attempting reauthentication with a new token');
                // Request a new token if authentication fails
                const tokenRequest = {
                    apiName: 'VTubeStudioPublicAPI',
                    apiVersion: '1.0',
                    requestID: 'token-request-retry-1',
                    messageType: 'AuthenticationTokenRequest',
                    data: {
                        pluginName: 'VTubeStudioMCPServer',
                        pluginDeveloper: 'DeveloperName'
                    }
                };
                ws.send(JSON.stringify(tokenRequest));
                // Set a shorter timeout for reauthentication based on user feedback
                setTimeout(() => {
                    log(LogLevel.ERROR, 'Reauthentication timeout reached, assuming failure. Please ensure VTube Studio is running and accepting connections on ws://0.0.0.0:8001. Attempting to reconnect...');
                    ws.close(); // Close the connection to prevent hanging
                    // Attempt to reconnect after a short delay
                    setTimeout(() => {
                        log(LogLevel.INFO, 'Attempting to reconnect to VTube Studio...');
                        // Delete the stored token to force a fresh request
                        if (fs.existsSync(tokenPath)) {
                            try {
                                fs.unlinkSync(tokenPath);
                                log(LogLevel.INFO, 'Deleted stored token to request a fresh one.');
                            } catch (err) {
                                log(LogLevel.ERROR, 'Error deleting stored token: ' + String(err));
                            }
                        }
                        connectToVTubeStudio();
                    }, 3000); // Wait 3 seconds before reconnecting
                }, 5000); // 5 seconds timeout
            }
        }
    });

    ws.on('close', () => {
        log(LogLevel.ERROR, 'Disconnected from VTube Studio');
    });

    ws.on('error', (err) => {
        log(LogLevel.ERROR, 'WebSocket error: ' + String(err));
    });

    log(LogLevel.INFO, 'Connecting to VTube Studio...');
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
        log(LogLevel.INFO, 'Initiating MCP Server start process...');
        await server.start();
        log(LogLevel.INFO, 'MCP Server started successfully');
        // Attempt to connect to VTube Studio once the server starts
        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount < maxRetries) {
            try {
                await connectToVTubeStudio();
                break; // Exit loop if connection succeeds
            } catch (error) {
                retryCount++;
                log(LogLevel.ERROR, `Connection attempt ${retryCount} failed: ${String(error)}. Retrying in 3 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retrying
                if (retryCount === maxRetries) {
                    log(LogLevel.ERROR, `Failed to connect to VTube Studio after ${maxRetries} attempts. Please ensure VTube Studio is running and accepting connections on ws://0.0.0.0:8001.`);
                }
            }
        }
    } catch (error) {
        log(LogLevel.ERROR, 'Failed to start MCP Server: ' + String(error));
    }
};

// Start the MCP Server
startMCPServer().catch((err) => {
    log(LogLevel.ERROR, 'Error starting the application: ' + String(err));
});
