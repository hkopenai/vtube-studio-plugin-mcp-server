import { WebSocket } from 'ws';
import log from 'log';

export const controlExpression = {
    name: 'controlExpression',
    title: 'Control Expression',
    description: 'Activates or deactivates an expression in the current model in VTube Studio',
    inputSchema: {
        type: 'object',
        properties: {
            expressionFile: {
                type: 'string',
                title: 'Expression File',
                description: 'The filename of the expression to control (must end with .exp3.json).'
            },
            active: {
                type: 'boolean',
                title: 'Active',
                description: 'Whether to activate (true) or deactivate (false) the expression.'
            },
            fadeTime: {
                type: 'number',
                title: 'Fade Time',
                default: 0.25,
                description: 'The fade time in seconds for the expression change (between 0 and 2).'
            }
        },
        required: ['expressionFile', 'active']
    },
    register: function(server: any, ws: WebSocket | null) {
        server.registerTool(this.name, {
            title: this.title,
            description: this.description,
            inputSchema: this.inputSchema
        }, async (args: any, extra: any) => {
            const typedArgs = args as { expressionFile: string; active: boolean; fadeTime?: number };
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
    execute: async (ws: WebSocket | null, args: { expressionFile: string; active: boolean; fadeTime?: number }) => {
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

            // Validate expression file extension
            if (!args.expressionFile.endsWith('.exp3.json')) {
                reject(new Error('Expression file must end with .exp3.json.'));
                return;
            }

            // Validate fadeTime if provided
            const fadeTime = args.fadeTime !== undefined ? Math.max(0, Math.min(2, args.fadeTime)) : 0.25;

            const requestId = 'expression-control-request-' + Date.now();

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ExpressionActivationRequest',
                data: {
                    expressionFile: args.expressionFile,
                    active: args.active,
                    fadeTime: fadeTime
                }
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'ExpressionActivationResponse') {
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
                reject(new Error('Timeout waiting for expression control response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
