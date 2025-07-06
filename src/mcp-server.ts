import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as WebSocket from 'ws';
import { getLive2DParameters } from './tools/getLive2DParameters';
import { getVTSStatistics } from './tools/getVTSStatistics';
import { getVTSFolders } from './tools/getVTSFolders';
import { getCurrentModel } from './tools/getCurrentModel';
import { getHotkeys } from './tools/getHotkeys';
import { triggerHotkey } from './tools/triggerHotkey';
import { getExpressionStates } from './tools/getExpressionStates';
import { controlExpression } from './tools/controlExpression';
import { getArtMeshList } from './tools/getArtMeshList';
import { getItemList } from './tools/getItemList';
import { getTrackingParameters } from './tools/getTrackingParameters';
import { getPostProcessingList } from './tools/getPostProcessingList';
import { authenticate } from './utils/authenticate';
import { z } from "zod";
import log from 'log';

export interface MCPServerOptions {
    name: string;
    description: string;
    version: string;
    tools: any[];
    resources: any[];
    storeToken?: boolean;
}

export class MCPServer {
    private server: McpServer;
    private ws: WebSocket.WebSocket | null = null;
    private readonly WS_URL = 'ws://0.0.0.0:8001';
    private readonly TOKEN_PATH = 'auth_token.json';
    private transport = new StdioServerTransport();
    private storeToken: boolean;

    constructor(options: MCPServerOptions) {
        log.info('Initializing MCP Server with options: ' + JSON.stringify(options));
        this.server = new McpServer({
            name: options.name,
            description: options.description,
            version: options.version,
            transport: this.transport
        });
        this.storeToken = options.storeToken !== false; // Default to true if not specified
    }

    private initializeTools(): void {
        // Dynamically import and register all tools
        const tools = [
            require('./tools/activateExpression').activateExpression,
            require('./tools/addCustomParameter').addCustomParameter,
            require('./tools/apiServerDiscovery').apiServerDiscovery,
            require('./tools/checkFaceFound').checkFaceFound,
            require('./tools/controlExpression').controlExpression,
            require('./tools/controlItemAnimation').controlItemAnimation,
            require('./tools/deleteCustomParameter').deleteCustomParameter,
            require('./tools/getArtMeshList').getArtMeshList,
            require('./tools/getAvailableModels').getAvailableModels,
            require('./tools/getCurrentModel').getCurrentModel,
            require('./tools/getCurrentModelPhysics').getCurrentModelPhysics,
            require('./tools/getExpressionStates').getExpressionStates,
            require('./tools/getHotkeys').getHotkeys,
            require('./tools/getItemList').getItemList,
            require('./tools/getLive2DParameters').getLive2DParameters,
            require('./tools/getParameterValue').getParameterValue,
            require('./tools/getPostProcessingList').getPostProcessingList,
            require('./tools/getSceneColorOverlayInfo').getSceneColorOverlayInfo,
            require('./tools/getTrackingParameters').getTrackingParameters,
            require('./tools/getVTSFolders').getVTSFolders,
            require('./tools/getVTSStatistics').getVTSStatistics,
            require('./tools/injectParameterData').injectParameterData,
            require('./tools/loadItemIntoScene').loadItemIntoScene,
            require('./tools/loadModel').loadModel,
            require('./tools/moveItemInScene').moveItemInScene,
            require('./tools/moveModel').moveModel,
            require('./tools/ndiConfig').ndiConfig,
            require('./tools/pinItemToModel').pinItemToModel,
            require('./tools/removeItemFromScene').removeItemFromScene,
            require('./tools/requestApiPermissions').requestApiPermissions,
            require('./tools/selectArtMeshes').selectArtMeshes,
            require('./tools/setCurrentModelPhysics').setCurrentModelPhysics,
            require('./tools/setPostProcessingEffects').setPostProcessingEffects,
            require('./tools/subscribeToEvents').subscribeToEvents,
            require('./tools/tintArtMeshes').tintArtMeshes,
            require('./tools/triggerHotkey').triggerHotkey
        ];

        tools.forEach(tool => {
            if (typeof tool.register === 'function') {
                tool.register(this.server, this.ws);
            } else {
                log.error(`Tool ${tool.name} does not have a register method. Skipping registration.`);
            }
        });
    }

    private connectToVTubeStudio(): Promise<void> {
        return new Promise((resolve, reject) => {
            log.info(`Attempting to connect to VTube Studio at ${this.WS_URL}`);
            this.ws = new WebSocket.WebSocket(this.WS_URL);

            this.ws.addEventListener('open', () => {
                log.info('Connected to VTube Studio successfully');
                authenticate(this.ws, this.storeToken ? this.TOKEN_PATH : null).then(() => {
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
                // Attempt reconnection after a delay
                setTimeout(() => {
                    log.info('Attempting to reconnect to VTube Studio...');
                    this.connectToVTubeStudio().catch(err => {
                        log.error('Reconnection failed: ' + String(err));
                    });
                }, 3000);
            });
        });
    }

    async start(): Promise<void> {
        log.info('Starting MCP Server...');
        try {
            await this.connectToVTubeStudio();
            this.initializeTools();
            log.info('MCP Server started successfully.');
            await this.server.connect(this.transport);
            log.info('MCP Server is initialized and ready for client requests via transport.');
        } catch (err) {
            log.error('Failed to start MCP Server: ' + String(err));
            throw err;
        }
    }
}
