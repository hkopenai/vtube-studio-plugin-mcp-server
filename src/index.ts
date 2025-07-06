import { WebSocket } from 'ws';
import { MCPServer } from './mcp-server';
import * as fs from 'fs';
import * as path from 'path';

// VTube Studio WebSocket connection
const connectToVTubeStudio = async (): Promise<void> => {
    const ws = new WebSocket('ws://0.0.0.0:8001');
    const tokenPath = path.join(__dirname, '..', 'auth_token.json');
    let authToken = '';

    ws.on('open', () => {
        console.log('Connected to VTube Studio');

        // Check if token exists in storage
        if (fs.existsSync(tokenPath)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                authToken = tokenData.authenticationToken;
                console.log('Using stored authentication token');

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
                console.error('Error reading stored token:', err);
            }
        }

        // If no token or error, request a new one
        console.log('Requesting new authentication token');
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
        console.log('Received:', message);

        // Handle authentication token response
        if (message.messageType === 'AuthenticationTokenResponse') {
            const tokenData = {
                authenticationToken: message.data.authenticationToken,
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
            console.log('Authentication token saved to auth_token.json');

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
                console.log('Authentication successful');
            } else {
                console.log('Authentication failed:', message.data.reason);
                console.log('Attempting reauthentication with a new token');
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
        await server.start();
        console.log('MCP Server started successfully');
        // Attempt to connect to VTube Studio once the server starts
        await connectToVTubeStudio();
    } catch (error) {
        console.error('Failed to start MCP Server:', error);
    }
};

// Start the MCP Server
startMCPServer().catch((err) => {
    console.error('Error starting the application:', err);
});
