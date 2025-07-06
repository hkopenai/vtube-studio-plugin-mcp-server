import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = z.object({
  pin: z.boolean().default(true),
  itemInstanceID: z.string().min(1, "Item instance ID is required"),
  angleRelativeTo: z.enum(['RelativeToWorld', 'RelativeToCurrentItemRotation', 'RelativeToModel', 'RelativeToPinPosition']).default('RelativeToModel'),
  sizeRelativeTo: z.enum(['RelativeToWorld', 'RelativeToCurrentItemSize']).default('RelativeToWorld'),
  vertexPinType: z.enum(['Provided', 'Center', 'Random']).default('Provided'),
  pinInfo: z.object({
    modelID: z.string().optional(),
    artMeshID: z.string().optional(),
    angle: z.number().default(0),
    size: z.number().min(0).max(1).default(0.33),
    vertexID1: z.number().default(0),
    vertexID2: z.number().default(0),
    vertexID3: z.number().default(0),
    vertexWeight1: z.number().default(0),
    vertexWeight2: z.number().default(0),
    vertexWeight3: z.number().default(0),
  }).optional(),
});

export const pinItemToModel = {
    name: 'pinItemToModel',
    title: 'Pin Item to Model',
    description: 'Pin or unpin an item to the currently loaded model in VTube Studio with specified pinning parameters.',
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

            const requestId = `ItemPin-${Date.now()}`;
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
                    pinInfo: input.pin ? {
                        modelID: input.pinInfo?.modelID || '',
                        artMeshID: input.pinInfo?.artMeshID || '',
                        angle: input.pinInfo?.angle || 0,
                        size: input.pinInfo?.size || 0.33,
                        vertexID1: input.pinInfo?.vertexID1 || 0,
                        vertexID2: input.pinInfo?.vertexID2 || 0,
                        vertexID3: input.pinInfo?.vertexID3 || 0,
                        vertexWeight1: input.pinInfo?.vertexWeight1 || 0,
                        vertexWeight2: input.pinInfo?.vertexWeight2 || 0,
                        vertexWeight3: input.pinInfo?.vertexWeight3 || 0,
                    } : {},
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
                                message: `Item ${response.data.itemFileName} has been ${response.data.isPinned ? 'pinned' : 'unpinned'} successfully.`,
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
