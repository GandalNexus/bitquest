// lib/session.ts
// HMAC-signed session cookie utilities.
// Prevents IDOR: cookie value is "userId.signature" instead of bare "userId".

const SECRET = process.env.SESSION_SECRET || 'biquest-dev-secret-change-in-production';

async function hmac(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Buffer.from(sig).toString('hex');
}

/** Create a signed session token: "userId.hmac" */
export async function createSessionToken(userId: number): Promise<string> {
    const payload = String(userId);
    const signature = await hmac(payload);
    return `${payload}.${signature}`;
}

/** Verify and parse the session token. Returns userId or null if invalid/tampered. */
export async function verifySessionToken(token: string): Promise<number | null> {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payload = token.slice(0, dotIndex);
    const providedSig = token.slice(dotIndex + 1);
    const expectedSig = await hmac(payload);

    // Constant-time comparison to prevent timing attacks
    if (providedSig.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < providedSig.length; i++) {
        diff |= providedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (diff !== 0) return null;

    const userId = parseInt(payload, 10);
    return isNaN(userId) ? null : userId;
}
