import { WebSocket } from 'ws';
import log from 'log';

export const getArtMeshList = {
    name: 'getArtMeshList',
    description: 'Get the list of ArtMeshes in the current model from VTube Studio.',
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
            // Cast to any to access readyState for ws library compatibility
            const wsAny = ws as any;
            if (wsAny.readyState !== wsAny.OPEN) {
                reject(new Error('WebSocket connection to VTube Studio is not open.'));
                return;
            }

            const requestId = 'artmesh-list-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ArtMeshListRequest'
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'ArtMeshListResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for ArtMesh list response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
