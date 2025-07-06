import { WebSocket } from 'ws';
import log from 'log';
import { z } from "zod";

export const triggerHotkey = {
    name: 'triggerHotkey',
    title: 'Trigger Hotkey',
    description: 'Triggers a hotkey in the current VTube Studio model',
    inputSchema: {
        hotkeyID: z.string().describe('The ID or name of the hotkey to trigger.'),
        itemInstanceID: z.string().optional().describe('Optional: The instance ID of the Live2D item to trigger the hotkey for.'),
    },
    register: function(server: any, ws: WebSocket) {
        server.registerTool(this.name, {
            title: this.title,
            description: this.description,
            inputSchema: this.inputSchema
        }, async (args: any, extra: any) => {
            const typedArgs = args as { hotkeyID: string; itemInstanceID?: string };
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
    execute: async (ws: WebSocket | null, args: { hotkeyID: string; itemInstanceID?: string }) => {
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

            const requestId = 'hotkey-trigger-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'HotkeyTriggerRequest',
                data: {
                    hotkeyID: args.hotkeyID,
                    itemInstanceID: args.itemInstanceID || ''
                }
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'HotkeyTriggerResponse') {
                    ws.removeEventListener('message', messageHandler);
                    resolve(message.data);
                }
            };

            ws.addEventListener('message', messageHandler);
            setTimeout(() => {
                ws.removeEventListener('message', messageHandler);
                reject(new Error('Timeout waiting for hotkey trigger response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
