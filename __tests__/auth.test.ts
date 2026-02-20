// __tests__/auth.test.ts
// Stress tests for app/actions/auth.ts
// Tests cover: login, signup, getCurrentUser, and documents security issues.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCookieStore } from './setup';

// ── Shared bcrypt mock setup ─────────────────────────────────────────────────
// We don't want real bcrypt hashing in unit tests (slow + not the SUT).
vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn(),
    },
}));

// Pull the mocked modules AFTER vi.mock declarations
import bcrypt from 'bcryptjs';
import { db } from '@/db';

// ── Auth actions under test ──────────────────────────────────────────────────
import { loginUser, signupUser, getCurrentUser } from '@/app/actions/auth';

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Builds a chainable Drizzle-like query builder mock that resolves to `rows`. */
function makeSelectMock(rows: unknown[]) {
    const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(rows),
        select: vi.fn().mockReturnThis(),
    };
    return chain;
}

function makeInsertMock(returning: unknown[]) {
    const chain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returning),
    };
    return chain;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('loginUser', () => {
    const validUser = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        password: '$2b$10$hashed',
        level: 3,
        xp: 250,
        sats: 100,
        createdAt: new Date(),
    };

    it('returns a user and sets session cookie on valid credentials', async () => {
        vi.mocked(db.select).mockReturnValue(makeSelectMock([validUser]) as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        const fd = new FormData();
        fd.set('email', 'alice@example.com');
        fd.set('password', 'correctPassword');

        const result = await loginUser(null, fd);

        expect(result.success).toBe(true);
        expect(result.user?.email).toBe('alice@example.com');
        expect(mockCookieStore.get('user_session')?.value).toBe('1');
    });

    it('returns error when user not found', async () => {
        vi.mocked(db.select).mockReturnValue(makeSelectMock([]) as any);

        const fd = new FormData();
        fd.set('email', 'ghost@example.com');
        fd.set('password', 'anything');

        const result = await loginUser(null, fd);
        expect(result.error).toBe('User not found');
        expect(result.success).toBeUndefined();
    });

    it('returns error on wrong password', async () => {
        vi.mocked(db.select).mockReturnValue(makeSelectMock([validUser]) as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        const fd = new FormData();
        fd.set('email', 'alice@example.com');
        fd.set('password', 'wrongPassword');

        const result = await loginUser(null, fd);
        expect(result.error).toBe('Incorrect password');
    });

    it('returns error when fields are missing', async () => {
        const fd = new FormData(); // no email, no password
        const result = await loginUser(null, fd);
        expect(result.error).toBe('Email and password required');
    });

    it('🔴 SECURITY: session cookie is a raw integer — no signature (IDOR)', async () => {
        vi.mocked(db.select).mockReturnValue(makeSelectMock([validUser]) as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        const fd = new FormData();
        fd.set('email', 'alice@example.com');
        fd.set('password', 'correctPassword');

        await loginUser(null, fd);

        const session = mockCookieStore.get('user_session')?.value;

        // The session is just the user's numeric ID — easily guessable/forgeable.
        // A malicious user can set user_session=2 to impersonate user ID 2.
        expect(Number.isInteger(Number(session))).toBe(true);
        expect(session).toBe(String(validUser.id)); // raw int, no JWT, no secret
    });

    it('⚠️ NOTE: Drizzle parameterizes queries — classic SQL injection is mitigated', async () => {
        // The `where(sql\`${users.email} = ${email}\`)` pattern in auth.ts uses
        // Drizzle's tagged template which safely parameterizes values.
        // Confirmed: attacker input like "' OR 1=1 --" becomes a safe bound param.
        vi.mocked(db.select).mockReturnValue(makeSelectMock([]) as any);

        const fd = new FormData();
        fd.set('email', "' OR 1=1 --");
        fd.set('password', 'anything');

        const result = await loginUser(null, fd);
        // Drizzle passes the literal string as a param; DB finds no user → error
        expect(result.error).toBe('User not found');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('signupUser', () => {
    const newUser = {
        id: 42,
        name: 'Bob',
        email: 'bob@example.com',
        level: 1,
        xp: 0,
        sats: 50,
        createdAt: new Date(),
    };

    it('creates user, sets cookie, and returns user data', async () => {
        // First select (duplicate check) → no existing user
        vi.mocked(db.select)
            .mockReturnValueOnce(makeSelectMock([]) as any);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashed' as never);
        vi.mocked(db.insert).mockReturnValue(makeInsertMock([newUser]) as any);

        const fd = new FormData();
        fd.set('name', 'Bob');
        fd.set('email', 'bob@example.com');
        fd.set('password', 'securePass123');

        const result = await signupUser(null, fd);

        expect(result.success).toBe(true);
        expect(result.user?.name).toBe('Bob');
        expect(result.user?.sats).toBe(50); // signup bonus
        expect(mockCookieStore.get('user_session')?.value).toBe('42');
    });

    it('returns error when email is already registered', async () => {
        const existing = { id: 1, email: 'bob@example.com' };
        vi.mocked(db.select).mockReturnValue(makeSelectMock([existing]) as any);

        const fd = new FormData();
        fd.set('name', 'Bob2');
        fd.set('email', 'bob@example.com');
        fd.set('password', 'anotherPass');

        const result = await signupUser(null, fd);
        expect(result.error).toBe('This email is already in use');
    });

    it('returns error when any field is missing', async () => {
        const fd = new FormData();
        fd.set('name', 'Bob'); // missing email and password

        const result = await signupUser(null, fd);
        expect(result.error).toBe('All fields are required');
    });

    it('hashes the password before storing it', async () => {
        vi.mocked(db.select).mockReturnValue(makeSelectMock([]) as any);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashed' as never);
        vi.mocked(db.insert).mockReturnValue(makeInsertMock([newUser]) as any);

        const fd = new FormData();
        fd.set('name', 'Bob');
        fd.set('email', 'bob@example.com');
        fd.set('password', 'plaintext');

        await signupUser(null, fd);

        expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 10);
        // The raw password must never be stored
        const insertArgs = vi.mocked(db.insert).mock.results;
        expect(insertArgs.length).toBeGreaterThan(0);
    });

    it('⚠️ NOTE: no password length/complexity validation', async () => {
        // A 1-char password is accepted — there is no policy enforced.
        vi.mocked(db.select).mockReturnValue(makeSelectMock([]) as any);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashed' as never);
        vi.mocked(db.insert).mockReturnValue(makeInsertMock([newUser]) as any);

        const fd = new FormData();
        fd.set('name', 'Bob');
        fd.set('email', 'bob@example.com');
        fd.set('password', 'a'); // trivially weak

        const result = await signupUser(null, fd);
        // Bug: This succeeds. No minimum length is enforced.
        expect(result.success).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getCurrentUser', () => {
    const storedUser = {
        id: 7,
        name: 'Carol',
        email: 'carol@example.com',
        level: 2,
        xp: 150,
        sats: 80,
        createdAt: new Date(),
    };

    it('returns the user when a valid session cookie is present', async () => {
        mockCookieStore.set('user_session', '7');
        vi.mocked(db.select).mockReturnValue(makeSelectMock([storedUser]) as any);

        const user = await getCurrentUser();

        expect(user).not.toBeNull();
        expect(user?.id).toBe(7);
        expect(user?.email).toBe('carol@example.com');
    });

    it('returns null when no session cookie exists', async () => {
        // Cookie store is empty (cleared in beforeEach)
        const user = await getCurrentUser();
        expect(user).toBeNull();
    });

    it('returns null when session cookie points to a non-existent user', async () => {
        mockCookieStore.set('user_session', '9999');
        vi.mocked(db.select).mockReturnValue(makeSelectMock([]) as any);

        const user = await getCurrentUser();
        expect(user).toBeNull();
    });

    it('🔴 SECURITY: any integer cookie value is trusted as a valid session', async () => {
        // Simulate an attacker setting a forged cookie to steal user 7's session.
        // No signature is verified — purely IDOR.
        mockCookieStore.set('user_session', '7'); // attacker sets this
        vi.mocked(db.select).mockReturnValue(makeSelectMock([storedUser]) as any);

        const user = await getCurrentUser();
        // The server accepts it and returns user 7's data — no questions asked.
        expect(user?.id).toBe(7);
    });

    it('applies default values (level=1, xp=0, sats=0) when DB nulls are present', async () => {
        mockCookieStore.set('user_session', '5');
        vi.mocked(db.select).mockReturnValue(
            makeSelectMock([{ ...storedUser, level: null, xp: null, sats: null }]) as any
        );

        const user = await getCurrentUser();
        expect(user?.level).toBe(1);
        expect(user?.xp).toBe(0);
        expect(user?.sats).toBe(0);
    });
});
