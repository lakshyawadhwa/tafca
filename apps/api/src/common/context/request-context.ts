import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  firmId: string;
  userId: string;
  requestId: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = requestContextStorage.getStore();
  if (!ctx) {
    throw new Error(
      'RequestContext not initialized — is middleware registered?',
    );
  }
  return ctx;
}

export function getFirmId(): string {
  return getRequestContext().firmId;
}

export function getUserId(): string {
  return getRequestContext().userId;
}

export function getRequestId(): string {
  return getRequestContext().requestId;
}
