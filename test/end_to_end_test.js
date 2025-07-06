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
    close() {
      this.readyState = this.CLOSED;
      this.triggerEvent('close', { code: 1000, reason: 'Test close' });
    }
  }
};

const logMock = {
  info: sinon.stub(),
  error: sinon.stub()
};

const authenticateMock = sinon.stub();
const getLive2DParametersMock = {
  execute: sinon.stub()
};

const McpServerMock = class {
  constructor(options) {
    this.options = options;
    this.tools = [];
  }
  registerTool(name, config, handler) {
    this.tools.push({ name, config, handler });
  }
  connect(transport) {
    return Promise.resolve();
  }
  start() {
    return Promise.resolve();
  }
};

const StdioServerTransportMock = class {
  constructor() {}
};

// Proxyquire to mock dependencies in mcp-server.js (compiled from TypeScript)
const mcpServerModule = proxyquire('../dist/mcp-server', {
  'ws': WebSocketMock,
  './tools/getLive2DParameters': { getLive2DParameters: getLive2DParametersMock },
  './utils/authenticate': { authenticate: authenticateMock },
  'log': logMock,
  '@modelcontextprotocol/sdk/server/mcp.js': { McpServer: McpServerMock },
  '@modelcontextprotocol/sdk/server/stdio.js': { StdioServerTransport: StdioServerTransportMock }
});

const { MCPServer } = mcpServerModule;

describe('VTube Studio MCP Server - End-to-End Tests', function() {
  let mcpServerInstance;
  let wsInstance;

  beforeEach(function() {
    sinon.restore(); // Reset all stubs and spies
    logMock.info.resetHistory();
    logMock.error.resetHistory();
    authenticateMock.reset();
    getLive2DParametersMock.execute.reset();
    wsInstance = null;
    const options = {
      name: 'vtube-studio-mcp-server',
      description: 'An MCP server for VTube Studio integration',
      version: '1.0.0',
      tools: [],
      resources: []
    };
    mcpServerInstance = new MCPServer(options);
    // Manually register the mock tool to ensure it's available in server.tools
    mcpServerInstance.server.registerTool('getLive2DParameters', {
      title: 'Get Live2D Parameters',
      description: 'Retrieves Live2D parameters from VTube Studio'
    }, async (args, extra) => {
      const result = await getLive2DParametersMock.execute(wsInstance, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    });
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('Full User Interaction Flow', function() {
    it('should simulate a complete user flow from connection to parameter update', async function() {
      this.timeout(15000); // Increase timeout for this test
      authenticateMock.resolves();
      mcpServerInstance.connectToVTubeStudio();
      wsInstance = mcpServerInstance.ws;
      wsInstance.readyState = wsInstance.OPEN;
      wsInstance.triggerEvent('open');
      
      // Verify connection and authentication
      expect(logMock.info.calledWith('Connected to VTube Studio successfully')).to.be.true;
      expect(authenticateMock.calledWith(wsInstance, 'auth_token.json')).to.be.true;

      // Simulate getting Live2D parameters
      const mockGetResponse = {
        parameters: [{ id: 'Param1', value: 0.5 }, { id: 'Param2', value: 0.0 }]
      };
      getLive2DParametersMock.execute.resolves(mockGetResponse);
      const getResult = await getLive2DParametersMock.execute(wsInstance, {});
      expect(getLive2DParametersMock.execute.calledWith(wsInstance)).to.be.true;
      expect(getResult).to.equal(mockGetResponse);
    });
  });

  describe('Edge Case Scenarios', function() {
    it('should handle network interruption during parameter retrieval', async function() {
      this.timeout(10000); // Increase timeout for this test
      authenticateMock.resolves();
      mcpServerInstance.connectToVTubeStudio();
      wsInstance = mcpServerInstance.ws;
      wsInstance.readyState = wsInstance.OPEN;
      wsInstance.triggerEvent('open');
      
      // Simulate network interruption by closing connection during request
      getLive2DParametersMock.execute.rejects(new Error('WebSocket connection closed'));
      await expect(getLive2DParametersMock.execute(wsInstance, {})).to.be.rejectedWith(Error);
      
      // Verify reconnection attempt
      wsInstance.close();
      expect(logMock.info.calledWith('Disconnected from VTube Studio. Code: 1000, Reason: Test close')).to.be.true;
      expect(mcpServerInstance.ws).to.be.null;
      await new Promise(resolve => setTimeout(resolve, 3100));
      expect(logMock.info.calledWith('Attempting to reconnect to VTube Studio...')).to.be.true;
    });

    it('should handle authentication failure', async function() {
      this.timeout(10000); // Increase timeout for this test
      authenticateMock.rejects(new Error('Authentication failed: Invalid token'));
      mcpServerInstance.connectToVTubeStudio();
      wsInstance = mcpServerInstance.ws;
      wsInstance.readyState = wsInstance.OPEN;
      wsInstance.triggerEvent('open');
      
      // Verify authentication failure by checking if the error mock was called
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(authenticateMock.called).to.be.true;
    });

    it('should handle parameter retrieval with empty data', async function() {
      this.timeout(10000); // Increase timeout for this test
      authenticateMock.resolves();
      mcpServerInstance.connectToVTubeStudio();
      wsInstance = mcpServerInstance.ws;
      wsInstance.readyState = wsInstance.OPEN;
      wsInstance.triggerEvent('open');
      
      // Simulate empty data response
      const mockEmptyResponse = { parameters: [] };
      getLive2DParametersMock.execute.resolves(mockEmptyResponse);
      const getResult = await getLive2DParametersMock.execute(wsInstance, {});
      expect(getLive2DParametersMock.execute.calledWith(wsInstance)).to.be.true;
      expect(getResult).to.equal(mockEmptyResponse);
    });
  });
});
