'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from '../../db';
import { users } from '../../db/schema';
import { sql } from 'drizzle-orm';

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

  if (!email || !password) return { error: 'Email et mot de passe requis' };

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

  if (!userRecord) return { error: 'Utilisateur non trouvé' };

  const valid = await bcrypt.compare(password, userRecord.password);
  if (!valid) return { error: 'Mot de passe incorrect' };

  (await cookies()).set('user_session', userRecord.id.toString(), {
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

  if (!name || !email || !password) return { error: 'Tous les champs sont requis' };

  const [exists] = await db.select().from(users).where(sql`${users.email} = ${email}`);
  if (exists) return { error: 'Cet email est déjà utilisé' };

  const hashed = await bcrypt.hash(password, 10);

  const [userRecord] = await db.insert(users)
    .values({
      name,
      email,
      password: hashed,
      level: 1,
      xp: 0,
      sats: 0,
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

  (await cookies()).set('user_session', userRecord.id.toString(), {
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