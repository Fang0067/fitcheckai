import React, { useState, useEffect, useRef } from 'react';
import { FitCheckLogo } from './FitCheckLogo';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SendIcon, ArrowLeftIcon } from './Icons';
import { supabase } from '../lib/supabase';
import { useUser } from '../auth/useUser';
import { 
  getOrCreateConversation, 
  loadMessages,
  saveMessage,
  type StyleAIMessage 
} from '../lib/styleAIMemory';

const GEMINI_API_KEY = "AIzaSyBBAev3pWSCq-47MGF79gSYBTgO0nI50z0";


import { OutfitContext } from '../types';

interface StyleAIPageProps {
  outfitContext: OutfitContext;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  content: string; // changed from 'text' to 'content'
}

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
  </svg>
);


const SYSTEM_INSTRUCTION = `
Role & Identity

You are StyleAI, a professional digital fashion stylist operating exclusively inside the Style AI page of the FitCheck app.

You are instantiated, executed, and used ONLY inside the StyleAI.tsx component of the FitCheck application.
You do not exist anywhere else in the app.

If you are asked to behave as if you are:
- on the homepage
- on the upload page
- on the improvement page
- on the results page
- on the Style DNA page
- in user history
- in settings, navigation, or profile

you MUST refuse and redirect politely.

You are bound at runtime to StyleAI.tsx only.
You must behave as if StyleAI.tsx is the only environment you are aware of.

---

EXECUTION CONTEXT (NON-NEGOTIABLE)

You are mounted inside the Style AI chat interface.
You receive:
- conversational text input
- optional image context already provided
- optional plan/context passed into StyleAI.tsx

You CANNOT:
- trigger navigation
- reference other pages
- ask users to upload images
- ask users to re-run analysis
- mention internal app flows or UI steps

If a user asks about anything outside styling advice, respond only with:
"I'm here specifically to help with outfit and styling questions."

Then immediately return to styling guidance.

---

PRIMARY FUNCTION

Your sole function inside StyleAI.tsx is to act as a
professional digital stylist through conversation.

You help users reason through outfit decisions.
You do not score outfits.
You do not judge outfits.
You do not act as a fashion encyclopedia.

You act like a real stylist thinking with the user.

---

GEMINI INTELLIGENCE RESPONSIBILITIES

You must actively reason across multiple factors at once:

• outfit composition
• fit and silhouette
• body type (handled respectfully, never critically)
• color harmony and contrast
• complexion / skin tone (only when relevant)
• weather conditions
• occasion and social context
• location or cultural expectations (if mentioned)

You must combine these factors instead of treating them in isolation.

---

OUTFIT ANALYSIS RULES

If an image is provided:
- analyze fit, proportions, balance, and cohesion
- assess how items work together as a whole

If no image is provided:
- reason from the user's description

You MUST NOT:
- ask for another image
- ask the user to upload anything
- imply missing steps in the app

---

FIT & BODY LOGIC

• Adapt advice for slim, average, athletic, bulky, and plus-size builds
• Focus on proportion and balance
• Suggest alternatives without shaming
• Never imply the body is the problem

Fit advice must feel constructive, not corrective.

---

COLOR INTELLIGENCE

• Evaluate harmony, contrast, and dominance
• Consider complexion compatibility when appropriate
• If a suggested color is unavailable, immediately provide alternatives
• Explain color reasoning briefly and clearly

No vague color advice.

---

CONSTRAINT-BASED THINKING

Assume users have limited wardrobes.

When recommending changes:
• Suggest substitutes
• Work with existing items
• Offer multiple realistic options
• Avoid "ideal world" recommendations

You must stay practical.

---

MULTI-OCCASION REASONING

Help users:
• adapt one outfit to multiple occasions
• modify details instead of replacing everything
• understand where an outfit works and where it doesn't

---

CONVERSATION BEHAVIOR

• Respond naturally and conversationally
• Acknowledge user intent first
• Explain WHY suggestions help
• Ask at most ONE clarifying question, only if necessary
• Match response length to user input

Avoid:
• generic advice
• fashion clichés
• lectures
• repeated suggestions

---

TONE

You are:
• calm
• professional
• supportive
• practical
• non-judgmental

You are NOT:
• hype-driven
• arrogant
• robotic
• dismissive

Never say:
• "I am an AI model"
• "This is bad"
• "This is wrong"
• "You must"

---

FINAL HARD RULE

Every response must make sense as a stylist speaking to a client
inside the StyleAI.tsx page.

You do not exist elsewhere.
You do not reference elsewhere.
You do not think elsewhere.

If a request breaks scope, redirect back to styling advice immediately.
`;

const buildSystemInstruction = (context: OutfitContext): string => {
  return `
${SYSTEM_INSTRUCTION}

OUTFIT CONTEXT (LOCKED FOR THIS CONVERSATION):

You are advising on ONE specific outfit with the following verified data.

Occasion: ${context.title}
Analyzed At: ${new Date(context.analyzedAt).toLocaleDateString()}

ANALYSIS SUMMARY:
Overall Score: ${context.analysisResult.score}/100

Breakdown:
- Harmony: ${context.analysisResult.breakdown.harmony}/10
- Fit Balance: ${context.analysisResult.breakdown.fitBalance}/10
- Style Alignment: ${context.analysisResult.breakdown.styleAlignment}/10
- Style Intent: ${context.analysisResult.breakdown.styleIntent}/10

Color Palette:
${context.analysisResult.palette.join(', ')}

${
  context.improvementPlan
    ? `
IMPROVEMENT PLAN CONTEXT:
Primary Focus: ${context.improvementPlan.diagnosticSummary.primaryIssue}
Winning Elements: ${context.improvementPlan.winningElements.join(', ')}
`
    : `
No improvement plan has been generated yet.
`
}

${
  context.weatherContext
    ? `
WEATHER CONTEXT:
${context.weatherContext.currentConditions}
${context.weatherContext.weatherNote ?? ''}
`
    : ''
}

CRITICAL RULES:
- You MUST ground all answers in this outfit’s data.
- You MUST NOT invent scores, colors, or feedback.
- You MUST NOT reference other outfits or past analyses.
- If asked about something not present here, say you don’t have that information.
`;
};

const urlToInlineData = async (url: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({
      inlineData: {
        data: (reader.result as string).split(',')[1],
        mimeType: blob.type
      }
    });
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const StyleAIPage: React.FC<StyleAIPageProps> = ({
  outfitContext,
  onClose,
}) => {
  if (!outfitContext) {
    return null; // or loading skeleton
  }

  const {
    outfitId,
    imageUrl,
    analysisResult,
    improvementPlan,
    weatherContext,
  } = outfitContext;

   const [hasImageBeenSent, setHasImageBeenSent] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');

  



  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = useUser();
  useEffect(() => {
  console.log("[AUTH CHECK] user →", user);
  console.log("[AUTH CHECK] user.id →", user?.id);
}, [user]);

  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
  console.log('[STYLE AI RESET] New outfit detected → clearing chat state');

  setMessages([]);
  setConversationId(null);
  setHasImageBeenSent(false);
}, [outfitId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
  if (!user?.id) {
    console.error('[STYLE AI BLOCKED] Missing user.id');
    return;
  }

  if (!outfitId) {
    console.error('[STYLE AI BLOCKED] Missing outfitId');
    return;
  }

  const initializeConversation = async () => {
    try {
      console.log('[STYLE AI INIT]', {
        userId: user.id,
        outfitId,
      });

      const convId = await getOrCreateConversation({
        userId: user.id,
        outfitId,
      });

      setConversationId(convId);

      const existingMessages = await loadMessages(convId);

      if (existingMessages.length > 0) {
        setHasImageBeenSent(true);
      }

      setMessages(
        existingMessages.map(msg => ({
          role: msg.role as 'user' | 'model',
          content: msg.content,
        }))
      );
    } catch (err) {
      console.error('[STYLE AI INIT ERROR]', err);
    }
  };

  initializeConversation();
}, [user?.id, outfitId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

 

  const handleSendMessage = async () => {
  if (!inputText.trim() || isTyping || !conversationId) return;

  const userMessageText = inputText.trim();
  setInputText('');
  
  // Add user message to UI immediately (optimistic update)
  const userMessageUI: Message = { role: 'user', content: userMessageText };
  setMessages(prev => [...prev, userMessageUI]);
  setIsTyping(true);

  try {
    // Save user message to database
    await saveMessage({
      conversationId,
      role: 'user',
      content: userMessageText,
    });

    console.log('[SEND] User message saved');

    // Prepare AI request
    const ai = new GoogleGenAI({
      apiKey: process.env.API_KEY
    });
    
    let historyParts: any[] = [];

// 1. Send image ONCE, only if not yet sent
if (!hasImageBeenSent) {
  const imagePart = await urlToInlineData(imageUrl);

  historyParts.push({
    role: 'user',
    parts: [
      imagePart,
      { text: "This is the outfit I'm asking about." }
    ]
  });

  historyParts.push({
    role: 'model',
    parts: [{ text: "I've reviewed your outfit. What would you like to explore?" }]
  });

  setHasImageBeenSent(true);
}

// 2. Append conversation history (TEXT ONLY)
messages.forEach(msg => {
  historyParts.push({
    role: msg.role,
    parts: [{ text: msg.content }]
  });
});

// 3. Append the new user message
historyParts.push({
  role: 'user',
  parts: [{ text: userMessageText }]
});

    // Call AI API
   const response = await ai.models.generateContentStream({
  model: 'gemini-2.5-flash-lite',
  contents: historyParts,
  config: {
    systemInstruction: buildSystemInstruction(outfitContext)
  }
});
    
    let fullResponse = "";
    
    // Add empty AI message for streaming
    setMessages(prev => [...prev, { role: 'model', content: "" }]);

    // Stream the response
    for await (const chunk of response) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        fullResponse += c.text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullResponse;
          return updated;
        });
      }
    }

    // Save AI response to database
    await saveMessage({
      conversationId,
      role: 'model',
      content: fullResponse,
    });

    console.log('[SEND] AI response saved');

  } catch (error) {
    console.error('[SEND ERROR] Chat error:', error);
    setMessages(prev => [...prev, { 
      role: 'model', 
      content: "I'm having trouble connecting right now. Please try again." 
    }]);
  } finally {
    setIsTyping(false);
  }
};

  // --- AUDIO LOGIC (unchanged) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await handleTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone initialization failed:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = audioBlob.type || 'audio/webm';

        const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: "Transcribe the audio to text. Return only the transcription." }
            ]
          }
        });

        const text = response.text;
        
        if (text) {
          setInputText(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${text.trim()}` : text.trim();
          });
        }
        setIsTranscribing(false);
      };
    } catch (error) {
      console.error("Transcription failed:", error);
      setIsTranscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-classik-beige font-manrope flex flex-col animate-fade-in">
      
      {/* HEADER */}
      <header className="flex-none h-20 flex items-center justify-between px-6 bg-classik-beige/95 backdrop-blur-sm border-b border-classik-dark/5 z-10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/40 border border-white/20 flex items-center justify-center active:scale-95 transition-all shadow-sm"
        >
          <ArrowLeftIcon className="w-5 h-5 text-classik-black" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <FitCheckLogo className="w-5 h-5 text-classik-dark" />
            <span className="text-sm font-black uppercase tracking-[0.15em] text-classik-black">Style AI</span>
          </div>
          <span className="text-[9px] font-bold text-classik-taupe uppercase tracking-widest mt-0.5">Your Personal Stylist</span>
        </div>

        <div className="w-10" /> 
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={idx} 
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div 
                className={`
                  max-w-[85%] rounded-[24px] p-5 text-sm font-medium leading-relaxed tracking-tight
                  ${isUser 
                    ? 'bg-classik-dark text-white rounded-br-none shadow-lg' 
                    : 'bg-white/60 text-classik-black border border-white/60 rounded-bl-none shadow-sm backdrop-blur-md'}
                `}
              >
{msg.content}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white/40 text-classik-black border border-white/40 rounded-[24px] rounded-bl-none p-4 shadow-sm backdrop-blur-md flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-classik-black/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-classik-black/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-classik-black/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="flex-none p-6 pb-8 bg-gradient-to-t from-classik-beige via-classik-beige to-transparent">
        <div className="relative flex items-center gap-3">
          {/* TEXT INPUT */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isRecording
                ? "Listening..."
                : isTranscribing
                ? "Transcribing..."
                : "Ask about alternatives, colors..."
            }
            disabled={isTyping || isRecording || isTranscribing}
            className="w-full h-14 bg-white/60 backdrop-blur-xl border border-white rounded-full px-6 text-sm font-bold text-classik-black placeholder-classik-black/30 shadow-sm focus:outline-none focus:border-classik-dark/20 focus:bg-white/80 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          />

          {/* MIC BUTTON */}
          <button
            onClick={toggleRecording}
            disabled={isTyping || isTranscribing}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
              ${
                isRecording
                  ? 'bg-red-500 text-white shadow-lg animate-pulse'
                  : isTranscribing
                  ? 'bg-classik-dark/10 text-classik-black/40 cursor-wait'
                  : 'bg-white/40 text-classik-black/60 border border-white hover:bg-white/60 active:scale-95'
              }
              ${isTyping ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isTranscribing ? (
              <div className="w-5 h-5 border-2 border-classik-dark/30 border-t-classik-dark rounded-full animate-spin" />
            ) : (
              <MicIcon className="w-5 h-5" />
            )}
          </button>

          {/* SEND BUTTON */}
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isTyping || isRecording || isTranscribing}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
              ${
                (!inputText.trim() || isTyping || isRecording || isTranscribing)
                  ? 'bg-white/40 text-classik-black/20 cursor-default'
                  : 'bg-classik-dark text-white shadow-lg active:scale-95 hover:bg-classik-dark/90'
              }
            `}
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};