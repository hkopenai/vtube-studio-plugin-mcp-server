import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

export const controlItemAnimation = {
    name: 'controlItemAnimation',
    title: 'Control Item Animation',
    description: 'Controls aspects of items in the scene such as brightness, opacity, and animation in VTube Studio',
    inputSchema: {
        itemInstanceID: z.string().describe('Unique ID of the item instance to control'),
        framerate: z.number().default(-1).describe('Framerate for animated items (0.1 to 120, -1 to ignore)'),
        frame: z.number().default(-1).describe('Specific frame to jump to for animated items (-1 to ignore)'),
        brightness: z.number().default(-1).describe('Brightness level (0 to 1, -1 to ignore)'),
        opacity: z.number().default(-1).describe('Opacity level (0 to 1, -1 to ignore)'),
        setAutoStopFrames: z.boolean().default(false).describe('Whether to set auto stop frames for the animation'),
        autoStopFrames: z.array(z.number()).default([]).describe('Array of frame indices where animation should stop automatically'),
        setAnimationPlayState: z.boolean().default(false).describe('Whether to set the animation play state'),
        animationPlayState: z.boolean().default(false).describe('True to play animation, false to stop')
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
    execute: async (ws: WebSocket | null, args: any) => {
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

            const requestId = 'item-animation-control-request-1';

            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ItemAnimationControlRequest',
                data: {
                    itemInstanceID: args.itemInstanceID,
                    framerate: args.framerate !== undefined ? args.framerate : -1,
                    frame: args.frame !== undefined ? args.frame : -1,
                    brightness: args.brightness !== undefined ? args.brightness : -1,
                    opacity: args.opacity !== undefined ? args.opacity : -1,
                    setAutoStopFrames: args.setAutoStopFrames || false,
                    autoStopFrames: args.autoStopFrames || [],
                    setAnimationPlayState: args.setAnimationPlayState || false,
                    animationPlayState: args.animationPlayState || false
                }
            };

            const messageHandler = (event: any) => {
                let message = JSON.parse(event.data);

                if (message.requestID === requestId && message.messageType === 'ItemAnimationControlResponse') {
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
                reject(new Error('Timeout waiting for Item Animation Control response.'));
            }, 5000);

            ws.send(JSON.stringify(request));
        });
    }
};
