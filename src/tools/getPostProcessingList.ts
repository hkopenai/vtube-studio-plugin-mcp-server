import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const getPostProcessingList = {
    name: 'getPostProcessingList',
    description: 'Retrieves the list of post-processing effects and their current state from VTube Studio.',
    inputSchema: z.object({
        fillPostProcessingPresetsArray: z.boolean().optional().describe('Optional: If true, includes the list of post-processing presets. Set to false to avoid disk I/O lag.'),
        fillPostProcessingEffectsArray: z.boolean().optional().describe('Optional: If true, includes the full list of post-processing effects and their values. Set to false to reduce response size.'),
        effectIDFilter: z.array(z.string()).optional().describe('Optional: List of effect IDs to filter the response. Leave empty to include all effects.')
    }),
    execute: async (ws: WebSocket | null, args: { fillPostProcessingPresetsArray?: boolean; fillPostProcessingEffectsArray?: boolean; effectIDFilter?: string[] }) => {
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

            const requestId = 'post-processing-list-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'PostProcessingListRequest',
                data: {
                    fillPostProcessingPresetsArray: args.fillPostProcessingPresetsArray || false,
                    fillPostProcessingEffectsArray: args.fillPostProcessingEffectsArray || false,
                    effectIDFilter: args.effectIDFilter || []
                }
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'PostProcessingListResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for post-processing list response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
