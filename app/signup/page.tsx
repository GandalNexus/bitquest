'use client';

import { signupUser } from '@/app/actions/auth';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bitcoin, User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const [state, formAction] = useFormState(signupUser, null);

  useEffect(() => {
    if (state?.success) {
      router.push('/dashboard');
    }
  }, [state, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-80"></div>

      <div className="relative w-full max-w-md glass p-8 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-400 to-yellow-200 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
            <Bitcoin className="w-7 h-7 text-slate-900" />
          </div>
          <h2 className="text-2xl font-bold text-white">Créer un compte</h2>
          <p className="text-slate-400 text-sm mt-2">Rejoignez l'aventure BitQuest.</p>
        </div>

        <form action={formAction} className="space-y-4">
          
          {state?.error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm text-center">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Pseudo</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                name="name"
                type="text" 
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                placeholder="SatoshiFan"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                name="email"
                type="email" 
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                placeholder="vous@exemple.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                name="password"
                type="password" 
                required
                minLength={8}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                placeholder="••••••••"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Minimum 8 caractères.</p>
          </div>

          <SubmitButton />
        </form>

        <p className="text-center text-slate-400 text-sm mt-8">
          Déjà un aventurier ? {' '}
          <Link href="/login" className="text-amber-500 hover:text-amber-400 font-bold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      disabled={pending}
      className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-6"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
      {pending ? 'Création en cours...' : 'Commencer le jeu'}
    </button>
  );
}