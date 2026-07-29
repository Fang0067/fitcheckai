import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessingState } from './components/ProcessingState';
import { ResultsPage } from './components/ResultsPage';
import { ImprovementPlanPage } from './components/ImprovementPlanPage';
import { Homepage } from './components/Homepage';
import { StyleAIPage } from './components/StyleAI';
import { HistoryPage } from './components/HistoryPage';
import { ProfilePage } from './components/ProfilePage';
import { StyleDNAPage } from './components/StyleDNAPage';
import { SplashScreen } from './components/SplashScreen';
import { UploadPage } from './components/UploadPage';
import { OnboardingIntro } from './components/OnboardingIntro';
import Auth from './components/Auth';          
import { FeedbackStyle, UploadState, AnalysisResult, ImprovementPlan, NavTab } from './types';
import { SparklesIcon } from './components/Icons';
import { supabase } from './lib/supabase';
import { BottomNavigation } from './components/BottomNavigation';
import { WeatherFeed } from './components/WeatherFeed';
import { NetworkBanner } from './components/NetworkBanner';
import { withTimeout } from './lib/withTimeout';
import { registerForPushNotifications } from './lib/notifications';
import { OutfitContext } from './types';


// --- FEATURE FLAG ---
const ENABLE_MONETIZATION = false;

// --- PAYWALL COMPONENT ---
const PaywallModal: React.FC<{ context: 'limit' | 'feature'; onClose: () => void }> = ({ context, onClose }) => {
  if (!ENABLE_MONETIZATION) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center bg-classik-black/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-white border-t border-classik-dark/5 rounded-t-[40px] p-8 pb-14 shadow-[0_-20px_60px_rgba(0,0,0,0.3)] transform animate-slide-up-sheet relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="absolute inset-0 bg-gradient-to-b from-classik-beige/30 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-classik-dark/5 border border-classik-dark/10 flex items-center justify-center mb-6">
            <SparklesIcon className="w-7 h-7 text-classik-dark/40" />
          </div>
          <h3 className="text-classik-black font-black text-2xl tracking-tight mb-4">
            {context === 'limit' ? "Pace your perspective." : "Refine your perspective."}
          </h3>
          <p className="text-classik-taupe text-base leading-relaxed font-medium mb-10 max-w-[320px]">
            {context === 'limit'
              ? "Your daily check is complete. We limit analysis to one silhouette every 24 hours to encourage intentional styling."
              : "True style is a journey of consistency and detail. Gain full access to your digital archive, tailored improvement strategies, and the evolving DNA of your personal aesthetic."
            }
          </p>
          <div className="w-full flex flex-col gap-3">
            <button className="group relative w-full h-16 rounded-full flex items-center justify-center bg-classik-dark text-white font-black text-[11px] uppercase tracking-[0.25em] shadow-lg transition-all duration-500 active:scale-[0.98] overflow-hidden">
              Monthly Access
            </button>
            <button className="w-full h-16 rounded-full bg-classik-warm/10 text-classik-dark font-black text-[11px] uppercase tracking-[0.25em] active:scale-95 transition-all">
              24-Hour Pass
            </button>
            <button onClick={onClose} className="mt-2 text-classik-taupe/60 text-[10px] uppercase font-bold tracking-[0.3em] hover:text-classik-dark transition-colors">
              Return to check
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- HELPERS ---

const getGeminiResponseText = async (response: any): Promise<string> => {
  if (!response) return "{}";
  if (typeof response.text === 'function') {
    return await response.text();
  } else if (typeof response.text === 'string') {
    return response.text;
  } else {
    return JSON.stringify(response);
  }
};

async function urlToData(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ data: (reader.result as string).split(',')[1], mimeType: blob.type });
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [showSplash, setShowSplash] = useState(true);
const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null); // ✅ null = loading
const [onboardingChecked, setOnboardingChecked] = useState(false);
const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPremium] = useState(!ENABLE_MONETIZATION);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallContext, setPaywallContext] = useState<'limit' | 'feature'>('feature');
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);

  const [activeTab, setActiveTab] = useState<NavTab>(NavTab.HOME);
const [weatherData, setWeatherData] = useState<string>('Moderate conditions');
 // ✅ NEW: Network status tracking
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [state, setState] = useState<UploadState & {
  currentOutfitId: string | null;
  analyzedAt: string | null;
  improvementError: boolean | null;
  validationStatus: 'idle' | 'pending' | 'accepted' | 'rejected';
  validationReason: string | null;
}>({
  currentOutfitId: null, // ✅ NEW

  imagePreviewUrl: null,
  selectedStyle: FeedbackStyle.MOTIVATING,
  selectedOccasion: null,
  customOccasion: '',
  isAnalyzing: false,
  isGeneratingPlan: false,
  analysisResult: null,
  improvementPlan: null,
  improvementError: null,
  isHome: true,
  isHistory: false,
  isProfile: false,
  isStyleDNA: false,
  fromHistory: false,
  validationError: null,
  validationStatus: 'idle',
  validationReason: null,
  analyzedAt: null,
});

  const [rawFile, setRawFile] = useState<File | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
const [showStyleAI, setShowStyleAI] = useState(false);
  

// ✅ NEW: Network status listener
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


useEffect(() => {
  const checkUserStatus = async (session: Session | null) => {
  setSession(session);

  if (!session) {
  // HARD RESET APP STATE ON LOGOUT
  setShowOnboarding(false);
  setOnboardingChecked(true);

  setActiveTab(NavTab.HOME);

  setState({
    imagePreviewUrl: null,
    selectedStyle: FeedbackStyle.MOTIVATING,
    selectedOccasion: null,
    customOccasion: '',
    isAnalyzing: false,
    isGeneratingPlan: false,
    analysisResult: null,
    improvementPlan: null,
    improvementError: null,
    isHome: true,
    isHistory: false,
    isProfile: false,
    isStyleDNA: false,
    fromHistory: false,
    validationError: null,
    validationStatus: 'idle',
    validationReason: null,
    currentOutfitId: null,
    analyzedAt: null,
  });

  setRawFile(null);
  setIsValidated(false);

  return;
}


  try {
    const { data: profile, error } = await supabase
  .from('profiles')
  .select('onboarding_completed')
  .eq('user_id', session.user.id)
  .maybeSingle();

if (error) {
  console.error('Profile fetch failed:', error);
  setShowOnboarding(false);
  setOnboardingChecked(true);
  return;
}



if (!profile) {
  // NEW USER
  await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: session.user.id,
        daily_style_reminders: true,
        weekly_summary: true,
        streak_reminder: true,
        push_token: null
      },
      { onConflict: 'user_id' }
    );

  setShowOnboarding(true);
  setOnboardingChecked(true);
  return;
}

// 🔁 RETURNING USER (THIS WAS MISSING)
setShowOnboarding(!profile.onboarding_completed);
setOnboardingChecked(true);

  } catch (e) {
    console.error('Unexpected auth error', e);
    setShowOnboarding(false);
    setOnboardingChecked(true);
  }
};


  // Initial check (handles case where onAuthStateChange doesn't fire immediately)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) checkUserStatus(session);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    checkUserStatus(session);
  });

  return () => subscription.unsubscribe();
}, []);

  // --- LOGIC: Validation ---
  const handleImageValidation = async (imageData) => {
  if (networkStatus === 'offline') {
    setState(prev => ({
      ...prev,
      validationStatus: 'rejected',
      validationReason: 'No internet connection.'
    }));
    return;
  }
   setGlobalError(null);
    try {
      if (!session) return;

      // Duplicate detection context: Summary of previously accepted outfits
      const { data: prevOutfits } = await supabase
        .from('OutfitData')
        .select('title, insight')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(8);

      const outfitHistorySummary = prevOutfits?.map((o, idx) => {
        const insight = typeof o.insight === 'string' ? JSON.parse(o.insight) : o.insight;
        return `Outfit ${idx + 1}: ${o.title}. Colors: ${insight?.palette?.join(', ')}. Description: ${insight?.headline}`;
      }).join('\n') || "No previous outfits analyzed.";

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await withTimeout(
  ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: imageData },
        { text: `Summary of previously accepted outfits:\n${outfitHistorySummary}\n\nValidate this new upload.` }
      ]
    },
    config: {
          systemInstruction: `
You are an image validation engine that operates ONLY inside the Upload Page of a fashion analysis app.
Your ONLY job is to validate whether the uploaded image can proceed to analysis.

REJECT the image if ANY of the following apply:
- Nudity or partial nudity
- Visible underwear or swimwear
- Exposed torso
- Blurry or low-resolution image
- Poor lighting or heavy shadows hiding outfit details
- Mirror flash covering the outfit
- Multiple people in the image
- Non-human subjects
- Outfit not fully visible (must show from head to at least knees)

DUPLICATE OUTFIT RULE (ABSOLUTE):
The user is NOT allowed to upload the same outfit more than once.

An outfit MUST be rejected as a duplicate if:
- The same top AND bottom are present, even with different lighting or angle
- OR the same dominant color palette AND silhouette are present
- OR the outfit would reasonably be perceived by a human as the same look

If unsure, REJECT.
False negatives are worse than false positives.

RESPONSE FORMAT (STRICT):
Return ONLY valid JSON:
{
  "status": "accepted" | "rejected",
  "reason": "short, clear, human-friendly sentence"
}
Do NOT suggest navigation or provide advice.
`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, enum: ["accepted", "rejected"] },
              reason: { type: Type.STRING }
            },
            required: ["status", "reason"]
          }
        }
      }),
      15000
);

      const text = await getGeminiResponseText(response);
      const validation = JSON.parse(text.trim());

//  HARD REJECTION — NO FALLTHROUGH
if (validation.status === 'rejected') {
  setState(prev => ({
    ...prev,
    validationStatus: 'rejected',
    validationReason: validation.reason || 'This outfit has already been analyzed.'
  }));
  setIsValidated(false);
  return; // STOP EVERYTHING
}

//  ACCEPTED PATH
setState(prev => ({
  ...prev,
  validationStatus: 'accepted',
  validationReason: null
}));
setIsValidated(true);

    } catch (error) {
      console.error("Validation failed:", error);
      setState(prev => ({
        ...prev,
        validationStatus: 'rejected',
        validationReason: "Validation service unavailable. Please try again."
      }));
      setIsValidated(false);
    }
  };

  // --- LOGIC: Improvement Plan ---
  const generateImprovementPlan = async (result: AnalysisResult, imageBase64: { data: string; mimeType: string }) => {
  if (networkStatus === 'offline') {
    setGlobalError("You’re offline. Improvement plans require internet access.");
    return;
  }
  setGlobalError(null);
  setState(prev => ({ ...prev, isGeneratingPlan: true, improvementError: null }));
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await withTimeout(
  ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: imageBase64 },
        { text: `Analysis Result: ${JSON.stringify(result)}. Generate a complete improvement plan.` }
      ]
    },
    config: {
        systemInstruction: `You are a calm, modern stylist providing a personal improvement plan. 
Speak clearly, humanly, and conversationally. Avoid jargon, academic theory, or robotic phrasing.
The user should feel guided, not judged. 

Strict Rules for JSON fields:
- diagnosticSummary.primaryIssue: This is the 'Key Focus'. Describe the main issue plainly and briefly. No over-analysis.
- winningElements: These are 'What works best'. Focus on strengths with short, affirmative sentences.
- problemStatements: These are 'Specific Changes'. Write as practical observations, not critiques.
- improvementSections.whyMatters: This is 'The Reasoning'. Explain why it matters in simple human terms.
- improvementSections.actionSteps: These are 'Your Next Steps'. Make them actionable and friendly.

outfitWeatherProfile Rules:
- Analyze the outfit's physical properties from the image ONLY
- Determine coverage: 'light' (shorts/tank/dress), 'medium' (jeans/shirt), 'heavy' (jacket/coat)
- Determine layering: 'single' (one piece), 'layered' (2-3 pieces), 'heavy-layered' (coat + multiple layers)
- Determine fabricWeight: 'light' (linen/cotton/silk), 'mid' (denim/knit), 'heavy' (wool/leather/thick outerwear)
- This profile is STATIC and describes the outfit itself, not weather conditions
- Do NOT include any weather advice or commentary in this section`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            winningElements: { type: Type.ARRAY, items: { type: Type.STRING } },
            diagnosticSummary: {
              type: Type.OBJECT,
              properties: {
                primaryIssue: { type: Type.STRING },
                secondaryIssue: { type: Type.STRING },
                alignmentImpact: { type: Type.STRING }
              },
              required: ["primaryIssue", "secondaryIssue", "alignmentImpact"]
            },
            problemStatements: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvementSections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  whyMatters: { type: Type.STRING },
                  styleImpact: { type: Type.STRING },
                  actionSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "whyMatters", "styleImpact", "actionSteps"]
              }
            },
            advancedInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
            outfitWeatherProfile: {
              type: Type.OBJECT,
              properties: {
                coverage: { type: Type.STRING, enum: ["light", "medium", "heavy"] },
                layering: { type: Type.STRING, enum: ["single", "layered", "heavy-layered"] },
                fabricWeight: { type: Type.STRING, enum: ["light", "mid", "heavy"] }
              },
              required: ["coverage", "layering", "fabricWeight"]
            }
          },
          required: ["winningElements", "diagnosticSummary", "problemStatements", "improvementSections", "advancedInsights", "outfitWeatherProfile"]
        }
      }
    }),
    20000
    );


    const text = await getGeminiResponseText(response);
    const plan: ImprovementPlan = JSON.parse(text.trim());

    setState(prev => ({
      ...prev,
      improvementPlan: plan,
      isGeneratingPlan: false,
      improvementError: null
    }));
    return plan;

  } catch (error) {
  console.error("Improvement plan failed:", error);
  setGlobalError("We couldn’t generate your improvement plan. Please try again.");
  setState(prev => ({ 
    ...prev, 
    isGeneratingPlan: false,
    improvementError: true
  }));
  throw error;
}
};

const handleStartAnalysis = () => {
  setState(prev => ({
    ...prev,
    isHome: false,
    isHistory: false,
    isProfile: false,
    isStyleDNA: false,
    analysisResult: null,
    improvementPlan: null
  }));

  setActiveTab(NavTab.HOME); // optional but stabilizes routing
};

  const handleImageSelected = async (url: string | null, file: File | null) => {
    if (!url || !file) {
      setRawFile(null);
      setIsValidated(false);
      setState(prev => ({
        ...prev,
        imagePreviewUrl: null,
        validationStatus: 'idle',
        validationReason: null
      }));
      return;
    }

    setRawFile(file);
    setIsValidated(false);
    
    setState(prev => ({
      ...prev,
      imagePreviewUrl: url,
      validationStatus: 'pending',
      validationReason: null
    }));

    try {
      const imageData = await urlToData(url);
      await handleImageValidation(imageData);
    } catch {
      setState(prev => ({
        ...prev,
        validationStatus: 'rejected',
        validationReason: 'Image processing failed.'
      }));
    }
  };

  // --- LOGIC: Weather Update ---
  const handleWeatherUpdate = (data: {
  verdict: string;
  explanation: string;
  icon?: string;
  label?: string;
  temp?: number;
  condition?: string;
}) => {
  // Build weather description using raw data
  let weatherDesc = 'Moderate conditions';
  
  if (data.temp !== undefined && data.condition) {
    const temp = data.temp;
    const condition = data.condition.toLowerCase();
    
    // Temperature descriptors
    if (temp >= 34) {
      weatherDesc = 'Very hot conditions';
    } else if (temp >= 28) {
      weatherDesc = 'Hot and warm conditions';
    } else if (temp >= 18) {
      weatherDesc = 'Mild conditions';
    } else if (temp >= 10) {
      weatherDesc = 'Cool conditions';
    } else {
      weatherDesc = 'Very cold conditions';
    }
    
    // Weather conditions
    if (condition.includes('rain') || condition.includes('drizzle')) {
      weatherDesc = `Rain and ${weatherDesc.toLowerCase()}`;
    } else if (condition.includes('storm')) {
      weatherDesc = `Stormy weather with ${weatherDesc.toLowerCase()}`;
    } else if (condition.includes('snow')) {
      weatherDesc = `Snow and ${weatherDesc.toLowerCase()}`;
    } else if (condition.includes('clear') || condition.includes('sun')) {
      weatherDesc = `Sunny and ${weatherDesc.toLowerCase()}`;
    }
  }
  
  setWeatherData(weatherDesc);
  console.log('🌤️ Weather updated for outfit advice:', weatherDesc);
};


const handleOnboardingComplete = async () => {
  if (!session) return;

  const { error } = await supabase
  .from('profiles')
  .upsert({
    user_id: session.user.id,
    onboarding_completed: true,
  });

  if (error) {
    console.error('Failed to update onboarding status', error);
    return;
  }

  setShowOnboarding(false);
  setActiveTab(NavTab.HOME);
  setState(prev => ({
    ...prev,
    isHome: true,
    isHistory: false,
    isProfile: false,
    isStyleDNA: false,
  }));
};

  const handleAnalyze = async () => {
  if (networkStatus === 'offline') {
    setGlobalError("You’re offline. Connect to the internet to analyze outfits.");
    return;
  }
    setGlobalError(null);
    if (
      !state.imagePreviewUrl ||
      !rawFile ||
      !session ||
      state.validationStatus !== 'accepted'
    ) return;

    const occasion = state.selectedOccasion || state.customOccasion.trim();
    if (!occasion) {
      setValidationMsg("Please specify the occasion.");
      setTimeout(() => setValidationMsg(null), 3000);
      return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true }));

    try {
      const imageData = await urlToData(state.imagePreviewUrl);
      const fileExt = rawFile.name.split('.').pop();
      const fileName = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`;

      await supabase.storage.from('outfits').upload(fileName, rawFile, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('outfits').getPublicUrl(fileName);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await withTimeout(
  ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: imageData },
        { text: `Analyze for: ${occasion}. Style: ${state.selectedStyle}.` }
      ]
    },
    config: {
          systemInstruction: `
You are a dual-mode fashion analyst. You must perform two strictly separated steps for every request.

STEP 1: THE JUDGE (Objective Scoring)
- Evaluate strictly on fit, color harmony, silhouette, and occasion appropriateness.
- Assign a raw score from 0 to 100 based purely on visual merit.
- 0–59: Fails fundamentals
- 60–79: Average, lacks polish
- 80–89: Stylish, well-executed
- 90–100: Editorial-level quality
- CRITICAL: Do not inflate the score. If the score is below 70, at least TWO breakdown metrics MUST be 5 or lower.

STEP 2: THE SPEAKER (Subjective Feedback)
- Apply the requested feedback style ONLY to text fields.
- Do not change the numeric score.
- PUNCHLINE RULE (STRICT): The punchline must be a short impression-only statement (2 short paragraphs max).
- It must describe the vibe or social impression. No advice. Advice belongs in the Improvement Plan.

Return JSON only:
{
  "score": number,
  "breakdown": {
    "harmony": number,
    "fitBalance": number,
    "styleAlignment": number,
    "styleIntent": number
  },
  "headline": string,
  "feedback": string,
  "palette": array
}
`,
          responseMimeType: "application/json"
        }
      }),
      20000
);

      const text = await getGeminiResponseText(response);
      const result: AnalysisResult = JSON.parse(text.trim());

      const { data: insertedOutfit, error } = await supabase
  .from('OutfitData')
  .insert([{
    user_id: session.user.id,
    image_url: publicUrl,
    title: occasion,
    score: result.score,
    insight: result
  }])
  .select()
  .single();

if (error || !insertedOutfit) {
  throw new Error('Failed to persist outfit');
}

      setState(prev => ({
  ...prev,
  currentOutfitId: insertedOutfit.id_uuid, // or .id depending on schema
  analyzedAt: insertedOutfit.created_at, 
  analysisResult: result,
  imagePreviewUrl: publicUrl,
  improvementPlan: null,
  isAnalyzing: false,
}));

      setActiveTab(NavTab.RESULTS);
      setHomeRefreshKey(prev => prev + 1);

    } catch (error) {
  console.error("Analysis failed:", error);
  setGlobalError("We couldn’t analyze your outfit. Check your connection and try again.");
  setState(prev => ({ ...prev, isAnalyzing: false }));
}
  };

  const handleGeneratePlan = async () => {
    if (!state.analysisResult || !state.imagePreviewUrl) return;
    setActiveTab(NavTab.IMPROVE_PROCESSING);
    try {
      const imageData = await urlToData(state.imagePreviewUrl);
      await generateImprovementPlan(state.analysisResult, imageData);
      setActiveTab(NavTab.IMPROVE);
    } catch (error) {
      console.error("Improvement generation failed:", error);
      setActiveTab(NavTab.RESULTS);
    }
  };

  const handleTabChange = async (tab: NavTab) => {
    if (ENABLE_MONETIZATION && !isPremium && (tab === NavTab.IMPROVE || tab === NavTab.DNA)) {
      setPaywallContext('feature');
      setShowPaywall(true);
      return;
    }
    if (tab === NavTab.IMPROVE && !state.improvementPlan && state.analysisResult) {
      handleGeneratePlan();
      return;
    }
    setActiveTab(tab);
    setState(prev => ({ ...prev, isHistory: false, isProfile: false, isHome: true }));
  };

  const handleBack = () => {
    if (activeTab === NavTab.IMPROVE) { setActiveTab(NavTab.RESULTS); return; }
    if (activeTab === NavTab.RESULTS) { setActiveTab(NavTab.HOME); return; }
    if (state.isHistory || state.isProfile || state.isStyleDNA) {
      setState(prev => ({ ...prev, isHistory: false, isProfile: false, isStyleDNA: false, isHome: true }));
      setActiveTab(NavTab.HOME);
      return;
    }
    if (!state.isHome) {
      setState(prev => ({
        ...prev,
        imagePreviewUrl: null,
        selectedOccasion: null,
        customOccasion: '',
        isHome: true,
        validationStatus: 'idle',
        validationReason: null
      }));
      setActiveTab(NavTab.HOME);
      return;
    }
  };

  const handleGlobalReset = () => {
  setState({
    imagePreviewUrl: null,
    selectedStyle: FeedbackStyle.MOTIVATING,
    selectedOccasion: null,
    customOccasion: '',
    isAnalyzing: false,
    isGeneratingPlan: false,
    analysisResult: null,
    improvementPlan: null,
    improvementError: null,
    isHome: true,
    isHistory: false,
    isProfile: false,
    isStyleDNA: false,
    fromHistory: false,
    validationError: null,
    validationStatus: 'idle',
    validationReason: null,
    currentOutfitId: null,
    analyzedAt: null,
  });

  setRawFile(null);
  setIsValidated(false);

  setHomeRefreshKey(prev => prev + 1);
  delete window._fitCheckHomeLoaded;
  setActiveTab(NavTab.HOME);
};


if (showSplash) {
  return <SplashScreen onComplete={() => setShowSplash(false)} />;
}

if (!session) {
  return <Auth />;
}

// ✅ Guard: Don't render until we know auth + profile status
if (!onboardingChecked || showOnboarding === null) {
  return null; // or <LoadingScreen /> if preferred
}


if (showOnboarding) {
  return <OnboardingIntro onComplete={handleOnboardingComplete} />;
}
const canOpenStyleAI =
  state.currentOutfitId &&
  state.analysisResult &&
  state.imagePreviewUrl &&
  state.analyzedAt;

if (showStyleAI) {
  const outfitContext: OutfitContext = {
    outfitId: state.currentOutfitId,
    imageUrl: state.imagePreviewUrl!,
    title: state.selectedOccasion || 'Outfit',
    analyzedAt: state.analyzedAt!,
    analysisResult: state.analysisResult!,
    improvementPlan: state.improvementPlan,
    weatherContext: {
      currentConditions: weatherData,
    },
  };

 return (
  <StyleAIPage
    key={outfitContext.outfitId}   
    outfitContext={outfitContext}
    onClose={() => {
      setShowStyleAI(false);
      setActiveTab(NavTab.IMPROVE);
    }}
  />
);
}



  const isUploadPage = !state.isHome && !state.analysisResult && !state.improvementPlan && !state.isStyleDNA && !state.isHistory && !state.isProfile;

  return (
  <div className="min-h-screen bg-classik-beige font-manrope">
    <NetworkBanner status={networkStatus} />

    {globalError && (
      <div
        className="fixed top-20 left-1/2 -translate-x-1/2 z-[500]
                   bg-red-600 text-white text-sm font-semibold
                   px-4 py-2 rounded-full shadow-lg"
      >
        {globalError}
      </div>
    )}

    <WeatherFeed onWeatherUpdate={handleWeatherUpdate} />
    {state.isAnalyzing && <ProcessingState imagePreviewUrl={state.imagePreviewUrl} mode="analysis" />}
      {activeTab === NavTab.IMPROVE_PROCESSING && (
        <ProcessingState imagePreviewUrl={state.imagePreviewUrl} mode="improvement" />
      )}

      {ENABLE_MONETIZATION && showPaywall && <PaywallModal context={paywallContext} onClose={() => setShowPaywall(false)} />}

      <div className="min-h-screen flex flex-col">
        <main className="flex-1 relative">
          <div className={`h-full w-full ${(!state.isHistory && !state.isProfile && !isUploadPage) ? 'block' : 'hidden'}`}>
            <div className={activeTab === NavTab.HOME ? "block" : "hidden"}>
              <Homepage
                key={homeRefreshKey}
                onStart={handleStartAnalysis}
                onHistory={() => setState(prev => ({ ...prev, isHistory: true }))}
                onProfile={() => setState(prev => ({ ...prev, isProfile: true }))}
                selectedStyle={state.selectedStyle}
              />
            </div>

            {activeTab === NavTab.RESULTS && (
              <ResultsPage
                result={state.analysisResult}
                imagePreviewUrl={state.imagePreviewUrl}
                selectedStyle={state.selectedStyle}
                onRetake={() => {
                  setState(prev => ({ ...prev, analysisResult: null, imagePreviewUrl: null, isHome: false }));
                  setActiveTab(NavTab.HOME);
                }}
                onBack={handleBack}
                onGeneratePlan={handleGeneratePlan}
                isGeneratingPlan={state.isGeneratingPlan}
                improvementError={state.improvementError}
              />
            )}

           {activeTab === NavTab.IMPROVE && (
  <ImprovementPlanPage
    plan={state.improvementPlan}
    imagePreviewUrl={state.imagePreviewUrl}
    onBack={handleBack}
    onRetake={() => {
      setState(prev => ({
        ...prev,
        improvementPlan: null,
        analysisResult: null,
        imagePreviewUrl: null,
        isHome: false,
      }));
      setActiveTab(NavTab.HOME);
    }}
    currentWeather={weatherData}
    outfitScore={state.analysisResult?.score || 0}
    onOpenStyleAI={() => {
  if (!state.currentOutfitId) {
    console.error("Blocked StyleAI: outfitId missing");
    return;
  }

  setShowStyleAI(true);
}}
  />
)}

            {activeTab === NavTab.DNA && <StyleDNAPage onBack={handleBack} />}
          </div>

          {state.isProfile && (
  <ProfilePage
    onBack={handleBack}
    onHistory={() => setState(prev => ({ ...prev, isProfile: false, isHistory: true }))}
    session={session}
    onResetApp={handleGlobalReset}
  />
)}

          
{state.isHistory && (
  <HistoryPage
    onBack={handleBack}
    onSelect={(item, url) => {
      setState(prev => ({ ...prev, analysisResult: item, imagePreviewUrl: url, isHistory: false }));
      setActiveTab(NavTab.RESULTS);
    }}
    session={session}
  />
)}


{isUploadPage && (
  <UploadPage
              imagePreviewUrl={state.imagePreviewUrl}
              selectedStyle={state.selectedStyle}
              selectedOccasion={state.selectedOccasion}
              customOccasion={state.customOccasion}
              isAnalyzing={state.isAnalyzing}
              isValidated={isValidated}
              validationMsg={validationMsg || state.validationReason}
              onBack={handleBack}
              onImageSelected={handleImageSelected}
              onStyleSelect={(s) => setState(prev => ({ ...prev, selectedStyle: s }))}
              onOccasionSelect={(v) => setState(prev => ({ ...prev, selectedOccasion: v }))}
              onCustomOccasionChange={(v) => setState(prev => ({ ...prev, customOccasion: v }))}
              onAnalyze={handleAnalyze}
              validationStatus={state.validationStatus}
              isOffline={networkStatus === 'offline'}
            />
          )}
        </main>

        {!(state.isAnalyzing || (state.isGeneratingPlan && activeTab === NavTab.IMPROVE) || state.isProfile || state.isHistory || isUploadPage) && (
          <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        )}
      </div>
    </div>
  );
};

export default App;
