import { WebSocket } from 'ws';

export const getLive2DParameters = {
    name: 'getLive2DParameters',
    description: 'Get the value for all Live2D parameters in the current model from VTube Studio.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: []
    },
    execute: async (ws: WebSocket | null) => {
        return new Promise((resolve, reject) => {
            if (!ws) {
                reject(new Error('WebSocket connection to VTube Studio is not open.'));
                return;
            }

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: 'live2d-params-request-1',
                messageType: 'Live2DParameterListRequest',
                data: {}
            };

            ws.send(JSON.stringify(request));

            const messageHandler = (data: any) => {
                const message = JSON.parse(data.toString());
                if (message.requestID === 'live2d-params-request-1' && message.messageType === 'Live2DParameterListResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for Live2D parameters response.'));
            }, 5000);
        });
    }
};
