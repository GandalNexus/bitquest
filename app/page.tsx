// app/page.tsx
import PublicLayout from '@/components/PublicLayout';
import Link from 'next/link';
import { ArrowRight, BookOpen, Cpu, Trophy, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700 mb-8 animate-pulse-slow">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-sm text-slate-300">Version Testnet disponible</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          Maîtrisez Bitcoin <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200 text-glow">
            Une Quête à la fois
          </span>
        </h1>
        
        <p className="mt-4 text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          BitQuest n'est pas un simple cours. C'est un RPG éducatif où vous apprenez, pratiquez sur testnet et gagnez des Satoshis réels.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup" className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl text-lg shadow-lg shadow-amber-500/20 transition-all transform hover:scale-105 flex items-center justify-center gap-2">
            Démarrer l'Aventure <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/login" className="px-8 py-4 glass hover:bg-slate-800 text-white font-bold rounded-xl text-lg transition-all flex items-center justify-center">
            J'ai déjà un compte
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-card p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                <BookOpen className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Learn (Théorie)</h3>
              <p className="text-slate-400 leading-relaxed">
                Des modules structurés pour comprendre la cryptographie, les UTXOs et le Lightning Network sans jargon inutile.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                <Cpu className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Practice (BitLab)</h3>
              <p className="text-slate-400 leading-relaxed">
                Passez de la théorie à la pratique. Créez des transactions, ouvrez des canaux Lightning dans notre sandbox sécurisé.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center mb-6 border border-green-500/20 group-hover:bg-green-500/20 transition-colors">
                <Trophy className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Earn (Récompenses)</h3>
              <p className="text-slate-400 leading-relaxed">
                Validez vos connaissances pour gagner de l'XP, débloquer des badges et recevoir des Satoshis sur votre wallet Lightning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-amber-500/5 blur-3xl rounded-full"></div>
        <div className="relative z-10 max-w-3xl mx-auto px-4">
          <ShieldCheck className="w-16 h-16 text-amber-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-bold text-white mb-4">Prêt à devenir un Architecte Bitcoin ?</h2>
          <p className="text-slate-400 mb-8">Rejoignez des milliers d'étudiants qui prennent le contrôle de leur souveraineté monétaire.</p>
          <Link href="/signup" className="px-8 py-3 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded-lg transition-colors inline-block">
            Créer un compte gratuit
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}