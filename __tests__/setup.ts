// __tests__/setup.ts
// Global mock setup — runs before every test file.

import { vi, beforeEach } from 'vitest';

// ── Mock next/headers (cookies) ─────────────────────────────────────────────
// next/headers cannot run outside the Next.js runtime.
// We provide a controllable in-memory cookie jar.

export const mockCookieStore = {
    _store: new Map<string, string>(),
    get(name: string) {
        const value = this._store.get(name);
        return value ? { name, value } : undefined;
    },
    set(name: string, value: string) {
        this._store.set(name, value);
    },
    delete(name: string) {
        this._store.delete(name);
    },
    clear() {
        this._store.clear();
    },
};

vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => mockCookieStore),
}));

// ── Mock lib/session ─────────────────────────────────────────────────────────
// In tests, cookies store raw userId strings for simplicity.
// We mock session helpers so we can control the session value directly.
vi.mock('@/lib/session', () => ({
    createSessionToken: vi.fn(async (userId: number) => String(userId)),
    verifySessionToken: vi.fn(async (token: string) => {
        const id = parseInt(token, 10);
        return isNaN(id) ? null : id;
    }),
}));

// ── Mock db/index.ts ─────────────────────────────────────────────────────────
// We never hit a real DB. Each test file uses vi.mocked(db) to shape responses.

vi.mock('@/db', () => {
    const mockDb = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    };
    return { db: mockDb };
});

// Reset all mocks + cookie store before each test
beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.clear();
});
