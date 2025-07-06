import * as WebSocket from 'ws';
import fs from 'fs';
import { getLive2DParameters } from './tools/getLive2DParameters';

export interface MCPServerOptions {
    name: string;
    description: string;
    version: string;
    tools: any[];
    resources: any[];
}

export class MCPServer {
    private ws: WebSocket.WebSocket | null = null;
    private readonly WS_URL = 'ws://0.0.0.0:8001';
    private readonly TOKEN_PATH = 'auth_token.json';
    private tools: any[] = [];

    constructor(options: MCPServerOptions) {
        // Placeholder for MCP Server initialization
        console.log('Initializing MCP Server with options:', options);
        this.initializeTools();
    }

    private initializeTools(): void {
        // Register the tool for getting Live2D parameters, passing the WebSocket instance
        const live2DParametersTool = {
            ...getLive2DParameters,
            execute: async () => {
                return await getLive2DParameters.execute(this.ws);
            }
        };

        this.tools.push(live2DParametersTool);
        console.log('Registered tool: getLive2DParameters');
    }

    private connectToVTubeStudio(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket.WebSocket(this.WS_URL);

            this.ws.addEventListener('open', () => {
                console.log('Connected to VTube Studio');
                this.authenticate().then(() => resolve()).catch((err) => reject(err));
            });

            this.ws.addEventListener('error', (event) => {
                console.error('WebSocket error:', event);
                reject(event);
            });

            this.ws.addEventListener('close', () => {
                console.log('Disconnected from VTube Studio');
                this.ws = null;
            });
        });
    }

    private authenticate(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.ws) {
                reject(new Error('WebSocket is not initialized.'));
                return;
            }

            let authToken = '';
            if (fs.existsSync(this.TOKEN_PATH)) {
                try {
                    const tokenData = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf8'));
                    authToken = tokenData.authenticationToken;
                    console.log('Using stored authentication token');
                } catch (err) {
                    console.error('Error reading stored token:', err);
                }
            }

            if (authToken) {
                const authRequest = {
                    apiName: 'VTubeStudioPublicAPI',
                    apiVersion: '1.0',
                    requestID: 'auth-request-1',
                    messageType: 'AuthenticationRequest',
                    data: {
                        pluginName: 'MyVTubePlugin',
                        pluginDeveloper: 'DeveloperName',
                        authenticationToken: authToken
                    }
                };

                this.ws.send(JSON.stringify(authRequest));
            } else {
                console.log('Requesting new authentication token');
                const tokenRequest = {
                    apiName: 'VTubeStudioPublicAPI',
                    apiVersion: '1.0',
                    requestID: 'token-request-1',
                    messageType: 'AuthenticationTokenRequest',
                    data: {
                        pluginName: 'MyVTubePlugin',
                        pluginDeveloper: 'DeveloperName'
                    }
                };
                this.ws.send(JSON.stringify(tokenRequest));
            }

            const handleMessage = (event: any) => {
                const message = JSON.parse(event.data.toString());
                console.log('Received:', message);

                if (message.messageType === 'AuthenticationTokenResponse') {
                    const tokenData = {
                        authenticationToken: message.data.authenticationToken,
                        timestamp: new Date().toISOString()
                    };
                    fs.writeFileSync(this.TOKEN_PATH, JSON.stringify(tokenData, null, 2));
                    console.log('Authentication token saved to auth_token.json');

                    const authRequest = {
                        apiName: 'VTubeStudioPublicAPI',
                        apiVersion: '1.0',
                        requestID: 'auth-request-1',
                        messageType: 'AuthenticationRequest',
                        data: {
                            pluginName: 'MyVTubePlugin',
                            pluginDeveloper: 'DeveloperName',
                            authenticationToken: message.data.authenticationToken
                        }
                    };
                    this.ws && this.ws.send(JSON.stringify(authRequest));
                }

                if (message.messageType === 'AuthenticationResponse') {
                    this.ws && this.ws.removeEventListener('message', handleMessage);
                    if (message.data.authenticated) {
                        console.log('Authentication successful');
                        resolve();
                    } else {
                        console.log('Authentication failed:', message.data.reason);
                        console.log('Attempting reauthentication with a new token');
                        const tokenRequest = {
                            apiName: 'VTubeStudioPublicAPI',
                            apiVersion: '1.0',
                            requestID: 'token-request-retry-1',
                            messageType: 'AuthenticationTokenRequest',
                            data: {
                                pluginName: 'MyVTubePlugin',
                                pluginDeveloper: 'DeveloperName'
                            }
                        };
                        this.ws && this.ws.send(JSON.stringify(tokenRequest));
                    }
                }
            };

            this.ws.addEventListener('message', handleMessage);
            setTimeout(() => {
                this.ws && this.ws.removeEventListener('message', handleMessage);
                reject(new Error('Timeout waiting for authentication response.'));
            }, 10000);
        });
    }

    async start(): Promise<void> {
        // Placeholder for starting the MCP Server
        console.log('Starting MCP Server...');
        try {
            await this.connectToVTubeStudio();
            console.log('MCP Server started successfully.');
        } catch (err) {
            console.error('Failed to start MCP Server:', err);
            throw err;
        }
        // Simulate successful start
        return Promise.resolve();
    }
}
