import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = {
  setNewConfig: z.boolean().default(false),
  ndiActive: z.boolean().default(false),
  useNDI5: z.boolean().default(true),
  useCustomResolution: z.boolean().default(false),
  customWidthNDI: z.number().min(256).max(8192).default(-1),
  customHeightNDI: z.number().min(256).max(8192).default(-1),
};

export const ndiConfig = {
    name: 'ndiConfig',
    title: 'NDI Configuration',
    description: 'Get or set NDI settings for VTube Studio streaming.',
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

            const requestId = `NDIConfig-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'NDIConfigRequest',
                data: {
                    setNewConfig: input.setNewConfig,
                    ndiActive: input.ndiActive,
                    useNDI5: input.useNDI5,
                    useCustomResolution: input.useCustomResolution,
                    customWidthNDI: input.customWidthNDI,
                    customHeightNDI: input.customHeightNDI,
                },
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
                        if (response.messageType === 'NDIConfigResponse') {
                            resolve({
                                success: true,
                                ndiSettings: {
                                    ndiActive: response.data.ndiActive,
                                    useNDI5: response.data.useNDI5,
                                    useCustomResolution: response.data.useCustomResolution,
                                    customWidthNDI: response.data.customWidthNDI,
                                    customHeightNDI: response.data.customHeightNDI,
                                },
                                message: input.setNewConfig ? 'NDI settings updated successfully.' : 'Current NDI settings retrieved successfully.',
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
