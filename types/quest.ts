// types/quest.ts
export interface QuestContent {
  introduction: string;
  sections: QuestSection[];
  practicalMission?: PracticalMission;
}

export interface QuestSection {
  title: string;
  content: string;
  image?: string;
  miniQuiz?: MiniQuiz;
}

export interface MiniQuiz {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface PracticalMission {
  title: string;
  description: string;
  steps: string[];
  bitlabAction: string; // Action to perform in BitLab
  validationCriteria: string[];
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'conditional';
  question: string;
  options?: string[];
  correctAnswer: number | boolean;
  explanation: string;
  points: number;
}

export interface QuizAttempt {
  questId: number;
  answers: Record<string, number | boolean>;
  score: number;
  passed: boolean;
  completedAt: Date;
}

export type QuestStatus = 'locked' | 'available' | 'in_progress' | 'completed';
