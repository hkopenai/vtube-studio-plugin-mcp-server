const WebSocket = require('ws');

const ws = new WebSocket('ws://0.0.0.0:8001');

ws.on('open', function open() {
  console.log('Connected to VTube Studio');
  const fs = require('fs');
  const tokenPath = 'auth_token.json';
  let authToken = '';
  
  // Check if token exists in storage
  if (fs.existsSync(tokenPath)) {
    try {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      authToken = tokenData.authenticationToken;
      console.log('Using stored authentication token');
      
      // Send authentication request with stored token
      const authRequest = {
        apiName: 'VTubeStudioPublicAPI',
        apiVersion: '1.0',
        requestID: 'auth-request-1',
        messageType: 'AuthenticationRequest',
        data: {
          pluginName: 'MyVTubePlugin',
          pluginDeveloper: 'DeveloperName',
          authenticationToken: authToken
        }
      };
      ws.send(JSON.stringify(authRequest));
      return;
    } catch (err) {
      console.error('Error reading stored token:', err);
    }
  }
  
  // If no token or error, request a new one
  console.log('Requesting new authentication token');
  const tokenRequest = {
    apiName: 'VTubeStudioPublicAPI',
    apiVersion: '1.0',
    requestID: 'token-request-1',
    messageType: 'AuthenticationTokenRequest',
    data: {
      pluginName: 'MyVTubePlugin',
      pluginDeveloper: 'DeveloperName'
    }
  };
  ws.send(JSON.stringify(tokenRequest));
});

ws.on('message', function incoming(data) {
  const message = JSON.parse(data);
  console.log('Received:', message);
  
  // Handle authentication token response
  if (message.messageType === 'AuthenticationTokenResponse') {
    const fs = require('fs');
    const tokenData = {
      authenticationToken: message.data.authenticationToken,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync('auth_token.json', JSON.stringify(tokenData, null, 2));
    console.log('Authentication token saved to auth_token.json');
    
    const authRequest = {
      apiName: 'VTubeStudioPublicAPI',
      apiVersion: '1.0',
      requestID: 'auth-request-1',
      messageType: 'AuthenticationRequest',
      data: {
        pluginName: 'MyVTubePlugin',
        pluginDeveloper: 'DeveloperName',
        authenticationToken: message.data.authenticationToken
      }
    };
    ws.send(JSON.stringify(authRequest));
  }
  
  // Handle authentication response
  if (message.messageType === 'AuthenticationResponse') {
    if (message.data.authenticated) {
      console.log('Authentication successful');
    } else {
      console.log('Authentication failed:', message.data.reason);
      console.log('Attempting reauthentication with a new token');
      // Request a new token if authentication fails
      const tokenRequest = {
        apiName: 'VTubeStudioPublicAPI',
        apiVersion: '1.0',
        requestID: 'token-request-retry-1',
        messageType: 'AuthenticationTokenRequest',
        data: {
          pluginName: 'MyVTubePlugin',
          pluginDeveloper: 'DeveloperName'
        }
      };
      ws.send(JSON.stringify(tokenRequest));
    }
  }
});

ws.on('close', function close() {
  console.log('Disconnected from VTube Studio');
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

console.log('Connecting to VTube Studio...');
