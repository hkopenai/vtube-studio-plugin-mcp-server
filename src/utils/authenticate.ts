import * as WebSocket from 'ws';
import fs from 'fs';
import log from 'log';

export function authenticate(ws: WebSocket.WebSocket | null, tokenPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!ws) {
            reject(new Error('WebSocket is not initialized.'));
            return;
        }

        let authToken = '';
        if (fs.existsSync(tokenPath)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                authToken = tokenData.authenticationToken;
                log.info('Using stored authentication token');
            } catch (err) {
                log.error('Error reading stored token: ' + String(err));
            }
        }

        const pluginName = 'VTubeStudioMCPServer';
        const pluginDeveloper = 'DeveloperName';

        if (authToken) {
            const authRequest = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: 'auth-request-1',
                messageType: 'AuthenticationRequest',
                data: {
                    pluginName: pluginName,
                    pluginDeveloper: pluginDeveloper,
                    authenticationToken: authToken
                }
            };

            ws.send(JSON.stringify(authRequest));
        } else {
            log.info('Requesting new authentication token');
            const tokenRequest = {
                apiName: 'VTubeStudioPublicAPI',
                apiVersion: '1.0',
                requestID: 'token-request-1',
                messageType: 'AuthenticationTokenRequest',
                data: {
                    pluginName: pluginName,
                    pluginDeveloper: pluginDeveloper
                }
            };
            ws.send(JSON.stringify(tokenRequest));
        }

        const handleMessage = (event: any) => {
            const message = JSON.parse(event.data.toString());
            log.debug('Received: ' + JSON.stringify(message));

            if (message.messageType === 'AuthenticationTokenResponse') {
                const tokenData = {
                    authenticationToken: message.data.authenticationToken,
                    timestamp: new Date().toISOString()
                };
                try {
                fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
                log.info('Authentication token saved to auth_token.json');
                } catch (err) {
                    log.error('Error saving token: ' + String(err));
                }

                const authRequest = {
                    apiName: 'VTubeStudioPublicAPI',
                    apiVersion: '1.0',
                    requestID: 'auth-request-1',
                    messageType: 'AuthenticationRequest',
                    data: {
                        pluginName: pluginName,
                        pluginDeveloper: pluginDeveloper,
                        authenticationToken: message.data.authenticationToken
                    }
                };
                ws.send(JSON.stringify(authRequest));
            }

            if (message.messageType === 'AuthenticationResponse') {
                ws.removeEventListener('message', handleMessage);
                if (message.data.authenticated) {
                    log.info('Authentication successful');
                    resolve();
                } else {
                    log.error('Authentication failed: ' + message.data.reason);
                    log.info('Attempting reauthentication with a new token');
                    // Delete the stored token to force a fresh request
                    if (fs.existsSync(tokenPath)) {
                        try {
                            fs.unlinkSync(tokenPath);
                            log.info('Deleted stored token to request a fresh one.');
                        } catch (err) {
                            log.error('Error deleting stored token: ' + String(err));
                        }
                    }
                    const tokenRequest = {
                        apiName: 'VTubeStudioPublicAPI',
                        apiVersion: '1.0',
                        requestID: 'token-request-retry-1',
                        messageType: 'AuthenticationTokenRequest',
                        data: {
                            pluginName: pluginName,
                            pluginDeveloper: pluginDeveloper
                        }
                    };
                    ws.send(JSON.stringify(tokenRequest));
                }
            }
        };

        ws.addEventListener('message', handleMessage);
        setTimeout(() => {
            ws.removeEventListener('message', handleMessage);
            reject(new Error('Timeout waiting for authentication response.'));
        }, 3000); // Reduced to 3 seconds based on user feedback for quick response
    });
}
