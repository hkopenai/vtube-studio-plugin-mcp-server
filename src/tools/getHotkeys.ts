import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const getHotkeys = {
    name: 'getHotkeys',
    title: 'Get Hotkeys',
    description: 'Retrieves the list of hotkeys available in the current or specified VTS model from VTube Studio',
    inputSchema: {
        modelID: z.string().optional().describe('Optional ID of the model to get hotkeys for. If not provided, the current model is used.'),
        live2DItemFileName: z.string().optional().describe('Optional filename of the Live2D item to get hotkeys for. Ignored if modelID is provided.')
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
    execute: async (ws: WebSocket | null, args: { modelID?: string; live2DItemFileName?: string }) => {
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

            const requestId = 'hotkeys-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'HotkeysInCurrentModelRequest',
                data: {} as { modelID?: string; live2DItemFileName?: string }
            };

            // Add optional parameters if provided
            if (args.modelID) {
                request.data.modelID = args.modelID;
            } else if (args.live2DItemFileName) {
                request.data.live2DItemFileName = args.live2DItemFileName;
            }

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'HotkeysInCurrentModelResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for hotkeys response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
