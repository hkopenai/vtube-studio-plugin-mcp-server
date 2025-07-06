import { WebSocket } from 'ws';
import { MCPServer } from './mcp-server';
import * as fs from 'fs';
import * as path from 'path';

// Define logging function at the top to ensure it's available
const logToFileAndConsole = (message: string) => {
    console.log(`[VTS-MCP-SERVER] ${message}`);
    console.error(`[VTS-MCP-SERVER-ERROR-LOG] ${message}`);
};

// VTube Studio WebSocket connection
const connectToVTubeStudio = async (): Promise<void> => {
    const ws = new WebSocket('ws://0.0.0.0:8001');
    const tokenPath = path.join(__dirname, '..', 'auth_token.json');
    let authToken = '';

    ws.on('open', () => {
        logToFileAndConsole('Connected to VTube Studio');

        // Check if token exists in storage
        if (fs.existsSync(tokenPath)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                authToken = tokenData.authenticationToken;
                logToFileAndConsole('Using stored authentication token');

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
                logToFileAndConsole('Error reading stored token: ' + String(err));
            }
        }

        // If no token or error, request a new one
        logToFileAndConsole('Requesting new authentication token');
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
        logToFileAndConsole('Received: ' + JSON.stringify(message, null, 2));

        // Handle authentication token response
        if (message.messageType === 'AuthenticationTokenResponse') {
            const tokenData = {
                authenticationToken: message.data.authenticationToken,
                timestamp: new Date().toISOString()
            };
            try {
                fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
                logToFileAndConsole('Authentication token saved to auth_token.json');
            } catch (err) {
                logToFileAndConsole('Error saving token: ' + String(err));
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
                logToFileAndConsole('Authentication successful');
            } else {
                logToFileAndConsole('Authentication failed: ' + message.data.reason);
                logToFileAndConsole('Attempting reauthentication with a new token');
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
                    logToFileAndConsole('Reauthentication timeout reached, assuming failure. Please ensure VTube Studio is running and accepting connections on ws://0.0.0.0:8001. Attempting to reconnect...');
                    ws.close(); // Close the connection to prevent hanging
                    // Attempt to reconnect after a short delay
                    setTimeout(() => {
                        logToFileAndConsole('Attempting to reconnect to VTube Studio...');
                        // Delete the stored token to force a fresh request
                        if (fs.existsSync(tokenPath)) {
                            try {
                                fs.unlinkSync(tokenPath);
                                logToFileAndConsole('Deleted stored token to request a fresh one.');
                            } catch (err) {
                                logToFileAndConsole('Error deleting stored token: ' + String(err));
                            }
                        }
                        connectToVTubeStudio();
                    }, 3000); // Wait 3 seconds before reconnecting
                }, 5000); // 5 seconds timeout
            }
        }
    });

    ws.on('close', () => {
        console.log('Disconnected from VTube Studio');
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });

    console.log('Connecting to VTube Studio...');
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
        logToFileAndConsole('Initiating MCP Server start process...');
        await server.start();
        logToFileAndConsole('MCP Server started successfully');
        // Attempt to connect to VTube Studio once the server starts
        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount < maxRetries) {
            try {
                await connectToVTubeStudio();
                break; // Exit loop if connection succeeds
            } catch (error) {
                retryCount++;
                logToFileAndConsole(`Connection attempt ${retryCount} failed: ${String(error)}. Retrying in 3 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retrying
                if (retryCount === maxRetries) {
                    logToFileAndConsole(`Failed to connect to VTube Studio after ${maxRetries} attempts. Please ensure VTube Studio is running and accepting connections on ws://0.0.0.0:8001.`);
                }
            }
        }
    } catch (error) {
        logToFileAndConsole('Failed to start MCP Server: ' + String(error));
    }
};

// Start the MCP Server
startMCPServer().catch((err) => {
    console.error('Error starting the application:', err);
});
