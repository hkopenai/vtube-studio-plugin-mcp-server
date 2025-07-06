// Use chai-as-promised for async assertions
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');

chai.use(chaiAsPromised);

// Mock dependencies
const WebSocketMock = {
  WebSocket: class {
    constructor(url) {
      this.url = url;
      this.readyState = 0; // CONNECTING
      this.OPEN = 1;
      this.CLOSED = 3;
      this.listeners = {};
    }
    addEventListener(event, callback) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(callback);
    }
    removeEventListener(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    }
    triggerEvent(event, ...args) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => callback(...args));
      }
    }
    send(data) {
      // Simulate sending data, can be spied on
      return data;
    }
  }
};

const logMock = {
  info: sinon.stub(),
  error: sinon.stub()
};

// Proxyquire to mock dependencies in getLive2DParameters.js (compiled from TypeScript)
const getLive2DParametersModule = proxyquire('../dist/tools/getLive2DParameters', {
  'ws': WebSocketMock,
  'log': logMock
});

const { getLive2DParameters } = getLive2DParametersModule;

describe('VTube Studio MCP Server - Get Live2D Parameters Tool', function() {
  let wsInstance;
  let sendSpy;

  beforeEach(function() {
    sinon.restore(); // Reset all stubs and spies
    logMock.info.resetHistory();
    logMock.error.resetHistory();
    wsInstance = new WebSocketMock.WebSocket('ws://0.0.0.0:8001');
    sendSpy = sinon.spy(wsInstance, 'send');
  });

  afterEach(function() {
    sinon.restore();
  });

  it('should have correct tool name and description', function() {
    expect(getLive2DParameters.name).to.equal('getLive2DParameters');
    expect(getLive2DParameters.description).to.equal('Get the value for all Live2D parameters in the current model from VTube Studio.');
  });

  it('should have correct input schema', function() {
    expect(getLive2DParameters.inputSchema.type).to.equal('object');
    expect(getLive2DParameters.inputSchema.properties).to.be.an('object').that.is.empty;
    expect(getLive2DParameters.inputSchema.required).to.be.an('array').that.is.empty;
  });

  describe('Execute Method', function() {
    it('should reject if WebSocket is null', async function() {
      await expect(getLive2DParameters.execute(null)).to.be.rejectedWith(Error, 'WebSocket connection to VTube Studio is not open.');
    });

    it('should reject if WebSocket is not in OPEN state', async function() {
      wsInstance.readyState = wsInstance.CLOSED;
      await expect(getLive2DParameters.execute(wsInstance)).to.be.rejectedWith(Error, 'WebSocket connection to VTube Studio is not open.');
    });

    it('should send Live2DParameterListRequest when WebSocket is open', async function() {
      this.timeout(10000); // Increase timeout for this test
      wsInstance.readyState = wsInstance.OPEN;
      // Execute and catch to prevent unhandled rejection, we just want to test send
      getLive2DParameters.execute(wsInstance).catch(() => {});
      
      // Wait briefly to ensure send is called
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(sendSpy.calledOnce).to.be.true;
      const sentData = JSON.parse(sendSpy.firstCall.args[0]);
      expect(sentData.apiName).to.equal('VTubeStudioPublicAPI');
      expect(sentData.apiVersion).to.equal('1.0');
      expect(sentData.requestID).to.equal('live2d-params-request-1');
      expect(sentData.messageType).to.equal('Live2DParameterListRequest');
    });

    it('should resolve with data on receiving Live2DParameterListResponse', async function() {
      wsInstance.readyState = wsInstance.OPEN;
      const mockResponse = {
        apiName: 'VTubeStudioPublicAPI',
        apiVersion: '1.0',
        requestID: 'live2d-params-request-1',
        messageType: 'Live2DParameterListResponse',
        data: {
          parameters: [{ id: 'Param1', value: 0.5 }]
        }
      };
      
      // Execute and simulate response
      const executePromise = getLive2DParameters.execute(wsInstance);
      // Simulate receiving message
      wsInstance.triggerEvent('message', { data: JSON.stringify(mockResponse) });
      
      const result = await executePromise;
      expect(result).to.deep.equal(mockResponse.data);
    });

    it('should reject on timeout if no response is received', async function() {
      this.timeout(10000); // Increase timeout for this test
      wsInstance.readyState = wsInstance.OPEN;
      await expect(getLive2DParameters.execute(wsInstance)).to.be.rejectedWith(Error, 'Timeout waiting for Live2D parameters response.');
    });
  });
});
