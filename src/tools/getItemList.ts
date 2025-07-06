import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const getItemList = {
    name: 'getItemList',
    title: 'Get Item List',
    description: 'Retrieves a list of available items or items currently in the scene from VTube Studio',
    inputSchema: {
        includeAvailableSpots: z.boolean().optional().describe('Optional: If true, includes available spots for loading items.'),
        includeItemInstancesInScene: z.boolean().optional().describe('Optional: If true, includes items currently in the scene.'),
        includeAvailableItemFiles: z.boolean().optional().describe('Optional: If true, includes available item files on the user\'s PC. Note: This may cause a small lag due to disk I/O.'),
        onlyItemsWithInstanceID: z.string().optional().describe('Optional: Filter to only include items with this specific instance ID.'),
        onlyItemsWithFileName: z.string().optional().describe('Optional: Filter to only include items with this specific filename.')
    },
    register: function(server: any, ws: WebSocket) {
        server.registerTool(this.name, {
            title: this.title,
            description: this.description,
            inputSchema: this.inputSchema
        }, async (args: any, extra: any) => {
            const typedArgs = args as { 
                includeAvailableSpots?: boolean; 
                includeItemInstancesInScene?: boolean; 
                includeAvailableItemFiles?: boolean; 
                onlyItemsWithInstanceID?: string; 
                onlyItemsWithFileName?: string 
            };
            const result = await this.execute(ws, typedArgs);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        });
        log.info('Registered tool: ' + this.name);
    },
    execute: async (ws: WebSocket | null, args: { 
        includeAvailableSpots?: boolean; 
        includeItemInstancesInScene?: boolean; 
        includeAvailableItemFiles?: boolean; 
        onlyItemsWithInstanceID?: string; 
        onlyItemsWithFileName?: string 
    }) => {
        return new Promise((resolve, reject) => {
            if (!ws) {
                reject(new Error('WebSocket connection to VTube Studio is not open.'));
                return;
            }
            // Cast to any to access readyState for ws library compatibility
            const wsAny = ws as any;
            if (wsAny.readyState !== wsAny.OPEN) {
                reject(new Error('WebSocket connection to VTube Studio is not open.'));
                return;
            }

            const requestId = 'item-list-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ItemListRequest',
                data: {
                    includeAvailableSpots: args.includeAvailableSpots || false,
                    includeItemInstancesInScene: args.includeItemInstancesInScene || false,
                    includeAvailableItemFiles: args.includeAvailableItemFiles || false,
                    onlyItemsWithInstanceID: args.onlyItemsWithInstanceID || '',
                    onlyItemsWithFileName: args.onlyItemsWithFileName || ''
                }
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'ItemListResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for item list response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
