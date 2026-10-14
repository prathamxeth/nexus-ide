export interface SourceFile {
  name: string;
  path: string;
  language: string;
  content: string;
  targetFunction: string;
}

export const INITIAL_FILES: Record<string, SourceFile> = {
  "auth.ts": {
    name: "auth.ts",
    path: "src/auth.ts",
    language: "typescript",
    targetFunction: "verifyToken",
    content: `import * as jwt from './jwt';

/**
 * Verifies JWT signature and claims for inbound sessions.
 * Current implementation lacks clock skew tolerance and algorithm enforcement.
 */
export function verifyToken(token: string): boolean {
  return jwt.decode(token);
}

export function login(token: string): boolean {
  const isValid = verifyToken(token);
  return isValid;
}

export async function validateToken(token: string): Promise<boolean> {
  if (!token) return false;
  return verifyToken(token);
}
`,
  },
  "api_handler.ts": {
    name: "api_handler.ts",
    path: "src/api_handler.ts",
    language: "typescript",
    targetFunction: "handleApiRequest",
    content: `import { verifyToken } from './auth';

export interface ApiPayload {
  endpoint: string;
  headers: Record<string, string>;
  body: any;
}

export async function handleApiRequest(payload: ApiPayload) {
  const authHeader = payload.headers['authorization'];
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const token = authHeader.replace(/^Bearer\\s+/, '');
  const isValid = verifyToken(token);
  
  if (!isValid) {
    return {
      status: 401,
      body: { error: "Unauthorized access" }
    };
  }

  return processRoute(payload.endpoint, payload.body);
}

function processRoute(endpoint: string, body: any) {
  return { status: 200, data: { endpoint, processed: true } };
}
`,
  },
};
