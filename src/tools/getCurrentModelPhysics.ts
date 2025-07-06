import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = z.object({});

export const getCurrentModelPhysics = {
    name: 'getCurrentModelPhysics',
    title: 'Get Current Model Physics',
    description: 'Retrieve the physics settings of the currently loaded model in VTube Studio, including base strength, wind, and group-specific multipliers.',
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
    execute: async (ws: WebSocket | null, input: z.infer<typeof inputSchema>) => {
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

            const requestId = `GetPhysics-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'GetCurrentModelPhysicsRequest',
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
                        if (response.messageType === 'GetCurrentModelPhysicsResponse') {
                            resolve({
                                success: true,
                                modelLoaded: response.data.modelLoaded,
                                modelName: response.data.modelName,
                                modelID: response.data.modelID,
                                modelHasPhysics: response.data.modelHasPhysics,
                                physicsSwitchedOn: response.data.physicsSwitchedOn,
                                usingLegacyPhysics: response.data.usingLegacyPhysics,
                                physicsFPSSetting: response.data.physicsFPSSetting,
                                baseStrength: response.data.baseStrength,
                                baseWind: response.data.baseWind,
                                apiPhysicsOverrideActive: response.data.apiPhysicsOverrideActive,
                                apiPhysicsOverridePluginName: response.data.apiPhysicsOverridePluginName,
                                physicsGroups: response.data.physicsGroups,
                                message: `Retrieved physics settings for ${response.data.modelName || 'no model loaded'}.`,
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
