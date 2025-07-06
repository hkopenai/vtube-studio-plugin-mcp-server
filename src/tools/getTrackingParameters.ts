import { WebSocket } from 'ws';
import log from 'log';

export const getTrackingParameters = {
    name: 'getTrackingParameters',
    description: 'Retrieves a list of available tracking parameters from VTube Studio, including both default and custom parameters.',
    inputSchema: {},
    execute: async (ws: WebSocket | null, args: Record<string, never>) => {
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

            const requestId = 'tracking-parameters-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'InputParameterListRequest',
                data: {}
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'InputParameterListResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for tracking parameters response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
