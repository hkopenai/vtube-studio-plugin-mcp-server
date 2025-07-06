# System Patterns: VTuber Plugin

## System Architecture
The VTuber Plugin is a modular TypeScript application designed for integration with VTube Studio to control Live2D models. It employs a tool-based architecture where functionalities are encapsulated in separate modules under `src/tools/`, with core logic orchestrated by `src/mcp-server.ts` using the Model Context Protocol (MCP) for external communication. Supporting utilities are housed in `src/utils/`, ensuring cross-cutting concerns like authentication are managed efficiently.

## Key Technical Decisions
- **TypeScript Usage**: Chosen for its strong typing and modern JavaScript features, ensuring robust code quality and maintainability.
- **Modular Design**: Each tool or feature (e.g., `getLive2DParameters.ts`) is an independent module, enabling updates and additions without impacting the core system.
- **WebSocket Integration**: Utilizes WebSocket for real-time communication with VTube Studio, critical for live parameter updates and user interactions.
- **Authentication Layer**: A dedicated utility (`authenticate.ts`) secures connections to VTube Studio, supporting both stored and new token authentication, vital for user data protection.

## Design Patterns in Use
- **Singleton Pattern**: Implemented in `MCPServer` class (`mcp-server.ts`) to ensure a single instance manages plugin operations and WebSocket connections.
- **Command Pattern**: Evident in tool registration within `MCPServer`, where tools like `getLive2DParameters` are executed as commands, decoupling request invocation from implementation.
- **Observer Pattern**: Utilized via WebSocket event listeners in `mcp-server.ts` and `getLive2DParameters.ts`, enabling real-time response to messages from VTube Studio for parameter updates and authentication.

## Component Relationships
- **MCP Server (`mcp-server.ts`)**: The central hub, initializing WebSocket connections to VTube Studio, managing authentication via `authenticate.ts`, and registering tools like `getLive2DParameters`. It coordinates all plugin operations.
- **Tools (`src/tools/`)**: Modules such as `getLive2DParameters.ts` handle specific tasks like fetching Live2D model parameters, interacting with the MCP server to access the WebSocket connection for API requests.
- **Utilities (`src/utils/`)**: Support modules like `authenticate.ts` manage security, handling token storage and authentication requests, used by the MCP server during connection setup.
- **Tests (`test/`)**: Corresponding test files (e.g., `get_live2d_parameters_test.js`) validate functionality for each component, ensuring reliability through automated testing.

## Critical Implementation Paths
- **Live2D Parameter Control**: The flow starts with a user or automated request through the MCP server, which delegates to `getLive2DParameters.ts`. This tool sends a `Live2DParameterListRequest` via WebSocket to VTube Studio, processes the response, and returns parameter data, crucial for real-time avatar control.
- **Authentication Flow**: On connection setup, `mcp-server.ts` invokes `authenticate.ts` to check for stored tokens or request new ones from VTube Studio. Authentication requests are sent via WebSocket, with responses handled to ensure secure access, a vital path for user trust and connection persistence.
- **Testing and Validation**: Before deployment or updates, the test suite in `test/` validates each component's functionality, with results guiding development priorities and bug fixes to maintain plugin reliability.

This document builds on `projectbrief.md`, focusing on the technical architecture and patterns that define the VTuber Plugin's system design.
