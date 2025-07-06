import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = {
  eventName: z.string().min(1, "Event name is required"),
  subscribe: z.boolean().default(true),
  config: z.object({
    // Placeholder for event-specific configuration
    // This can be expanded based on detailed event documentation
    key: z.string().optional(),
    value: z.any().optional(),
  }).optional(),
};

export const subscribeToEvents = {
    name: 'subscribeToEvents',
    title: 'Subscribe to Events',
    description: 'Subscribe to or unsubscribe from events in VTube Studio to receive notifications on specific actions or changes.',
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
    execute: async (ws: WebSocket | null, args: { eventName: string; subscribe: boolean; config?: { key?: string; value?: any } }) => {
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

            const requestId = `EventSubscription-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: args.subscribe ? 'EventSubscriptionRequest' : 'EventUnsubscriptionRequest',
                data: {
                    eventName: args.eventName,
                    config: args.config || {},
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
                        if (response.messageType === (args.subscribe ? 'EventSubscriptionResponse' : 'EventUnsubscriptionResponse')) {
                            resolve({
                                success: true,
                                eventName: args.eventName,
                                subscribed: args.subscribe,
                                message: `Successfully ${args.subscribe ? 'subscribed to' : 'unsubscribed from'} event: ${args.eventName}.`,
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
