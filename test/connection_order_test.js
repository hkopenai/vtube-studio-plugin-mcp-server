const assert = require('assert');
const sinon = require('sinon');
const { MCPServer } = require('../dist/mcp-server');

describe('MCPServer Connection and Initialization Order', () => {
    let mcpServer;
    let connectToVTubeStudioStub;
    let initializeToolsStub;

    beforeEach(() => {
        mcpServer = new MCPServer({
            name: 'test-server',
            description: 'Test MCP Server',
            version: '1.0.0',
            tools: [],
            resources: [],
            storeToken: false
        });

        connectToVTubeStudioStub = sinon.stub(mcpServer, 'connectToVTubeStudio').resolves();
        initializeToolsStub = sinon.stub(mcpServer, 'initializeTools');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should call initializeTools after connectToVTubeStudio completes', async () => {
        await mcpServer.start();

        assert(connectToVTubeStudioStub.calledOnce, 'connectToVTubeStudio should be called once');
        assert(initializeToolsStub.calledOnce, 'initializeTools should be called once');
        assert(connectToVTubeStudioStub.calledBefore(initializeToolsStub), 'connectToVTubeStudio should be called before initializeTools');
    });
});
