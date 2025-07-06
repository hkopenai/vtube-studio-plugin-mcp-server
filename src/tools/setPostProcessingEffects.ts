import { WebSocket } from 'ws';
import log from 'log';
import { z } from 'zod';

const inputSchema = {
  postProcessingOn: z.boolean().default(true),
  setPostProcessingPreset: z.boolean().default(false),
  setPostProcessingValues: z.boolean().default(false),
  presetToSet: z.string().optional(),
  postProcessingFadeTime: z.number().min(0).max(2).default(0),
  setAllOtherValuesToDefault: z.boolean().default(false),
  usingRestrictedEffects: z.boolean().default(false),
  randomizeAll: z.boolean().default(false),
  randomizeAllChaosLevel: z.number().min(0).max(1).default(0.4),
  postProcessingValues: z.array(
    z.object({
      configID: z.string().min(1, "Config ID is required"),
      configValue: z.string().min(1, "Config value is required"),
    })
  ).default([]),
};

export const setPostProcessingEffects = {
    name: 'setPostProcessingEffects',
    title: 'Set Post-Processing Effects',
    description: 'Control post-processing effects in VTube Studio, including turning effects on/off, loading presets, or setting individual config values.',
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
    execute: async (ws: WebSocket | null, args: { postProcessingOn: boolean; setPostProcessingPreset: boolean; setPostProcessingValues: boolean; presetToSet?: string; postProcessingFadeTime: number; setAllOtherValuesToDefault: boolean; usingRestrictedEffects: boolean; randomizeAll: boolean; randomizeAllChaosLevel: number; postProcessingValues: Array<{ configID: string; configValue: string }> }) => {
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

            const requestId = `PostProcessingUpdate-${Date.now()}`;
            const request = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: requestId,
                messageType: 'PostProcessingUpdateRequest',
                data: {
                    postProcessingOn: args.postProcessingOn,
                    setPostProcessingPreset: args.setPostProcessingPreset,
                    setPostProcessingValues: args.setPostProcessingValues,
                    presetToSet: args.presetToSet || '',
                    postProcessingFadeTime: args.postProcessingFadeTime,
                    setAllOtherValuesToDefault: args.setAllOtherValuesToDefault,
                    usingRestrictedEffects: args.usingRestrictedEffects,
                    randomizeAll: args.randomizeAll,
                    randomizeAllChaosLevel: args.randomizeAllChaosLevel,
                    postProcessingValues: args.postProcessingValues.map(value => ({
                        configID: value.configID,
                        configValue: value.configValue,
                    })),
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
                        if (response.messageType === 'PostProcessingUpdateResponse') {
                            resolve({
                                success: true,
                                postProcessingActive: response.data.postProcessingActive,
                                presetIsActive: response.data.presetIsActive,
                                activePreset: response.data.activePreset,
                                activeEffectCount: response.data.activeEffectCount,
                                message: 'Post-processing effects updated successfully.',
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
