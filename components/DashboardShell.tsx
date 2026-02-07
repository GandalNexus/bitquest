// components/DashboardShell.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logoutUser } from '@/app/actions/auth';
import { 
  LayoutDashboard, Map, Award, Wallet, LogOut, 
  Bitcoin, Zap, TrendingUp, Play, Lock, CheckCircle, 
  ChevronRight, TerminalSquare, X, ArrowDownLeft, ArrowUpLeft, 
  Download, Upload, Trophy, ShieldCheck, Clock 
} from 'lucide-react';

// Types
interface User {
  id: number;
  name: string;
  email: string;
  level: number;
  xp: number;
  sats: number;
}

const QuestsData = [
  {
    id: 1,
    title: "Premiers Pas",
    description: "Comprendre ce qu'est une adresse Bitcoin.",
    type: "Initiation",
    xpReward: 50,
    satsReward: 10,
    status: 'completed' 
  },
  {
    id: 2,
    title: "Votre Première Transaction",
    description: "Envoyer des sats sur la testnet.",
    type: "Intermédiaire",
    xpReward: 100,
    satsReward: 25,
    status: 'available'
  },
  {
    id: 3,
    title: "Lightning Network 101",
    description: "Ouverture d'un canal de paiement.",
    type: "Avancé",
    xpReward: 200,
    satsReward: 100,
    status: 'locked'
  }
];

interface DashboardShellProps {
  user: User;
}

export default function DashboardShell({ user }: DashboardShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const xpForNextLevel = user.level * 100;
  const currentXpInLevel = user.xp % xpForNextLevel;
  const progressPercentage = (currentXpInLevel / xpForNextLevel) * 100;

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
  };

  return (
    // IMPORTANT: min-h-screen et w-full pour éviter d'être écrasé
    <div className="flex min-h-screen w-full bg-[#0f172a] text-slate-100 overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-900">
      
      {/* --- SIDEBAR (FORCÉE EN MODE LARGE) --- */}
      <aside className="w-64 flex-shrink-0 flex flex-col justify-between border-r border-slate-700 bg-[#131c31] z-20 transition-all duration-300">
        <div>
          <div className="h-20 flex items-center px-6 border-b border-slate-700">
            <div className="relative w-10 h-10 flex items-center justify-center bg-amber-500 rounded-lg shadow-lg shadow-amber-500/30 flex-shrink-0">
              <Bitcoin className="text-slate-900 w-6 h-6" />
            </div>
            <span className="ml-3 font-bold text-xl tracking-wide text-white whitespace-nowrap">BitQuest</span>
          </div>

          <nav className="mt-8 flex flex-col gap-2 px-4">
            <TabButton icon={LayoutDashboard} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <TabButton icon={Map} label="Parcours Quêtes" isActive={activeTab === 'quests'} onClick={() => setActiveTab('quests')} />
            <TabButton icon={Award} label="Badges" isActive={activeTab === 'badges'} onClick={() => setActiveTab('badges')} />
            <TabButton icon={Wallet} label="Wallet Sats" isActive={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
          </nav>
        </div>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 p-0.5 flex-shrink-0">
               <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-slate-200 font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-xs text-amber-500">Niveau {user.level}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center w-full gap-2 px-2 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-[url('https://picsum.photos/seed/blockchain/1920/1080')] bg-cover bg-center">
        <div className="absolute inset-0 bg-[#0f172a]/90 z-0"></div>
        
        {/* Header */}
        <header className="relative z-10 h-20 bg-[#1e293b]/70 backdrop-blur-md border-b border-slate-700 flex items-center justify-between px-8 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.5)' }}>
            {activeTab === 'dashboard' && 'Tableau de Bord'}
            {activeTab === 'quests' && 'Parcours des Quêtes'}
            {activeTab === 'badges' && 'Vos Badges'}
            {activeTab === 'wallet' && 'Wallet Éducatif'}
          </h2>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 w-48">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">XP</span>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-1000" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-slate-300">{currentXpInLevel} / {xpForNextLevel}</span>
            </div>

            <div className="flex items-center gap-2 bg-[#1e293b]/80 px-4 py-1.5 rounded-full border border-amber-500/30">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span className="font-mono font-bold text-white">{user.sats.toLocaleString()}</span>
              <span className="text-xs text-slate-400">sats</span>
            </div>
          </div>
        </header>

        {/* Content Views */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          {activeTab === 'dashboard' && <DashboardView user={user} />}
          {activeTab === 'quests' && <QuestsView />}
          {activeTab === 'badges' && <BadgesView />}
          {activeTab === 'wallet' && <WalletView user={user} />}
        </div>
      </main>
    </div>
  );
}

// --- SOUS-COMPOSANTS (Sans changements logiques) ---

function TabButton({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center p-3 rounded-lg transition-all group w-full text-left ${
        isActive 
          ? 'bg-slate-700/50 text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
      }`}
    >
      <Icon className={`w-6 h-6 transition-colors flex-shrink-0 ${isActive ? 'text-amber-500' : 'group-hover:text-amber-500'}`} />
      <span className="ml-3 font-medium">{label}</span>
    </button>
  );
}

function DashboardView({ user }: { user: User }) {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Niveau Actuel" value={user.level} icon={<Trophy className="w-8 h-8 text-amber-500" />} sub="Prochain niveau bientôt" />
        <StatCard title="Solde Wallet" value={`${user.sats} sats`} icon={<Zap className="w-8 h-8 text-amber-500 fill-amber-500/20" />} sub="Testnet Lightning" />
        <StatCard title="Quêtes Terminées" value="1 / 3" icon={<Map className="w-8 h-8 text-blue-500" />} sub="Continuez comme ça !" />
      </div>

      <div className="bg-[#1e293b]/70 backdrop-blur-md p-8 rounded-xl border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">Reprendre l'aventure</h3>
        <div className="space-y-4">
           <div className="flex items-center justify-between p-4 bg-[#0f172a]/50 rounded border border-slate-700 hover:border-amber-500/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h4 className="font-bold text-white">Votre Première Transaction</h4>
                <p className="text-xs text-slate-400">Intermédiaire • +100 XP • +25 sats</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestsView() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {QuestsData.map((quest) => (
          <div key={quest.id} className={`relative overflow-hidden rounded-xl border p-6 transition-all hover:transform hover:-translate-y-1 ${
            quest.status === 'completed' ? 'border-green-500/50 bg-slate-800/50 opacity-75' :
            quest.status === 'locked' ? 'border-slate-700 bg-slate-900/50 opacity-60' :
            'border-amber-500/50 bg-slate-800/50'
          }`}>
            {quest.status === 'locked' && <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                <Lock className="w-8 h-8 text-slate-500" />
            </div>}
            
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-800 px-2 py-1 rounded">{quest.type}</span>
              {quest.status === 'completed' ? <CheckCircle className="w-6 h-6 text-green-500" /> : 
               quest.status === 'locked' ? <Lock className="w-6 h-6 text-slate-500" /> : 
               <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">{quest.title}</h3>
            <p className="text-slate-400 text-sm mb-6 line-clamp-2">{quest.description}</p>

            <div className="space-y-4">
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1 text-amber-500">
                  <Trophy className="w-3 h-3" /> {quest.xpReward} XP
                </span>
                <span className="flex items-center gap-1 text-amber-500">
                  <Zap className="w-3 h-3" /> {quest.satsReward} sats
                </span>
              </div>
              <button disabled={quest.status !== 'available'} className={`w-full py-2 rounded border text-sm font-medium transition-all ${
                quest.status === 'completed' ? 'border-green-500 text-green-500 hover:bg-green-500/10' :
                quest.status === 'locked' ? 'border-slate-700 text-slate-500 cursor-not-allowed' :
                'border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-slate-900'
              }`}>
                {quest.status === 'completed' ? 'Rejouer' : quest.status === 'locked' ? 'Verrouillé' : 'Commencer'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletView({ user }: { user: User }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#1e293b]/70 backdrop-blur-md p-8 rounded-2xl border border-slate-700 text-center relative overflow-hidden">
         <div className="absolute inset-0 bg-amber-500/5"></div>
         <h2 className="text-slate-400 text-sm uppercase tracking-widest mb-2 relative z-10">Solde disponible</h2>
         <div className="text-6xl font-mono font-bold text-white mb-6 relative z-10">{user.sats.toLocaleString()}</div>
         <div className="flex justify-center gap-4 relative z-10">
            <button className="bg-[#0f172a] hover:bg-slate-800 text-white px-6 py-2 rounded-lg border border-slate-600 flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" /> Recevoir
            </button>
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
              <Upload className="w-4 h-4" /> Envoyer
            </button>
         </div>
      </div>

      <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <h3 className="font-bold text-white">Historique des transactions</h3>
        </div>
        <div className="divide-y divide-slate-700/50">
          <TransactionItem title="Récompense Inscription" date="Il y a 10 min" amount="+50 sats" type="in" />
          <TransactionItem title="Récompense Quête #1" date="Il y a 5 min" amount="+10 sats" type="in" />
        </div>
      </div>
    </div>
  );
}

function BadgesView() {
  const badges = [
    { name: "Initié", icon: ShieldCheck, unlocked: true },
    { name: "Lightning Warrior", icon: Zap, unlocked: false },
    { name: "HODLer", icon: Clock, unlocked: false },
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
       {badges.map((badge, i) => {
         const IconComponent = badge.icon;
         return (
           <div key={i} className={`p-6 rounded-xl flex flex-col items-center text-center border ${badge.unlocked ? 'border-slate-600 bg-slate-800/50' : 'grayscale opacity-50 bg-slate-900/50 border-slate-800'}`}>
             <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
                <IconComponent className={`w-8 h-8 ${badge.unlocked ? 'text-amber-500' : 'text-slate-500'}`} />
             </div>
             <h4 className="font-bold text-white text-sm mb-1">{badge.name}</h4>
             {badge.unlocked && <span className="mt-4 text-xs text-green-500 font-bold border border-green-500 px-2 py-0.5 rounded-full">OBTENU</span>}
           </div>
         );
       })}
    </div>
  );
}

function StatCard({ title, value, icon, sub }: any) {
  return (
    <div className="bg-[#1e293b]/70 backdrop-blur-md p-6 rounded-xl border border-slate-700 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
      <h3 className="text-slate-400 text-sm font-medium mb-2">{title}</h3>
      <p className="text-4xl font-bold text-white mb-2 flex items-center gap-2">{value}</p>
      <p className="text-amber-500 text-sm flex items-center gap-1">
        {icon} {sub}
      </p>
    </div>
  );
}

function TransactionItem({ title, date, amount, type }: any) {
  return (
    <div className="p-4 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${type === 'in' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          {type === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpLeft className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-500">{date}</p>
        </div>
      </div>
      <span className={`font-mono font-bold ${type === 'in' ? 'text-green-400' : 'text-red-400'}`}>{amount}</span>
    </div>
  );
}