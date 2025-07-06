const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');

// Mock WebSocket message for testing
const mockMessage = {
  apiName: 'VTubeStudioPublicAPI',
  apiVersion: '1.0',
  timestamp: Date.now(),
  messageType: 'AuthenticationTokenResponse',
  requestID: 'token-request-1',
  data: {
    authenticationToken: 'test-token-1234567890'
  }
};

// Function to simulate receiving a message and saving the token
function handleMessage(data) {
  const message = JSON.parse(data);
  if (message.messageType === 'AuthenticationTokenResponse') {
    const tokenData = {
      authenticationToken: message.data.authenticationToken,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync('auth_token.json', JSON.stringify(tokenData, null, 2));
    return true;
  }
  return false;
}

describe('Token Storage', function() {
  beforeEach(function() {
    // Clean up any existing token file before each test
    const tokenPath = path.join(__dirname, '..', 'auth_token.json');
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
  });

  it('should save the authentication token to a file', function() {
    const result = handleMessage(JSON.stringify(mockMessage));
    expect(result).to.be.true;

    const tokenPath = path.join(__dirname, '..', 'auth_token.json');
    expect(fs.existsSync(tokenPath)).to.be.true;

    const savedData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    expect(savedData.authenticationToken).to.equal(mockMessage.data.authenticationToken);
    expect(savedData.timestamp).to.be.a('string');
  });

  it('should not save token for unrelated message types', function() {
    const unrelatedMessage = { ...mockMessage, messageType: 'UnrelatedMessage' };
    const result = handleMessage(JSON.stringify(unrelatedMessage));
    expect(result).to.be.false;

    const tokenPath = path.join(__dirname, '..', 'auth_token.json');
    expect(fs.existsSync(tokenPath)).to.be.false;
  });

  it('should reuse token from storage if it exists', function() {
    // First, save a token to storage
    handleMessage(JSON.stringify(mockMessage));
    const tokenPath = path.join(__dirname, '..', 'auth_token.json');
    expect(fs.existsSync(tokenPath)).to.be.true;

    // Function to simulate checking for existing token
    function checkForExistingToken() {
      const fs = require('fs');
      const tokenPath = 'auth_token.json';
      if (fs.existsSync(tokenPath)) {
        try {
          const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
          return tokenData.authenticationToken;
        } catch (err) {
          return '';
        }
      }
      return '';
    }

    const storedToken = checkForExistingToken();
    expect(storedToken).to.equal(mockMessage.data.authenticationToken);
  });

  it('should request new token on authentication failure', function() {
    // Mock authentication failure response
    const authFailureMessage = {
      apiName: 'VTubeStudioPublicAPI',
      apiVersion: '1.0',
      timestamp: Date.now(),
      messageType: 'AuthenticationResponse',
      requestID: 'auth-request-1',
      data: {
        authenticated: false,
        reason: 'Invalid token'
      }
    };

    // Function to simulate handling authentication response
    let requestedNewToken = false;
    function handleAuthResponse(data) {
      const message = JSON.parse(data);
      if (message.messageType === 'AuthenticationResponse') {
        if (!message.data.authenticated) {
          requestedNewToken = true;
        }
      }
      return requestedNewToken;
    }

    const result = handleAuthResponse(JSON.stringify(authFailureMessage));
    expect(result).to.be.true;
  });
});
