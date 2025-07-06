import { WebSocket } from 'ws';
import log from 'log';

export const getLive2DParameters = {
    name: 'getLive2DParameters',
    title: 'Get Live2D Parameters',
    description: 'Retrieves Live2D parameters from VTube Studio',
    inputSchema: {},
    register: function(server: any, ws: WebSocket) {
        server.registerTool(this.name, {
            title: this.title,
            description: this.description,
            inputSchema: this.inputSchema
        }, async (args: any, extra: any) => {
            const result = await this.execute(ws);
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
    execute: async (ws: WebSocket | null) => {
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

            const requestId = 'live2d-params-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'Live2DParameterListRequest'
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'Live2DParameterListResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for Live2D parameters response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
