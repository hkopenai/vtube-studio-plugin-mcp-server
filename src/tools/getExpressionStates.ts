import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const getExpressionStates = {
    name: 'getExpressionStates',
    title: 'Get Expression States',
    description: 'Retrieves the current state of expressions in the current model from VTube Studio',
    inputSchema: {
        details: z.boolean().optional().default(true).describe('Whether to include detailed information about expressions.'),
        expressionFile: z.string().optional().default('').describe('Optional specific expression file to query. If empty, all expressions are returned.')
    },
    register: function(server: any, ws: WebSocket) {
        server.registerTool(this.name, {
            title: this.title,
            description: this.description,
            inputSchema: this.inputSchema
        }, async (args: any, extra: any) => {
            const typedArgs = args as { details?: boolean; expressionFile?: string };
            const result = await this.execute(ws, typedArgs);
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
    execute: async (ws: WebSocket | null, args: { details?: boolean; expressionFile?: string } = {}) => {
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

            const requestId = 'expression-states-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ExpressionStateRequest',
                data: {
                    details: args.details !== undefined ? args.details : true,
                    expressionFile: args.expressionFile || ''
                }
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'ExpressionStateResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for expression states response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
