import * as WebSocket from 'ws';
import { getLive2DParameters } from './tools/getLive2DParameters';
import { authenticate } from './utils/authenticate';
import log from 'log';

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
        log.info('Initializing MCP Server with options: ' + JSON.stringify(options));
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
        log.info('Registered tool: getLive2DParameters');
    }

    private connectToVTubeStudio(): Promise<void> {
        return new Promise((resolve, reject) => {
            log.info(`Attempting to connect to VTube Studio at ${this.WS_URL}`);
            this.ws = new WebSocket.WebSocket(this.WS_URL);

            this.ws.addEventListener('open', () => {
                log.info('Connected to VTube Studio successfully');
                authenticate(this.ws, this.TOKEN_PATH).then(() => {
                    log.info('Authentication process completed');
                    resolve();
                }).catch((err) => {
                    log.error('Authentication failed: ' + String(err));
                    reject(err);
                });
            });

            this.ws.addEventListener('error', (event) => {
                log.error('WebSocket connection error: ' + String(event));
                reject(event);
            });

            this.ws.addEventListener('close', (event: any) => {
                log.info('Disconnected from VTube Studio. Code: ' + (event.code || 'N/A') + ', Reason: ' + (event.reason || 'N/A'));
                this.ws = null;
            });
        });
    }

    async start(): Promise<void> {
        // Start the MCP Server
        log.info('Starting MCP Server...');
        try {
            await this.connectToVTubeStudio();
            log.info('MCP Server started successfully.');
            this.setupStdioListener();
        } catch (err) {
            log.error('Failed to start MCP Server: ' + String(err));
            throw err;
        }
    }

    private setupStdioListener(): void {
        // Set up stdio to listen for MCP client requests
        log.info('Setting up stdio listener for MCP client requests...');
        process.stdin
            .setEncoding('utf8')
            .on('data', (data) => {
                try {
                    const request = JSON.parse(data.toString().trim());
                    log.info('Received MCP client request: ' + JSON.stringify(request));
                    this.handleMCPRequest(request)
                        .then(response => {
                            log.info('Sending response to MCP client: ' + JSON.stringify(response));
                            process.stdout.write(JSON.stringify(response) + '\n');
                        })
                        .catch(err => {
                            log.error('Error handling MCP request: ' + String(err));
                            process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
                        });
                } catch (err) {
                    log.error('Error parsing MCP client request: ' + String(err));
                    process.stdout.write(JSON.stringify({ error: 'Invalid request format' }) + '\n');
                }
            });

        log.info('Stdio listener setup complete. MCP Server is now listening for client requests.');
    }

    private async handleMCPRequest(request: any): Promise<any> {
        // Handle MCP client requests
        if (request.type === 'tool-execute') {
            const toolName = request.toolName;
            const tool = this.tools.find(t => t.name === toolName);
            if (tool) {
                log.info(`Executing tool: ${toolName}`);
                return await tool.execute();
            } else {
                throw new Error(`Tool ${toolName} not found.`);
            }
        } else {
            throw new Error('Unsupported request type.');
        }
    }
}
