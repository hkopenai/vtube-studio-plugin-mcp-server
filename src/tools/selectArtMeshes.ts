import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = {
  textOverride: z.string().min(4).max(1024).optional(),
  helpOverride: z.string().min(4).max(1024).optional(),
  requestedArtMeshCount: z.number().default(0),
  activeArtMeshes: z.array(z.string()).default([]),
};

export const selectArtMeshes = {
    name: 'selectArtMeshes',
    title: 'Select ArtMeshes',
    description: 'Request user selection of ArtMeshes in VTube Studio for the currently loaded model.',
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
    execute: async (ws: WebSocket | null, args: { textOverride?: string; helpOverride?: string; requestedArtMeshCount: number; activeArtMeshes: string[] }) => {
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

            const requestId = `ArtMeshSelection-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ArtMeshSelectionRequest',
                data: {
                    textOverride: args.textOverride || '',
                    helpOverride: args.helpOverride || '',
                    requestedArtMeshCount: args.requestedArtMeshCount,
                    activeArtMeshes: args.activeArtMeshes,
                },
            };

            const timeout = setTimeout(() => {
                reject(new Error('Request timed out after 30 seconds.'));
            }, 30000);

            const handler = (event: any) => {
                try {
                    const response = JSON.parse(event.data);
                    if (response.requestID === requestId) {
                        clearTimeout(timeout);
                        ws.removeEventListener('message', handler);
                        if (response.messageType === 'ArtMeshSelectionResponse') {
                            resolve({
                                success: response.data.success,
                                activeArtMeshes: response.data.activeArtMeshes,
                                inactiveArtMeshes: response.data.inactiveArtMeshes,
                                message: response.data.success 
                                    ? `User selected ${response.data.activeArtMeshes.length} ArtMeshes.` 
                                    : 'User cancelled the ArtMesh selection.',
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
