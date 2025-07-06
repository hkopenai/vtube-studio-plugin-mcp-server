import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const addCustomParameter = {
    name: 'addCustomParameter',
    title: 'Add Custom Parameter',
    description: 'Adds a new custom tracking parameter to VTube Studio for use in models',
    inputSchema: {
        parameterName: z.string().min(4).max(32).regex(/^[a-zA-Z0-9]+$/).describe('Name of the new parameter (alphanumeric, 4-32 characters).'),
        explanation: z.string().max(256).optional().describe('Optional short explanation of the parameter (max 256 characters).'),
        min: z.number().min(-1000000).max(1000000).describe('Minimum value for the parameter.'),
        max: z.number().min(-1000000).max(1000000).describe('Maximum value for the parameter.'),
        defaultValue: z.number().min(-1000000).max(1000000).describe('Default value for the parameter.')
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
    execute: async (ws: WebSocket | null, args: { parameterName: string; explanation?: string; min: number; max: number; defaultValue: number }) => {
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

            const requestId = 'parameter-creation-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ParameterCreationRequest',
                data: {
                    parameterName: args.parameterName,
                    min: args.min,
                    max: args.max,
                    defaultValue: args.defaultValue
                } as { parameterName: string; explanation?: string; min: number; max: number; defaultValue: number }
            };

            // Add optional explanation if provided
            if (args.explanation) {
                request.data.explanation = args.explanation;
            }

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'ParameterCreationResponse') {
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
                reject(new Error('Timeout waiting for parameter creation response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
