import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createCoartServer } from '../mcp/server.ts'

await createCoartServer().connect(new StdioServerTransport())
