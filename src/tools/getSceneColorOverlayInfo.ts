import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = {};

export const getSceneColorOverlayInfo = {
    name: 'getSceneColorOverlayInfo',
    title: 'Get Scene Color Overlay Info',
    description: 'Retrieve the current configuration and color information for the scene lighting overlay system in VTube Studio.',
    inputSchema: inputSchema,
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
    execute: async (ws: WebSocket | null, args: {}) => {
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

            const requestId = `SceneColorOverlayInfo-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'SceneColorOverlayInfoRequest',
                data: {}
            };

            const timeout = setTimeout(() => {
                reject(new Error('Request timed out after 10 seconds.'));
            }, 10000);

            const handler = (event: any) => {
                try {
                    const response = JSON.parse(event.data);
                    if (response.requestID === requestId) {
                        clearTimeout(timeout);
                        ws.removeEventListener('message', handler);
                        if (response.messageType === 'SceneColorOverlayInfoResponse') {
                            resolve({
                                success: true,
                                active: response.data.active,
                                itemsIncluded: response.data.itemsIncluded,
                                isWindowCapture: response.data.isWindowCapture,
                                baseBrightness: response.data.baseBrightness,
                                colorBoost: response.data.colorBoost,
                                smoothing: response.data.smoothing,
                                colorOverlay: {
                                    r: response.data.colorOverlayR,
                                    g: response.data.colorOverlayG,
                                    b: response.data.colorOverlayB
                                },
                                colorAvg: {
                                    r: response.data.colorAvgR,
                                    g: response.data.colorAvgG,
                                    b: response.data.colorAvgB
                                },
                                leftCapturePart: {
                                    active: response.data.leftCapturePart.active,
                                    color: {
                                        r: response.data.leftCapturePart.colorR,
                                        g: response.data.leftCapturePart.colorG,
                                        b: response.data.leftCapturePart.colorB
                                    }
                                },
                                middleCapturePart: {
                                    active: response.data.middleCapturePart.active,
                                    color: {
                                        r: response.data.middleCapturePart.colorR,
                                        g: response.data.middleCapturePart.colorG,
                                        b: response.data.middleCapturePart.colorB
                                    }
                                },
                                rightCapturePart: {
                                    active: response.data.rightCapturePart.active,
                                    color: {
                                        r: response.data.rightCapturePart.colorR,
                                        g: response.data.rightCapturePart.colorG,
                                        b: response.data.rightCapturePart.colorB
                                    }
                                },
                                message: 'Scene color overlay information retrieved successfully.'
                            });
                        } else if (response.messageType === 'APIError') {
                            reject(new Error(`API Error: ${response.data.errorID} - ${response.data.message}`));
                        } else {
                            reject(new Error(`Unexpected response type: ${response.messageType}`));
                        }
                    }
                } catch (error: unknown) {
                    clearTimeout(timeout);
                    ws.removeEventListener('message', handler);
                    reject(new Error(`Failed to parse response: ${(error as Error).message || String(error)}`));
                }
            };

            ws.addEventListener('message', handler);
            ws.send(JSON.stringify(request));
        });
    }
};
