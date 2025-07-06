import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
    private server: McpServer;
    private ws: WebSocket.WebSocket | null = null;
    private readonly WS_URL = 'ws://0.0.0.0:8001';
    private readonly TOKEN_PATH = 'auth_token.json';
    private transport = new StdioServerTransport();

    constructor(options: MCPServerOptions) {
        log.info('Initializing MCP Server with options: ' + JSON.stringify(options));
        this.server = new McpServer({
            name: options.name,
            description: options.description,
            version: options.version,
            transport: this.transport
        });
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

        this.server.registerTool('getLive2DParameters', {
            title: 'Get Live2D Parameters',
            description: 'Retrieves Live2D parameters from VTube Studio'
        }, async (args, extra) => {
            const result = await live2DParametersTool.execute();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
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
        log.info('Starting MCP Server...');
        try {
            await this.connectToVTubeStudio();
            log.info('MCP Server started successfully.');
            // The start method is not directly available, server might be running via transport
            await this.server.connect(this.transport);
            log.info('MCP Server is initialized and ready for client requests via transport.');
        } catch (err) {
            log.error('Failed to start MCP Server: ' + String(err));
            throw err;
        }
    }
}
