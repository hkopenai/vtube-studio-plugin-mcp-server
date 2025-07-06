import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = z.object({
  colorTint: z.object({
    colorR: z.number().min(0).max(255).default(255),
    colorG: z.number().min(0).max(255).default(255),
    colorB: z.number().min(0).max(255).default(255),
    colorA: z.number().min(0).max(255).default(255),
    mixWithSceneLightingColor: z.number().min(0).max(1).default(1),
  }),
  artMeshMatcher: z.object({
    tintAll: z.boolean().default(false),
    artMeshNumber: z.array(z.number()).default([]),
    nameExact: z.array(z.string()).default([]),
    nameContains: z.array(z.string()).default([]),
    tagExact: z.array(z.string()).default([]),
    tagContains: z.array(z.string()).default([]),
  }),
});

export const tintArtMeshes = {
    name: 'tintArtMeshes',
    title: 'Tint ArtMeshes',
    description: 'Tint ArtMeshes in VTube Studio with a specified color based on matching criteria.',
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

            const requestId = `ColorTint-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'ColorTintRequest',
                data: {
                    colorTint: {
                        colorR: input.colorTint.colorR,
                        colorG: input.colorTint.colorG,
                        colorB: input.colorTint.colorB,
                        colorA: input.colorTint.colorA,
                        mixWithSceneLightingColor: input.colorTint.mixWithSceneLightingColor,
                    },
                    artMeshMatcher: {
                        tintAll: input.artMeshMatcher.tintAll,
                        artMeshNumber: input.artMeshMatcher.artMeshNumber,
                        nameExact: input.artMeshMatcher.nameExact,
                        nameContains: input.artMeshMatcher.nameContains,
                        tagExact: input.artMeshMatcher.tagExact,
                        tagContains: input.artMeshMatcher.tagContains,
                    },
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
                        if (response.messageType === 'ColorTintResponse') {
                            resolve({
                                success: true,
                                matchedArtMeshes: response.data.matchedArtMeshes,
                                message: `Successfully tinted ${response.data.matchedArtMeshes} ArtMeshes with the specified color.`,
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
