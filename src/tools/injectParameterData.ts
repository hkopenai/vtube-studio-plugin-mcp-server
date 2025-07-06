import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const injectParameterData = {
    name: 'injectParameterData',
    title: 'Inject Parameter Data',
    description: 'Feeds data into default or custom parameters in VTube Studio for model control',
    inputSchema: {
        faceFound: z.boolean().optional().describe('Whether to consider the face as found (optional).'),
        mode: z.enum(['set', 'add']).default('set').describe('Mode of operation: "set" to override, "add" to add to current value.'),
        parameterValues: z.array(z.object({
            id: z.string().describe('Parameter ID to set value for.'),
            value: z.number().min(-1000000).max(1000000).describe('Value to set for the parameter.'),
            weight: z.number().min(0).max(1).optional().describe('Weight for mixing with face tracking value (0-1, optional, default 1).')
        })).describe('Array of parameter values to inject.')
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
    execute: async (ws: WebSocket | null, args: { faceFound?: boolean; mode: 'set' | 'add'; parameterValues: Array<{ id: string; value: number; weight?: number }> }) => {
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

            const requestId = 'inject-parameter-data-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'InjectParameterDataRequest',
                data: {
                    mode: args.mode,
                    parameterValues: args.parameterValues
                } as { faceFound?: boolean; mode: 'set' | 'add'; parameterValues: Array<{ id: string; value: number; weight?: number }> }
            };

            // Add optional faceFound if provided
            if (args.faceFound !== undefined) {
                request.data.faceFound = args.faceFound;
            }

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'InjectParameterDataResponse') {
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
                reject(new Error('Timeout waiting for inject parameter data response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
