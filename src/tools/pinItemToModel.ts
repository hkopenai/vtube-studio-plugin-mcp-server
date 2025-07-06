import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = z.object({
  pin: z.boolean().default(true),
  itemInstanceID: z.string(),
  angleRelativeTo: z.enum(['RelativeToWorld', 'RelativeToCurrentItemRotation', 'RelativeToModel', 'RelativeToPinPosition']).default('RelativeToModel'),
  sizeRelativeTo: z.enum(['RelativeToWorld', 'RelativeToCurrentItemSize']).default('RelativeToWorld'),
  vertexPinType: z.enum(['Provided', 'Center', 'Random']).default('Provided'),
  pinInfo: z.object({
    modelID: z.string().optional(),
    artMeshID: z.string().optional(),
    angle: z.number().default(0),
    size: z.number().default(0.33),
    vertexID1: z.number().int().optional(),
    vertexID2: z.number().int().optional(),
    vertexID3: z.number().int().optional(),
    vertexWeight1: z.number().optional(),
    vertexWeight2: z.number().optional(),
    vertexWeight3: z.number().optional(),
  }).optional(),
});

export const pinItemToModel = {
    name: 'pinItemToModel',
    title: 'Pin Item to Model',
    description: 'Pin items to the currently loaded model in VTube Studio, or unpin them, with various positioning options.',
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

            const requestId = `PinItem-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ItemPinRequest',
                data: {
                    pin: input.pin,
                    itemInstanceID: input.itemInstanceID,
                    angleRelativeTo: input.angleRelativeTo,
                    sizeRelativeTo: input.sizeRelativeTo,
                    vertexPinType: input.vertexPinType,
                    pinInfo: input.pin ? input.pinInfo || {} : {},
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
                        if (response.messageType === 'ItemPinResponse') {
                            resolve({
                                success: true,
                                isPinned: response.data.isPinned,
                                itemInstanceID: response.data.itemInstanceID,
                                itemFileName: response.data.itemFileName,
                                message: `Item ${response.data.itemFileName} with instance ID ${response.data.itemInstanceID} is ${response.data.isPinned ? 'pinned' : 'unpinned'}.`,
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
