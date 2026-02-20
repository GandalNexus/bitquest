'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from '../../db';
import { users } from '../../db/schema';
import { sql } from 'drizzle-orm';
import { createSessionToken, verifySessionToken } from '../../lib/session';

export interface User {
  id: number;
  name: string;
  email: string;
  level: number | null;
  xp: number | null;
  sats: number | null;
  createdAt: Date | null;
}

export interface AuthState {
  success?: true;
  error?: string;
  user?: User;
}

// ---------------- LOGIN ----------------
export async function loginUser(
  _state: AuthState | null,  // ← Accepte null
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!email || !password) return { error: 'Email and password required' };

  const [userRecord] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    password: users.password,
    level: users.level,
    xp: users.xp,
    sats: users.sats,
    createdAt: users.createdAt,
  })
    .from(users)
    .where(sql`${users.email} = ${email}`);

  if (!userRecord) return { error: 'User not found' };

  const valid = await bcrypt.compare(password, userRecord.password);
  if (!valid) return { error: 'Incorrect password' };

  (await cookies()).set('user_session', await createSessionToken(userRecord.id), {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return {
    success: true,
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      level: userRecord.level,
      xp: userRecord.xp,
      sats: userRecord.sats,
      createdAt: userRecord.createdAt,
    },
  };
}

// ---------------- LOGOUT ----------------
export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete('user_session');
}

// ---------------- SIGNUP ----------------
export async function signupUser(
  _state: AuthState | null,  // ← Accepte null
  formData: FormData
): Promise<AuthState> {
  const name = formData.get('name')?.toString();
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!name || !email || !password) return { error: 'All fields are required' };

  const [exists] = await db.select().from(users).where(sql`${users.email} = ${email}`);
  if (exists) return { error: 'This email is already in use' };

  const hashed = await bcrypt.hash(password, 10);

  const [userRecord] = await db.insert(users)
    .values({
      name,
      email,
      password: hashed,
      level: 1,
      xp: 0,
      sats: 50,
      createdAt: new Date(),
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      level: users.level,
      xp: users.xp,
      sats: users.sats,
      createdAt: users.createdAt,
    });

  (await cookies()).set('user_session', await createSessionToken(userRecord.id), {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return {
    success: true,
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      level: userRecord.level,
      xp: userRecord.xp,
      sats: userRecord.sats,
      createdAt: userRecord.createdAt,
    },
  };

}

// ---------------- GET CURRENT USER ----------------
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;

  if (!token) return null;

  // FIX: Verify HMAC signature before trusting the userId.
  // A forged or tampered cookie will fail verification and return null.
  const userId = await verifySessionToken(token);
  if (!userId) return null;

  const [userRecord] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    level: users.level,
    xp: users.xp,
    sats: users.sats,
    createdAt: users.createdAt,
  })
    .from(users)
    .where(sql`${users.id} = ${userId}`);

  if (!userRecord) return null;

  return {
    id: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    level: userRecord.level ?? 1,
    xp: userRecord.xp ?? 0,
    sats: userRecord.sats ?? 0,
    createdAt: userRecord.createdAt,
  };
}