// components/PublicLayout.tsx
import Link from 'next/link';
import { Bitcoin, Zap, Menu } from 'lucide-react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative bg-slate-950 text-white overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/bitquestbg/1920/1080')] bg-cover bg-center opacity-20 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950 pointer-events-none"></div>
      
      {/* Navbar */}
      <nav className="relative z-10 w-full glass border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Bitcoin className="w-6 h-6 text-slate-900" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">BitQuest</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#" className="text-slate-300 hover:text-amber-400 transition-colors">Parcours</Link>
              <Link href="#" className="text-slate-300 hover:text-amber-400 transition-colors">Fonctionnalités</Link>
              <Link href="#" className="text-slate-300 hover:text-amber-400 transition-colors">Écosystème</Link>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/login" className="text-slate-300 hover:text-white font-medium text-sm hidden sm:block">
                Connexion
              </Link>
              <Link href="/signup" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-all transform hover:scale-105 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Commencer
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>
    </div>
  );
}