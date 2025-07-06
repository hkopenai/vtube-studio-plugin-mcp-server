# Tech Context: VTuber Plugin

## Technologies Used
- **TypeScript**: The primary programming language for the project, providing type safety and modern JavaScript features for robust development.
- **Node.js**: The runtime environment for executing the plugin's backend logic and tools, essential for server-side operations.
- **WebSocket (WS)**: Used for real-time communication with VTube Studio, enabling live updates to Live2D parameters and authentication processes, as confirmed by implementations in `mcp-server.ts` and type definitions in `types/ws.d.ts`.
- **Model Context Protocol (MCP)**: A protocol for server-client communication, implemented in `mcp-server.ts` to facilitate external interactions with the plugin.
- **VTube Studio API**: Integrated for controlling Live2D models, allowing dynamic manipulation of avatar expressions and movements via API requests like `Live2DParameterListRequest`.

## Development Setup
- **Project Directory**: Located at `c:/Projects/waifu/vtube-plugin`, containing source code in `src/`, tests in `test/`, and type definitions in `types/`.
- **Build Configuration**: Managed via `tsconfig.json`, which defines TypeScript compilation settings for the project.
- **Package Management**: Utilizes `package.json` for dependency management and scripts, with `package-lock.json` ensuring version consistency.
- **Testing Framework**: Likely using a JavaScript testing library (e.g., Jest or Mocha) given the presence of test files in `test/` directory with `.js` extension.

## Technical Constraints
- **Platform Compatibility**: The plugin must be compatible with VTube Studio and potentially other VTuber streaming platforms, primarily focusing on Windows as the development environment.
- **Performance**: Real-time processing of Live2D parameters via WebSocket requires low latency (e.g., timeouts set to 3-5 seconds in code) to ensure smooth avatar interactions during live streams.
- **Security**: Authentication with VTube Studio must adhere to best practices, using token-based systems to protect user information during API interactions, as implemented in `authenticate.ts`.

## Dependencies
- **Internal Dependencies**: Core modules like `mcp-server.ts` depend on tools (`src/tools/`) such as `getLive2DParameters.ts` and utilities (`src/utils/`) like `authenticate.ts`, forming the backbone of the plugin's functionality.
- **External Libraries**: Include WebSocket libraries for real-time communication (`ws`), MCP SDK for server setup (`@modelcontextprotocol/sdk`), and testing frameworks as specified in `package.json`.
- **Type Definitions**: Custom type definitions in `types/` (e.g., `ws.d.ts`, `log.d.ts`) ensure type safety for WebSocket and logging integrations.

## Tool Usage Patterns
- **MCP Server**: Central control point (`mcp-server.ts`) for initializing WebSocket connections to VTube Studio, managing authentication, and registering tools, invoked to coordinate all plugin operations.
- **Live2D Tools**: Specific tools like `getLive2DParameters.ts` send API requests via WebSocket to fetch Live2D model parameters from VTube Studio, critical for real-time VTuber interactions.
- **Authentication Utility**: `authenticate.ts` is invoked during connection setup to handle token storage, request new tokens if needed, and send authentication requests to VTube Studio, ensuring secure access.
- **Testing**: Tests are run for each major component (e.g., `index_test.js`, `mcp_server_test.js`) to validate functionality, often executed via command-line scripts defined in `package.json`.

This document builds on `projectbrief.md` and `systemPatterns.md`, providing a detailed view of the technical environment and constraints shaping the VTuber Plugin's development.
