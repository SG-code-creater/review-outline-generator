// 跨视图共享的类型定义（从 page.tsx 抽出，供懒加载子组件复用）

export type Mode = "outline" | "flashcard" | "review" | "quiz" | "mistakes" | "vocab" | "exam" | "pdfqa";

export type ReviewView = "due" | "collection" | "outlines";

export type CardStatus = "all" | "new" | "weak" | "fuzzy" | "mastered";

export interface Card {
  id?: string;
  question: string;
  answer: string;
  topic: string;
  last_grade?: number | null;
  tags?: string[];
}

export interface SavedOutline {
  id: string;
  title: string;
  tags: string[];
  result: { outline?: string } | string;
  created_at: string;
}

export interface Mistake {
  id: string;
  origin: "quiz" | "upload";
  question: string;
  options: string[];
  answer: number;
  picked: number | null;
  explanation: string | null;
  evidence: string | null;
  source_text: string;
  source_title: string | null;
  created_at: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  evidence?: string;
}
