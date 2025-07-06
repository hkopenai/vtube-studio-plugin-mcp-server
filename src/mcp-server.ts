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
        this.initializeTools();
    }

    private initializeTools(): void {
        // Register the tool for getting Live2D parameters, passing the WebSocket instance
        this.server.registerTool('getLive2DParameters', {
            title: 'Get Live2D Parameters',
            description: 'Retrieves Live2D parameters from VTube Studio'
        }, async (args, extra) => {
            const result = await getLive2DParameters.execute(this.ws);
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
        
        // Register the tool for getting VTS statistics, passing the WebSocket instance
        this.server.registerTool('getVTSStatistics', {
            title: 'Get VTS Statistics',
            description: 'Retrieves current statistics from VTube Studio'
        }, async (args, extra) => {
            const result = await getVTSStatistics.execute(this.ws);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getVTSStatistics');
        
        // Register the tool for getting VTS folders, passing the WebSocket instance
        this.server.registerTool('getVTSFolders', {
            title: 'Get VTS Folders',
            description: 'Retrieves the list of VTube Studio folders'
        }, async (args, extra) => {
            const result = await getVTSFolders.execute(this.ws);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getVTSFolders');
        
        // Register the tool for getting the currently loaded model, passing the WebSocket instance
        this.server.registerTool('getCurrentModel', {
            title: 'Get Current Model',
            description: 'Retrieves information about the currently loaded model in VTube Studio'
        }, async (args, extra) => {
            const result = await getCurrentModel.execute(this.ws);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getCurrentModel');
        
        // Register the tool for getting hotkeys, passing the WebSocket instance
        this.server.registerTool('getHotkeys', {
            title: 'Get Hotkeys',
            description: 'Retrieves the list of hotkeys available in the current or specified VTS model from VTube Studio',
            inputSchema: {
                modelID: z.string().optional().describe('Optional: The ID of the model to get hotkeys for. If not provided, uses the current model.'),
                onlyAvailable: z.boolean().optional().describe('Optional: If true, only returns hotkeys that are currently available to trigger.')
            }
        }, async (args, extra) => {
            const result = await getHotkeys.execute(this.ws, args);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getHotkeys');
        
        // Register the tool for triggering hotkeys, passing the WebSocket instance
        this.server.registerTool('triggerHotkey', {
            title: 'Trigger Hotkey',
            description: 'Triggers a hotkey in the current VTube Studio model',
            inputSchema: {
                hotkeyID: z.string().describe('The ID or name of the hotkey to trigger.'),
                itemInstanceID: z.string().optional().describe('Optional: The instance ID of the Live2D item to trigger the hotkey for.'),
            },            
        }, async (args: any, extra) => {
            const typedArgs = args as { hotkeyID: string; itemInstanceID?: string };
            const result = await triggerHotkey.execute(this.ws, typedArgs);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: triggerHotkey');
        
        // Register the tool for getting expression states, passing the WebSocket instance
        this.server.registerTool('getExpressionStates', {
            title: 'Get Expression States',
            description: 'Retrieves the current state of expressions in the current model from VTube Studio',
            inputSchema: {
                details: z.boolean().optional().describe('Optional: If true, returns detailed information about each expression.'),
                expressionFile: z.string().optional().describe('Optional: Specific expression file to get the state for. If not provided, returns states for all expressions.')
            }
        }, async (args: any, extra) => {
            const typedArgs = args as { details?: boolean; expressionFile?: string };
            const result = await getExpressionStates.execute(this.ws, typedArgs);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getExpressionStates');
        
        // Register the tool for controlling expressions, passing the WebSocket instance
        this.server.registerTool('controlExpression', {
            title: 'Control Expression',
            description: 'Activates or deactivates an expression in the current model in VTube Studio',
            inputSchema: {
                expressionFile: z.string().describe('The file name of the expression to control.'),
                active: z.boolean().describe('Whether to activate (true) or deactivate (false) the expression.'),
                fadeTime: z.number().optional().describe('Optional: Duration in seconds for fading the expression in or out.')
            }
        }, async (args: any, extra) => {
            const typedArgs = args as { expressionFile: string; active: boolean; fadeTime?: number };
            const result = await controlExpression.execute(this.ws, typedArgs);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: controlExpression');
        
        // Register the tool for getting ArtMesh list, passing the WebSocket instance
        this.server.registerTool('getArtMeshList', {
            title: 'Get ArtMesh List',
            description: 'Retrieves the list of ArtMeshes in the current model from VTube Studio'
        }, async (args, extra) => {
            const result = await getArtMeshList.execute(this.ws);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getArtMeshList');
        
        // Register the tool for getting item list, passing the WebSocket instance
        this.server.registerTool('getItemList', {
            title: 'Get Item List',
            description: 'Retrieves a list of available items or items currently in the scene from VTube Studio',
            inputSchema: {
                includeAvailableSpots: z.boolean().optional().describe('Optional: If true, includes available spots for loading items.'),
                includeItemInstancesInScene: z.boolean().optional().describe('Optional: If true, includes items currently in the scene.'),
                includeAvailableItemFiles: z.boolean().optional().describe('Optional: If true, includes available item files on the user\'s PC. Note: This may cause a small lag due to disk I/O.'),
                onlyItemsWithInstanceID: z.string().optional().describe('Optional: Filter to only include items with this specific instance ID.'),
                onlyItemsWithFileName: z.string().optional().describe('Optional: Filter to only include items with this specific filename.')
            }
        }, async (args: any, extra) => {
            const typedArgs = args as { 
                includeAvailableSpots?: boolean; 
                includeItemInstancesInScene?: boolean; 
                includeAvailableItemFiles?: boolean; 
                onlyItemsWithInstanceID?: string; 
                onlyItemsWithFileName?: string 
            };
            const result = await getItemList.execute(this.ws, typedArgs);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getItemList');
        
        // Register the tool for getting tracking parameters, passing the WebSocket instance
        this.server.registerTool('getTrackingParameters', {
            title: 'Get Tracking Parameters',
            description: 'Retrieves a list of available tracking parameters from VTube Studio, including both default and custom parameters'
        }, async (args, extra) => {
            const result = await getTrackingParameters.execute(this.ws, {});
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getTrackingParameters');
        
        // Register the tool for getting post-processing effects list, passing the WebSocket instance
        this.server.registerTool('getPostProcessingList', {
            title: 'Get Post-Processing List',
            description: 'Retrieves the list of post-processing effects and their current state from VTube Studio',
            inputSchema: {
                fillPostProcessingPresetsArray: z.boolean().optional().describe('Optional: If true, includes the list of post-processing presets. Set to false to avoid disk I/O lag.'),
                fillPostProcessingEffectsArray: z.boolean().optional().describe('Optional: If true, includes the full list of post-processing effects and their values. Set to false to reduce response size.'),
                effectIDFilter: z.array(z.string()).optional().describe('Optional: List of effect IDs to filter the response. Leave empty to include all effects.')
            }
        }, async (args: any, extra) => {
            const typedArgs = args as { 
                fillPostProcessingPresetsArray?: boolean; 
                fillPostProcessingEffectsArray?: boolean; 
                effectIDFilter?: string[] 
            };
            const result = await getPostProcessingList.execute(this.ws, typedArgs);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: getPostProcessingList');
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
            log.info('MCP Server started successfully.');
            await this.server.connect(this.transport);
            log.info('MCP Server is initialized and ready for client requests via transport.');
        } catch (err) {
            log.error('Failed to start MCP Server: ' + String(err));
            throw err;
        }
    }
}
