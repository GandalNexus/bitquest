'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QuestContentViewer from '@/components/QuestContentViewer';
import QuizComponent from '@/components/QuizComponent';
import { submitQuiz, completeQuest } from '@/app/actions/quests';
import { BookOpen, Brain, Rocket, Trophy } from 'lucide-react';
import type { Quest, Quiz } from '@/db/schema';
import type { User } from '@/app/actions/auth';

interface QuestPageProps {
  quest: Quest;
  quiz: Quiz | undefined;
  user: User;
}

type Stage = 'content' | 'quiz' | 'practical' | 'completed';

export default function QuestPage({ quest, quiz, user }: QuestPageProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('content');
  const [quizPassed, setQuizPassed] = useState(false);
  const [rewards, setRewards] = useState<{ xp: number; sats: number } | null>(null);

  const handleContentComplete = () => {
    setStage('quiz');
  };

  const handleQuizComplete = async (score: number, answers: Record<string, number | boolean>) => {
    const result = await submitQuiz(quest.id, {
      questId: quest.id,
      answers,
      score,
      passed: score >= (quiz?.passingScore || 70),
      completedAt: new Date(),
    });

    if (result.success && result.passed) {
      setQuizPassed(true);
      setStage('practical');
    }
  };

  const handlePracticalComplete = async () => {
    const result = await completeQuest(quest.id);
    if (result.success && result.rewards) {
      setRewards(result.rewards);
      setStage('completed');
    }
  };

  if (stage === 'completed' && rewards) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-amber-500/20 to-slate-800/50 rounded-2xl border border-amber-500/30 p-12">
            <Trophy className="w-20 h-20 text-amber-500 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-white mb-4">Quest Completed!</h1>
            <p className="text-xl text-slate-300 mb-8">{quest.title}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">XP Earned</p>
                <p className="text-3xl font-bold text-amber-500">+{rewards.xp}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Sats Earned</p>
                <p className="text-3xl font-bold text-amber-500">+{rewards.sats}</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-8 py-3 rounded-lg transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-slate-400 hover:text-white mb-4 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">{quest.title}</h1>
          <p className="text-slate-400">{quest.description}</p>
        </div>

        {/* Stage Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <StageIndicator 
            icon={<BookOpen className="w-5 h-5" />}
            label="Learn"
            active={stage === 'content'}
            completed={['quiz', 'practical', 'completed'].includes(stage)}
          />
          <div className="h-0.5 w-12 bg-slate-700" />
          <StageIndicator 
            icon={<Brain className="w-5 h-5" />}
            label="Quiz"
            active={stage === 'quiz'}
            completed={['practical', 'completed'].includes(stage)}
          />
          <div className="h-0.5 w-12 bg-slate-700" />
          <StageIndicator 
            icon={<Rocket className="w-5 h-5" />}
            label="Practice"
            active={stage === 'practical'}
            completed={stage === 'completed'}
          />
        </div>

        {/* Content */}
        {stage === 'content' && (
          <QuestContentViewer 
            content={quest.content as any}
            onComplete={handleContentComplete}
          />
        )}

        {stage === 'quiz' && quiz && (
          <QuizComponent
            questions={quiz.questions as any}
            onComplete={handleQuizComplete}
            passingScore={quiz.passingScore || 70}
          />
        )}

        {stage === 'practical' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
              <h2 className="text-2xl font-bold text-white mb-4">Practical Mission</h2>
              <p className="text-slate-300 mb-6">
                Complete the practical exercise in BitLab to finish this quest.
              </p>
              <button
                onClick={handlePracticalComplete}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-lg transition-all"
              >
                Launch BitLab Mission
              </button>
              <p className="text-sm text-slate-500 mt-4 text-center">
                This will open BitLab with the mission context
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StageIndicator({ icon, label, active, completed }: any) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
        completed 
          ? 'bg-green-500 text-white'
          : active
          ? 'bg-amber-500 text-slate-900'
          : 'bg-slate-700 text-slate-400'
      }`}>
        {icon}
      </div>
      <span className={`text-sm font-medium ${
        active ? 'text-white' : 'text-slate-400'
      }`}>
        {label}
      </span>
    </div>
  );
}
