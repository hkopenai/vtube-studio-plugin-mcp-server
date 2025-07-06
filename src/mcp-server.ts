import * as WebSocket from 'ws';
import { getLive2DParameters } from './tools/getLive2DParameters';
import { authenticate } from './utils/authenticate';

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
            console.log(`Attempting to connect to VTube Studio at ${this.WS_URL}`);
            this.ws = new WebSocket.WebSocket(this.WS_URL);

            this.ws.addEventListener('open', () => {
                console.log('Connected to VTube Studio successfully');
                authenticate(this.ws, this.TOKEN_PATH).then(() => {
                    console.log('Authentication process completed');
                    resolve();
                }).catch((err) => {
                    console.error('Authentication failed:', err);
                    reject(err);
                });
            });

            this.ws.addEventListener('error', (event) => {
                console.error('WebSocket connection error:', event);
                reject(event);
            });

            this.ws.addEventListener('close', (event: any) => {
                console.log('Disconnected from VTube Studio. Code:', event.code || 'N/A', 'Reason:', event.reason || 'N/A');
                this.ws = null;
            });
        });
    }

    async start(): Promise<void> {
        // Start the MCP Server
        console.log('Starting MCP Server...');
        try {
            await this.connectToVTubeStudio();
            console.log('MCP Server started successfully.');
            this.setupStdioListener();
        } catch (err) {
            console.error('Failed to start MCP Server:', err);
            throw err;
        }
    }

    private setupStdioListener(): void {
        // Set up stdio to listen for MCP client requests
        console.log('Setting up stdio listener for MCP client requests...');
        process.stdin
            .setEncoding('utf8')
            .on('data', (data) => {
                try {
                    const request = JSON.parse(data.toString().trim());
                    console.log('Received MCP client request:', request);
                    this.handleMCPRequest(request)
                        .then(response => {
                            console.log('Sending response to MCP client:', response);
                            process.stdout.write(JSON.stringify(response) + '\n');
                        })
                        .catch(err => {
                            console.error('Error handling MCP request:', err);
                            process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
                        });
                } catch (err) {
                    console.error('Error parsing MCP client request:', err);
                    process.stdout.write(JSON.stringify({ error: 'Invalid request format' }) + '\n');
                }
            });

        console.log('Stdio listener setup complete. MCP Server is now listening for client requests.');
    }

    private async handleMCPRequest(request: any): Promise<any> {
        // Handle MCP client requests
        if (request.type === 'tool-execute') {
            const toolName = request.toolName;
            const tool = this.tools.find(t => t.name === toolName);
            if (tool) {
                console.log(`Executing tool: ${toolName}`);
                return await tool.execute();
            } else {
                throw new Error(`Tool ${toolName} not found.`);
            }
        } else {
            throw new Error('Unsupported request type.');
        }
    }
}
