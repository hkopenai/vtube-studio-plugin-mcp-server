import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = z.object({
  itemsToMove: z.array(z.object({
    itemInstanceID: z.string(),
    timeInSeconds: z.number().min(0).max(30).default(1),
    fadeMode: z.enum(['linear', 'easeIn', 'easeOut', 'easeBoth', 'overshoot', 'zip']).default('easeOut'),
    positionX: z.number().default(0.2),
    positionY: z.number().default(-0.8),
    size: z.number().default(0.6),
    rotation: z.number().default(180),
    order: z.number().int().default(-1000),
    setFlip: z.boolean().default(true),
    flip: z.boolean().default(false),
    userCanStop: z.boolean().default(true),
  })).max(64),
});

export const moveItemInScene = {
    name: 'moveItemInScene',
    title: 'Move Item in Scene',
    description: 'Move items within the VTube Studio scene, adjusting position, size, rotation, and other properties.',
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

            const requestId = `MoveItem-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ItemMoveRequest',
                data: {
                    itemsToMove: input.itemsToMove.map(item => ({
                        itemInstanceID: item.itemInstanceID,
                        timeInSeconds: item.timeInSeconds,
                        fadeMode: item.fadeMode,
                        positionX: item.positionX,
                        positionY: item.positionY,
                        size: item.size,
                        rotation: item.rotation,
                        order: item.order,
                        setFlip: item.setFlip,
                        flip: item.flip,
                        userCanStop: item.userCanStop,
                    })),
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
                        if (response.messageType === 'ItemMoveResponse') {
                            resolve({
                                success: true,
                                movedItems: response.data.movedItems,
                                message: `Successfully processed move request for ${response.data.movedItems.length} item(s).`,
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
