// components/DashboardShell.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logoutUser } from '@/app/actions/auth';
import Link from 'next/link';
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
  level: number | null;
  xp: number | null;
  sats: number | null;
  createdAt: Date | null;
}

interface Quest {
  id: number;
  title: string;
  description: string;
  type: string;
  xpReward: number;
  satsReward: number;
  status: string;
  quizPassed: boolean;
  practicalCompleted: boolean;
}

interface DashboardShellProps {
  user: User;
  quests: Quest[];
}

export default function DashboardShell({ user, quests }: DashboardShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const sats = user.sats ?? 0;
  
  const xpForNextLevel = level * 100;
  const currentXpInLevel = xp % xpForNextLevel;
  const progressPercentage = Math.min((currentXpInLevel / xpForNextLevel) * 100, 100);

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
            <TabButton icon={Map} label="Quest Path" isActive={activeTab === 'quests'} onClick={() => setActiveTab('quests')} />
            <TabButton icon={Award} label="Badges" isActive={activeTab === 'badges'} onClick={() => setActiveTab('badges')} />
            <TabButton icon={Wallet} label="Sats Wallet" isActive={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
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
              <p className="text-xs text-amber-500">Level {level}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center w-full gap-2 px-2 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-[url('https://picsum.photos/seed/blockchain/1920/1080')] bg-cover bg-center">
        <div className="absolute inset-0 bg-[#0f172a]/90 z-0"></div>
        
        {/* Header */}
        <header className="relative z-10 h-20 bg-[#1e293b]/70 backdrop-blur-md border-b border-slate-700 flex items-center justify-between px-8 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.5)' }}>
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'quests' && 'Quest Path'}
            {activeTab === 'badges' && 'Your Badges'}
            {activeTab === 'wallet' && 'Educational Wallet'}
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
              <span className="font-mono font-bold text-white">{sats.toLocaleString()}</span>
              <span className="text-xs text-slate-400">sats</span>
            </div>
          </div>
        </header>

        {/* Content Views */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          {activeTab === 'dashboard' && <DashboardView user={user} quests={quests} />}
          {activeTab === 'quests' && <QuestsView quests={quests} />}
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

function DashboardView({ user, quests }: { user: User; quests: Quest[] }) {
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const sats = user.sats ?? 0;
  
  const completedQuests = quests.filter(q => q.status === 'completed').length;
  const availableQuest = quests.find(q => q.status === 'available' || q.status === 'in_progress');
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Current Level" 
          value={level} 
          icon={<Trophy className="w-8 h-8 text-amber-500" />} 
          sub={`${xp} total XP`}
        />
        <StatCard 
          title="Wallet Balance" 
          value={`${sats.toLocaleString()} sats`} 
          icon={<Zap className="w-8 h-8 text-amber-500 fill-amber-500/20" />} 
          sub="Testnet Lightning" 
        />
        <StatCard 
          title="Quests Completed" 
          value={`${completedQuests} / ${quests.length}`} 
          icon={<Map className="w-8 h-8 text-blue-500" />} 
          sub="Keep it up!" 
        />
      </div>

      {availableQuest && (
        <div className="bg-gradient-to-br from-[#1e293b]/90 to-[#0f172a]/90 backdrop-blur-md p-8 rounded-2xl border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Resume the adventure</h3>
            <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <span className="text-xs font-bold text-amber-500">NEW</span>
            </div>
          </div>
          <div className="space-y-4">
            <Link href={`/quest/${availableQuest.id}`}>
              <div className="group flex items-center justify-between p-5 bg-gradient-to-r from-[#0f172a]/80 to-[#1e293b]/50 rounded-xl border border-slate-700 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg mb-1">{availableQuest.title}</h4>
                    <p className="text-sm text-slate-400">{availableQuest.type} • +{availableQuest.xpReward} XP • +{availableQuest.satsReward} sats</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-slate-500 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1e293b]/70 backdrop-blur-md p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Recent Progress
          </h3>
          <div className="space-y-3">
            <ProgressItem label={`Quest${completedQuests > 1 ? 's' : ''} completed`} value="100%" color="green" />
            <ProgressItem label="Level 2" value={`${Math.min((xp / (level * 100)) * 100, 100).toFixed(0)}%`} color="amber" />
          </div>
        </div>

        <div className="bg-[#1e293b]/70 backdrop-blur-md p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            Next Goals
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {availableQuest && (
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>Complete "{availableQuest.title}"</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>Reach level 2 ({level * 100 - xp} XP remaining)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ProgressItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-400">{label}</span>
        <span className={`font-bold ${color === 'green' ? 'text-green-500' : 'text-amber-500'}`}>{value}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color === 'green' ? 'bg-green-500' : 'bg-amber-500'} transition-all duration-500`}
          style={{ width: value }}
        />
      </div>
    </div>
  );
}

function QuestsView({ quests }: { quests: Quest[] }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Learning Path</h2>
        <p className="text-slate-400">Progress at your own pace and earn rewards</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quests.map((quest) => (
          <Link key={quest.id} href={`/quest/${quest.id}`}>
            <div className={`relative overflow-hidden rounded-2xl border p-6 transition-all hover:transform hover:-translate-y-2 hover:shadow-2xl cursor-pointer ${
              quest.status === 'completed' ? 'border-green-500/50 bg-gradient-to-br from-green-900/20 to-slate-800/50' :
              quest.status === 'locked' ? 'border-slate-700 bg-slate-900/50 opacity-60' :
              'border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-slate-800/50 shadow-lg shadow-amber-500/10'
            }`}>
              {quest.status === 'locked' && <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                  <Lock className="w-10 h-10 text-slate-500" />
              </div>}
              
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full">{quest.type}</span>
                {quest.status === 'completed' ? <CheckCircle className="w-7 h-7 text-green-500" /> : 
                 quest.status === 'locked' ? <Lock className="w-7 h-7 text-slate-500" /> : 
                 <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-lg shadow-amber-500/50" />}
              </div>
              
              <h3 className="text-xl font-bold text-white mb-3">{quest.title}</h3>
              <p className="text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed">{quest.description}</p>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm font-mono">
                  <span className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                    <Trophy className="w-4 h-4" /> {quest.xpReward} XP
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                    <Zap className="w-4 h-4" /> {quest.satsReward} sats
                  </span>
                </div>
                <button disabled={quest.status === 'locked'} className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  quest.status === 'completed' ? 'border-2 border-green-500 text-green-500 hover:bg-green-500/10' :
                  quest.status === 'locked' ? 'border-2 border-slate-700 text-slate-500 cursor-not-allowed' :
                  'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/30 hover:scale-105'
                }`}>
                  {quest.status === 'completed' ? 'Replay' : quest.status === 'locked' ? 'Locked' : 'Start'}
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function WalletView({ user }: { user: User }) {
  const sats = user.sats ?? 0;
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-amber-500/10 via-[#1e293b]/70 to-[#0f172a]/70 backdrop-blur-md p-10 rounded-3xl border border-amber-500/30 text-center relative overflow-hidden shadow-2xl">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(245,158,11,0.1),transparent_50%)]"></div>
         <h2 className="text-slate-400 text-sm uppercase tracking-widest mb-3 relative z-10 font-bold">Available Balance</h2>
         <div className="text-7xl font-mono font-bold text-white mb-8 relative z-10 drop-shadow-lg">{sats.toLocaleString()}</div>
         <div className="text-amber-500 text-lg mb-6 relative z-10">sats</div>
         <div className="flex justify-center gap-4 relative z-10">
            <button className="bg-[#0f172a] hover:bg-slate-800 text-white px-8 py-3 rounded-xl border border-slate-600 flex items-center gap-2 transition-all hover:scale-105 shadow-lg">
              <Download className="w-5 h-5" /> Receive
            </button>
            <button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-amber-500/30">
              <Upload className="w-5 h-5" /> Send
            </button>
         </div>
      </div>

      <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-700 bg-slate-800/50">
          <h3 className="font-bold text-white text-lg">Transaction History</h3>
        </div>
        <div className="divide-y divide-slate-700/50">
          <TransactionItem title="Signup Reward" date="10 min ago" amount="+50 sats" type="in" />
          <TransactionItem title="Quest #1 Reward" date="5 min ago" amount="+10 sats" type="in" />
        </div>
      </div>
    </div>
  );
}

function BadgesView() {
  const badges = [
    { name: "Initiate", icon: ShieldCheck, unlocked: true, description: "First login" },
    { name: "Lightning Warrior", icon: Zap, unlocked: false, description: "Master Lightning Network" },
    { name: "HODLer", icon: Clock, unlocked: false, description: "Understand HODL" },
    { name: "Satoshi Fan", icon: Bitcoin, unlocked: false, description: "Read the whitepaper" },
  ];
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Badge Collection</h2>
        <p className="text-slate-400">Unlock badges by completing quests</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
       {badges.map((badge, i) => {
         const IconComponent = badge.icon;
         return (
           <div key={i} className={`p-8 rounded-2xl flex flex-col items-center text-center border transition-all hover:scale-105 ${
             badge.unlocked 
               ? 'border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-slate-800/50 shadow-lg shadow-amber-500/20' 
               : 'grayscale opacity-50 bg-slate-900/50 border-slate-800 hover:opacity-70'
           }`}>
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
               badge.unlocked 
                 ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30' 
                 : 'bg-slate-700/50'
             }`}>
                <IconComponent className={`w-10 h-10 ${badge.unlocked ? 'text-white' : 'text-slate-500'}`} />
             </div>
             <h4 className="font-bold text-white text-base mb-2">{badge.name}</h4>
             <p className="text-xs text-slate-400 mb-3">{badge.description}</p>
             {badge.unlocked && <span className="mt-2 text-xs text-green-500 font-bold border-2 border-green-500 px-3 py-1 rounded-full">OBTAINED</span>}
           </div>
         );
       })}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, sub }: any) {
  return (
    <div className="bg-gradient-to-br from-[#1e293b]/90 to-[#0f172a]/70 backdrop-blur-md p-6 rounded-2xl border border-slate-700 relative overflow-hidden group hover:border-amber-500/50 transition-all shadow-xl">
      <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/5 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
      <h3 className="text-slate-400 text-sm font-bold mb-3 uppercase tracking-wider">{title}</h3>
      <p className="text-4xl font-bold text-white mb-3 flex items-center gap-3 relative z-10">{value}</p>
      <p className="text-amber-500 text-sm flex items-center gap-2 relative z-10">
        {icon} <span className="font-medium">{sub}</span>
      </p>
    </div>
  );
}

function TransactionItem({ title, date, amount, type }: any) {
  return (
    <div className="p-5 flex justify-between items-center hover:bg-slate-800/50 transition-all cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${
          type === 'in' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
        }`}>
          {type === 'in' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpLeft className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-sm font-bold text-white mb-1">{title}</p>
          <p className="text-xs text-slate-500">{date}</p>
        </div>
      </div>
      <span className={`font-mono font-bold text-lg ${type === 'in' ? 'text-green-400' : 'text-red-400'}`}>{amount}</span>
    </div>
  );
}