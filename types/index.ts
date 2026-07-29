export enum FeedbackStyle {
  MOTIVATING = 'Motivating',
  PLAYFUL = 'Playful',
  SARCASTIC = 'Sarcastic',
  PROFESSIONAL = 'Professional',
}

export enum NavTab {
  HOME = 'home',
  RESULTS = 'results',
  IMPROVE = 'improve',
  IMPROVE_PROCESSING = 'improve_processing',
  DNA = 'dna',
}

export enum OccasionPreset {
  CASUAL = 'Casual',
  WORK = 'Work',
  DATE = 'Date',
  PARTY = 'Party',
  EVENT = 'Event',
}

export interface AnalysisResult {
  score: number;
  breakdown: {
    harmony: number;
    fitBalance: number;
    styleAlignment: number;
    styleIntent: number;
  };
  headline: string;
  feedback: string;
  palette: string[];
  weather?: string;
}

export interface ImprovementPlan {
  winningElements: string[];
  diagnosticSummary: {
    primaryIssue: string;
    secondaryIssue: string;
    alignmentImpact: string;
  };
  problemStatements: string[];
  improvementSections: {
    title: string;
    whyMatters: string;
    styleImpact: string;
    actionSteps: string[];
  }[];
  advancedInsights: string[];
  outfitWeatherProfile: {
    coverage: 'light' | 'medium' | 'heavy';
    layering: 'single' | 'layered' | 'heavy-layered';
    fabricWeight: 'light' | 'mid' | 'heavy';
  };
}

export interface UploadState {
  imagePreviewUrl: string | null;
  selectedStyle: FeedbackStyle;
  selectedOccasion: OccasionPreset | null;
  customOccasion: string;
  isAnalyzing: boolean;
  isGeneratingPlan: boolean;
  analysisResult: AnalysisResult | null;
  improvementPlan: ImprovementPlan | null;
  isHome: boolean;
  isHistory: boolean;
  isProfile: boolean;
  isStyleDNA: boolean;
  fromHistory: boolean;
  validationError: string | null;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  imageUrl: string;
  score: number;
  alignment: string;
  comparison: string;
  data: AnalysisResult;
  occasion?: string;
}

export interface WeatherStyleNote {
  summary: string;
  verdict?: string;
}

export interface OutfitContext {
  outfitId: string | null;
  imageUrl: string;
  title: string;
  analyzedAt: string;
  analysisResult: AnalysisResult;
  improvementPlan: ImprovementPlan | null;
  weatherContext?: {
    currentConditions: string;
    weatherNote?: string;
  };
}
