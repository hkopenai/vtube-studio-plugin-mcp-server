import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = z.object({
  unloadAllInScene: z.boolean().default(false),
  unloadAllLoadedByThisPlugin: z.boolean().default(false),
  allowUnloadingItemsLoadedByUserOrOtherPlugins: z.boolean().default(true),
  instanceIDs: z.array(z.string()).default([]),
  fileNames: z.array(z.string()).default([]),
});

export const removeItemFromScene = {
    name: 'removeItemFromScene',
    title: 'Remove Item from Scene',
    description: 'Remove items from the VTube Studio scene based on specified criteria.',
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

            const requestId = `ItemUnload-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ItemUnloadRequest',
                data: {
                    unloadAllInScene: input.unloadAllInScene,
                    unloadAllLoadedByThisPlugin: input.unloadAllLoadedByThisPlugin,
                    allowUnloadingItemsLoadedByUserOrOtherPlugins: input.allowUnloadingItemsLoadedByUserOrOtherPlugins,
                    instanceIDs: input.instanceIDs,
                    fileNames: input.fileNames,
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
                        if (response.messageType === 'ItemUnloadResponse') {
                            resolve({
                                success: true,
                                unloadedItems: response.data.unloadedItems,
                                message: `Successfully removed ${response.data.unloadedItems.length} items from the scene.`,
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
