import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = {
  strengthOverrides: z.array(z.object({
    id: z.string().optional(),
    value: z.number().min(0).max(2).default(1.0),
    setBaseValue: z.boolean().default(false),
    overrideSeconds: z.number().min(0.5).max(5).default(2),
  })).default([]),
  windOverrides: z.array(z.object({
    id: z.string().optional(),
    value: z.number().min(0).max(2).default(1.0),
    setBaseValue: z.boolean().default(false),
    overrideSeconds: z.number().min(0.5).max(5).default(2),
  })).default([]),
};

export const setCurrentModelPhysics = {
    name: 'setCurrentModelPhysics',
    title: 'Set Current Model Physics',
    description: 'Override physics settings of the currently loaded model in VTube Studio, including strength and wind values for specific groups or base settings.',
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

            const requestId = `SetPhysics-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'SetCurrentModelPhysicsRequest',
                data: {
                    strengthOverrides: input.strengthOverrides.map(override => ({
                        id: override.id || '',
                        value: override.value,
                        setBaseValue: override.setBaseValue,
                        overrideSeconds: override.overrideSeconds,
                    })),
                    windOverrides: input.windOverrides.map(override => ({
                        id: override.id || '',
                        value: override.value,
                        setBaseValue: override.setBaseValue,
                        overrideSeconds: override.overrideSeconds,
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
                        if (response.messageType === 'SetCurrentModelPhysicsResponse') {
                            resolve({
                                success: true,
                                message: 'Physics settings overridden successfully for the current model.',
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
