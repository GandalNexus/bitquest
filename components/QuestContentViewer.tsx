'use client';

import { useState } from 'react';
import { BookOpen, CheckCircle, Lock, Play } from 'lucide-react';
import type { QuestContent } from '@/types/quest';

interface QuestContentViewerProps {
  content: QuestContent;
  onComplete: () => void;
}

export default function QuestContentViewer({ content, onComplete }: QuestContentViewerProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [miniQuizAnswers, setMiniQuizAnswers] = useState<Record<number, number>>({});

  const section = content.sections[currentSection];
  const isLastSection = currentSection === content.sections.length - 1;
  const canProceed = completedSections.has(currentSection);

  const handleMiniQuizAnswer = (answer: number) => {
    setMiniQuizAnswers({ ...miniQuizAnswers, [currentSection]: answer });
    
    if (section.miniQuiz && answer === section.miniQuiz.correctAnswer) {
      setCompletedSections(new Set([...completedSections, currentSection]));
    }
  };

  const handleNext = () => {
    if (isLastSection) {
      onComplete();
    } else {
      setCurrentSection(currentSection + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Introduction */}
      {currentSection === 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 to-slate-800/50 rounded-2xl border border-amber-500/30 p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-bold text-white">Introduction</h2>
          </div>
          <p className="text-slate-300 leading-relaxed">{content.introduction}</p>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {content.sections.map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all ${
              index === currentSection
                ? 'w-8 bg-amber-500'
                : index < currentSection || completedSections.has(index)
                ? 'w-2 bg-green-500'
                : 'w-2 bg-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Section Content */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-6">
        <h3 className="text-2xl font-bold text-white mb-6">{section.title}</h3>
        
        {section.image && (
          <div className="mb-6 rounded-lg overflow-hidden">
            <img src={section.image} alt={section.title} className="w-full" />
          </div>
        )}

        <div className="prose prose-invert max-w-none mb-6">
          <p className="text-slate-300 leading-relaxed whitespace-pre-line">
            {section.content}
          </p>
        </div>

        {/* Mini Quiz */}
        {section.miniQuiz && (
          <div className="bg-slate-700/30 rounded-lg border border-slate-600 p-6 mt-6">
            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-amber-500" />
              Quick Check
            </h4>
            <p className="text-slate-300 mb-4">{section.miniQuiz.question}</p>
            
            <div className="space-y-2">
              {section.miniQuiz.options.map((option, index) => {
                const isSelected = miniQuizAnswers[currentSection] === index;
                const isCorrect = index === section.miniQuiz!.correctAnswer;
                const showResult = miniQuizAnswers[currentSection] !== undefined;

                return (
                  <button
                    key={index}
                    onClick={() => handleMiniQuizAnswer(index)}
                    disabled={showResult}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isSelected && showResult
                        ? isCorrect
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                        : isSelected
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-600 hover:border-slate-500'
                    } ${showResult ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="text-white">{option}</span>
                  </button>
                );
              })}
            </div>

            {miniQuizAnswers[currentSection] !== undefined && (
              <div className={`mt-4 p-3 rounded-lg ${
                miniQuizAnswers[currentSection] === section.miniQuiz.correctAnswer
                  ? 'bg-green-500/10 border border-green-500'
                  : 'bg-red-500/10 border border-red-500'
              }`}>
                <p className="text-sm text-slate-300">{section.miniQuiz.explanation}</p>
              </div>
            )}
          </div>
        )}

        {!section.miniQuiz && (
          <button
            onClick={() => setCompletedSections(new Set([...completedSections, currentSection]))}
            disabled={canProceed}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-green-500 text-slate-900 font-bold rounded-lg transition-all"
          >
            {canProceed ? '✓ Section Completed' : 'Mark as Read'}
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentSection === 0}
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          Previous
        </button>

        <span className="text-slate-400">
          Section {currentSection + 1} of {content.sections.length}
        </span>

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-900 font-bold rounded-lg transition-all flex items-center gap-2"
        >
          {isLastSection ? (
            <>
              <Play className="w-4 h-4" />
              Start Quiz
            </>
          ) : (
            <>
              Next
              {!canProceed && <Lock className="w-4 h-4" />}
            </>
          )}
        </button>
      </div>

      {/* Practical Mission Preview */}
      {content.practicalMission && isLastSection && canProceed && (
        <div className="mt-6 bg-gradient-to-br from-blue-500/10 to-slate-800/50 rounded-2xl border border-blue-500/30 p-6">
          <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-500" />
            Next: Practical Mission
          </h4>
          <p className="text-slate-300 text-sm">{content.practicalMission.title}</p>
        </div>
      )}
    </div>
  );
}
