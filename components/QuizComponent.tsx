'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { QuizQuestion } from '@/types/quest';

interface QuizComponentProps {
  questions: QuizQuestion[];
  onComplete: (score: number, answers: Record<string, number | boolean>) => void;
  passingScore?: number;
}

export default function QuizComponent({ questions, onComplete, passingScore = 70 }: QuizComponentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | boolean>>({});
  const [showResults, setShowResults] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const question = questions[currentQuestion];
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  const handleAnswer = (answer: number | boolean) => {
    setSelectedAnswer(answer);
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (selectedAnswer !== null) {
      setAnswers({ ...answers, [question.id]: selectedAnswer });
      setShowExplanation(false);
      setSelectedAnswer(null);

      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        calculateResults();
      }
    }
  };

  const calculateResults = () => {
    const finalAnswers = { ...answers, [question.id]: selectedAnswer! };
    let earnedPoints = 0;

    questions.forEach(q => {
      if (finalAnswers[q.id] === q.correctAnswer) {
        earnedPoints += q.points;
      }
    });

    const score = Math.round((earnedPoints / totalPoints) * 100);
    setShowResults(true);
    onComplete(score, finalAnswers);
  };

  const isCorrect = selectedAnswer === question.correctAnswer;

  if (showResults) {
    const earnedPoints = Object.entries(answers).reduce((sum, [qId, answer]) => {
      const q = questions.find(q => q.id === qId);
      return sum + (q && answer === q.correctAnswer ? q.points : 0);
    }, 0);
    const score = Math.round((earnedPoints / totalPoints) * 100);
    const passed = score >= passingScore;

    return (
      <div className="max-w-2xl mx-auto p-8 bg-slate-800/50 rounded-2xl border border-slate-700">
        <div className="text-center">
          {passed ? (
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          )}
          <h2 className="text-3xl font-bold text-white mb-2">
            {passed ? 'Quiz Passed!' : 'Quiz Failed'}
          </h2>
          <p className="text-4xl font-bold text-amber-500 mb-4">{score}%</p>
          <p className="text-slate-400 mb-6">
            {passed 
              ? 'Great job! You can now proceed to the practical mission.'
              : `You need ${passingScore}% to pass. Review the content and try again.`
            }
          </p>
          <div className="text-sm text-slate-500">
            {earnedPoints} / {totalPoints} points
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
            <span className="text-slate-900 font-bold">{currentQuestion + 1}</span>
          </div>
          <h3 className="text-xl font-bold text-white">{question.question}</h3>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {question.type === 'multiple-choice' && question.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              disabled={showExplanation}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedAnswer === index
                  ? showExplanation
                    ? isCorrect
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-red-500 bg-red-500/10'
                    : 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
              } ${showExplanation ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-white">{option}</span>
            </button>
          ))}

          {question.type === 'true-false' && (
            <div className="grid grid-cols-2 gap-4">
              {[true, false].map((value) => (
                <button
                  key={value.toString()}
                  onClick={() => handleAnswer(value)}
                  disabled={showExplanation}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedAnswer === value
                      ? showExplanation
                        ? isCorrect
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                        : 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                  } ${showExplanation ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="text-white font-bold">{value ? 'True' : 'False'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div className={`p-4 rounded-lg border-2 mb-6 ${
            isCorrect 
              ? 'border-green-500 bg-green-500/10' 
              : 'border-red-500 bg-red-500/10'
          }`}>
            <div className="flex items-start gap-3">
              {isCorrect ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-bold mb-1 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </p>
                <p className="text-slate-300 text-sm">{question.explanation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={selectedAnswer === null}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg transition-all"
        >
          {currentQuestion < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
        </button>
      </div>
    </div>
  );
}
