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
  "billing.ts": {
    name: "billing.ts",
    path: "src/billing.ts",
    language: "typescript",
    targetFunction: "processInvoice",
    content: `import { validateToken } from './auth';

export interface Invoice {
  id: string;
  amount: number;
  customerId: string;
  token: string;
}

/**
 * Processes automated subscription invoice billing.
 * Upstream caller (Hop 1) in FalkorDB blast radius graph.
 */
export async function processInvoice(invoice: Invoice): Promise<{ success: boolean; txId?: string }> {
  // Direct dependency on auth.ts:validateToken
  const isAuthorized = await validateToken(invoice.token);
  if (!isAuthorized) {
    throw new Error("Billing unauthorized: invalid session token");
  }

  const txId = "tx_" + Math.random().toString(36).substring(2, 9);
  return { success: true, txId };
}
`,
  },
  "finance.ts": {
    name: "finance.ts",
    path: "src/finance.ts",
    language: "typescript",
    targetFunction: "auditAccount",
    content: `import { processInvoice, Invoice } from './billing';

/**
 * Audits enterprise corporate accounts.
 * Transitive caller (Hop 2) in FalkorDB blast radius graph.
 */
export async function auditAccount(accountId: string, invoices: Invoice[]): Promise<boolean> {
  for (const inv of invoices) {
    const res = await processInvoice(inv);
    if (!res.success) {
      return false;
    }
  }
  return true;
}
`,
  },
};
