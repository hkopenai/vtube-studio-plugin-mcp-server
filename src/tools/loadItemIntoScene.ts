import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = z.object({
  fileName: z.string().min(8).max(32).regex(/^[a-zA-Z0-9-]+\.(jpg|png|gif)$/, 'File name must be alphanumeric with hyphens and end with .jpg, .png, or .gif'),
  positionX: z.number().min(-1000).max(1000).default(0),
  positionY: z.number().min(-1000).max(1000).default(0.5),
  size: z.number().min(0).max(1).default(0.33),
  rotation: z.number().default(90),
  fadeTime: z.number().min(0).max(2).default(0.5),
  order: z.number().int().default(4),
  failIfOrderTaken: z.boolean().default(false),
  smoothing: z.number().min(0).max(1).default(0),
  censored: z.boolean().default(false),
  flipped: z.boolean().default(false),
  locked: z.boolean().default(false),
  unloadWhenPluginDisconnects: z.boolean().default(true),
  customDataBase64: z.string().optional(),
  customDataAskUserFirst: z.boolean().default(true),
  customDataSkipAskingUserIfWhitelisted: z.boolean().default(true),
  customDataAskTimer: z.number().int().default(-1),
});

export const loadItemIntoScene = {
    name: 'loadItemIntoScene',
    title: 'Load Item into Scene',
    description: 'Load an item into the VTube Studio scene from the Items folder or as custom data.',
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
    execute: async (ws: WebSocket | null, input: z.infer<typeof inputSchema>) => {
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

            const requestId = `LoadItem-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ItemLoadRequest',
                data: {
                    fileName: input.fileName,
                    positionX: input.positionX,
                    positionY: input.positionY,
                    size: input.size,
                    rotation: input.rotation,
                    fadeTime: input.fadeTime,
                    order: input.order,
                    failIfOrderTaken: input.failIfOrderTaken,
                    smoothing: input.smoothing,
                    censored: input.censored,
                    flipped: input.flipped,
                    locked: input.locked,
                    unloadWhenPluginDisconnects: input.unloadWhenPluginDisconnects,
                    customDataBase64: input.customDataBase64 || '',
                    customDataAskUserFirst: input.customDataAskUserFirst,
                    customDataSkipAskingUserIfWhitelisted: input.customDataSkipAskingUserIfWhitelisted,
                    customDataAskTimer: input.customDataAskTimer,
                },
            };

            const timeout = setTimeout(() => {
                reject(new Error('Request timed out after 10 seconds.'));
            }, 10000);

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
                                message: `Item ${response.data.fileName} loaded successfully with instance ID ${response.data.instanceID}.`,
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
