import * as WebSocket from 'ws';
import fs from 'fs';

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
                console.log('Using stored authentication token');
            } catch (err) {
                console.error('Error reading stored token:', err);
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
            console.log('Requesting new authentication token');
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
            console.log('Received:', message);

            if (message.messageType === 'AuthenticationTokenResponse') {
                const tokenData = {
                    authenticationToken: message.data.authenticationToken,
                    timestamp: new Date().toISOString()
                };
                try {
                    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
                    console.log('Authentication token saved to auth_token.json');
                } catch (err) {
                    console.error('Error saving token:', err);
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
                    console.log('Authentication successful');
                    resolve();
                } else {
                    console.log('Authentication failed:', message.data.reason);
                    console.log('Attempting reauthentication with a new token');
                    // Delete the stored token to force a fresh request
                    if (fs.existsSync(tokenPath)) {
                        try {
                            fs.unlinkSync(tokenPath);
                            console.log('Deleted stored token to request a fresh one.');
                        } catch (err) {
                            console.error('Error deleting stored token:', err);
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
