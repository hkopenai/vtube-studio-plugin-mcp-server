import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = {
  fileName: z.string().min(1, "File name is required"),
  positionX: z.number().min(-1000).max(1000).default(0),
  positionY: z.number().min(-1000).max(1000).default(0.5),
  size: z.number().min(0).max(1).default(0.33),
  rotation: z.number().default(0),
  fadeTime: z.number().min(0).max(2).default(0.5),
  order: z.number().default(0),
  failIfOrderTaken: z.boolean().default(false),
  smoothing: z.number().min(0).max(1).default(0),
  censored: z.boolean().default(false),
  flipped: z.boolean().default(false),
  locked: z.boolean().default(false),
  unloadWhenPluginDisconnects: z.boolean().default(true),
  customDataBase64: z.string().optional(),
  customDataAskUserFirst: z.boolean().default(true),
  customDataSkipAskingUserIfWhitelisted: z.boolean().default(true),
  customDataAskTimer: z.number().default(-1),
};

export const loadItemIntoScene = {
    name: 'loadItemIntoScene',
    title: 'Load Item into Scene',
    description: 'Load an item into the VTube Studio scene with specified position, size, and other properties.',
    inputSchema: inputSchema,
    register: function(server: any, ws: WebSocket) {
        server.registerTool(this.name, {
            title: this.title,
            description: this.description,
            inputSchema: this.inputSchema
        }, async (args: any, extra: any) => {
            const result = await this.execute(ws, args);
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
    execute: async (ws: WebSocket | null, args: { fileName: string; positionX: number; positionY: number; size: number; rotation: number; fadeTime: number; order: number; failIfOrderTaken: boolean; smoothing: number; censored: boolean; flipped: boolean; locked: boolean; unloadWhenPluginDisconnects: boolean; customDataBase64?: string; customDataAskUserFirst: boolean; customDataSkipAskingUserIfWhitelisted: boolean; customDataAskTimer: number }) => {
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

            const requestId = `ItemLoad-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ItemLoadRequest',
                data: {
                    fileName: args.fileName,
                    positionX: args.positionX,
                    positionY: args.positionY,
                    size: args.size,
                    rotation: args.rotation,
                    fadeTime: args.fadeTime,
                    order: args.order,
                    failIfOrderTaken: args.failIfOrderTaken,
                    smoothing: args.smoothing,
                    censored: args.censored,
                    flipped: args.flipped,
                    locked: args.locked,
                    unloadWhenPluginDisconnects: args.unloadWhenPluginDisconnects,
                    customDataBase64: args.customDataBase64 || '',
                    customDataAskUserFirst: args.customDataAskUserFirst,
                    customDataSkipAskingUserIfWhitelisted: args.customDataSkipAskingUserIfWhitelisted,
                    customDataAskTimer: args.customDataAskTimer,
                },
            };

            const timeout = setTimeout(() => {
                reject(new Error('Request timed out after 30 seconds.'));
            }, 30000);

            const handler = (event: any) => {
                try {
                    const response = JSON.parse(event.data);
                    if (response.requestID === requestId) {
                        clearTimeout(timeout);
                        ws.removeEventListener('message', handler);
                        if (response.messageType === 'ItemLoadResponse') {
                            resolve({
                                success: true,
                                instanceID: response.data.instanceID,
                                fileName: response.data.fileName,
                                message: `Item ${response.data.fileName} loaded into scene with instance ID ${response.data.instanceID}.`,
                            });
                        } else if (response.messageType === 'APIError') {
                            reject(new Error(`API Error: ${response.data.errorID} - ${response.data.message}`));
                        } else {
                            reject(new Error(`Unexpected response type: ${response.messageType}`));
                        }
                    }
                } catch (error: unknown) {
                    clearTimeout(timeout);
                    ws.removeEventListener('message', handler);
                    reject(new Error(`Failed to parse response: ${(error as Error).message || String(error)}`));
                }
            };

            ws.addEventListener('message', handler);
            ws.send(JSON.stringify(request));
        });
    }
};
