import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const moveModel = {
    name: 'moveModel',
    title: 'Move VTS Model',
    description: 'Changes the position, rotation, and size of the currently loaded VTube Studio model',
    inputSchema: {
        timeInSeconds: z.number().min(0).max(2).describe('Time in seconds for the movement to take (0 for instant).'),
        valuesAreRelativeToModel: z.boolean().describe('Whether the provided values are relative to the current model position.'),
        positionX: z.number().min(-1000).max(1000).optional().describe('X position to move the model to (optional).'),
        positionY: z.number().min(-1000).max(1000).optional().describe('Y position to move the model to (optional).'),
        rotation: z.number().min(-360).max(360).optional().describe('Rotation angle in degrees (optional).'),
        size: z.number().min(-100).max(100).optional().describe('Size of the model (optional).')
    },
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
    execute: async (ws: WebSocket | null, args: { timeInSeconds: number; valuesAreRelativeToModel: boolean; positionX?: number; positionY?: number; rotation?: number; size?: number }) => {
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

            const requestId = 'model-move-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'MoveModelRequest',
                data: {
                    timeInSeconds: args.timeInSeconds,
                    valuesAreRelativeToModel: args.valuesAreRelativeToModel
                } as { timeInSeconds: number; valuesAreRelativeToModel: boolean; positionX?: number; positionY?: number; rotation?: number; size?: number }
            };

            // Add optional parameters if provided
            if (args.positionX !== undefined) {
                request.data.positionX = args.positionX;
            }
            if (args.positionY !== undefined) {
                request.data.positionY = args.positionY;
            }
            if (args.rotation !== undefined) {
                request.data.rotation = args.rotation;
            }
            if (args.size !== undefined) {
                request.data.size = args.size;
            }

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'MoveModelResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                } else if (message.requestID === requestId && message.messageType === 'APIError') {
                    ws.removeEventListener('message', messageHandler);
                    reject(new Error(`API Error: ${message.data.message}`));
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for model move response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
