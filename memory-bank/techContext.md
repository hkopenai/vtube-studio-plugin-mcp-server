# Tech Context: VTuber Plugin

## Technologies Used
- **TypeScript**: The primary programming language for the project, providing type safety and modern JavaScript features for robust development.
- **Node.js**: The runtime environment for executing the plugin's backend logic and tools, essential for server-side operations.
- **Live2D SDK**: Likely integrated for avatar model manipulation, allowing dynamic control of VTuber avatars' expressions and movements.
- **WebSocket (WS)**: Potentially used for real-time communication between the plugin and streaming platforms or user interfaces, as indicated by the `types/ws.d.ts` file.

## Development Setup
- **Project Directory**: Located at `c:/Projects/waifu/vtube-plugin`, containing source code in `src/`, tests in `test/`, and type definitions in `types/`.
- **Build Configuration**: Managed via `tsconfig.json`, which defines TypeScript compilation settings for the project.
- **Package Management**: Utilizes `package.json` for dependency management and scripts, with `package-lock.json` ensuring version consistency.
- **Testing Framework**: Likely using a JavaScript testing library (e.g., Jest or Mocha) given the presence of test files in `test/` directory with `.js` extension.

## Technical Constraints
- **Platform Compatibility**: The plugin must be compatible with various VTuber streaming platforms and operating systems, primarily focusing on Windows as the development environment.
- **Performance**: Real-time processing of Live2D parameters requires low latency to ensure smooth avatar interactions during live streams.
- **Security**: Authentication and data handling must adhere to best practices to protect user information, especially when interfacing with external APIs or services.

## Dependencies
- **Internal Dependencies**: Core modules like `mcp-server.ts` depend on tools (`src/tools/`) and utilities (`src/utils/`), forming the backbone of the plugin's functionality.
- **External Libraries**: Likely include Live2D SDK libraries, WebSocket libraries for real-time communication, and testing frameworks as specified in `package.json`.
- **Type Definitions**: Custom type definitions in `types/` (e.g., `ws.d.ts`, `log.d.ts`) to ensure type safety for specific integrations or custom modules.

## Tool Usage Patterns
- **MCP Server**: Central control point (`mcp-server.ts`) for initializing and managing tools, often invoked to coordinate plugin operations.
- **Live2D Tools**: Specific tools like `getLive2DParameters.ts` are used to fetch and manipulate avatar parameters, critical for VTuber interactions.
- **Authentication Utility**: `authenticate.ts` is called before any secure operation or API interaction to validate credentials or tokens.
- **Testing**: Tests are run for each major component (e.g., `index_test.js`, `mcp_server_test.js`) to validate functionality, often executed via command-line scripts defined in `package.json`.

This document builds on `projectbrief.md` and `systemPatterns.md`, providing a detailed view of the technical environment and constraints shaping the VTuber Plugin's development.
