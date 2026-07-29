 import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  ArrowLeftIcon, ProfileIcon,
  CalendarIcon, GaugeIcon,
  CameraIcon, BellIcon, LockIcon, LogOutIcon, ChevronRightIcon,
  RefreshIcon
} from './Icons';
import { supabase } from '../lib/supabase';

// --- COMPONENTS ---

interface SettingsSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const SettingsSheet: React.FC<SettingsSheetProps> = ({
  title,
  onClose,
  children
}) => (
  <div 
    className="fixed inset-0 z-[600] flex items-end justify-center bg-classik-black/60 backdrop-blur-md animate-fade-in" 
    onClick={onClose}
  >
    <div 
      className="w-full max-w-md bg-white border-t border-classik-dark/5 rounded-t-[40px] p-8 pb-14 shadow-[0_-20px_60px_rgba(0,0,0,0.3)] transform animate-slide-up-sheet relative overflow-hidden" 
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-classik-beige/30 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-xl font-black text-classik-black tracking-tight uppercase">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 opacity-40 hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

type ActiveSheet = 'notifications' | 'privacy' | 'reset' | 'logout' | null;

interface ProfilePageProps {
  onBack: () => void;
  onHistory: () => void;
  session: Session | null;
  onResetApp: () => void; 
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onBack,
  onHistory,
  session,
  onResetApp
}) => {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
const [notifLoading, setNotifLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // STRICT PROFILE STATS STATE (single source for UI)
  const [currentStreak, setCurrentStreak] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [avgScore, setAvgScore] = useState<number | '--'>('--');
  const [styleLabel, setStyleLabel] = useState('Style Explorer');

  const firstName = session?.user?.user_metadata?.first_name || 'SAM';
  const email = session?.user?.email;

  useEffect(() => {
  if (!session?.user?.id) return;

  const loadNotificationPrefs = async () => {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('daily_style_reminders')
      .eq('user_id', session.user.id)
.maybeSingle();

    if (error) {
  console.error('Failed to load notification prefs:', error);
} else {
  setNotificationsEnabled(!!data?.daily_style_reminders);
}

setNotifLoading(false);
  };

  loadNotificationPrefs();
}, [session]);

  // --- DATA LOADING ---
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadProfileData = async () => {
      try {
       // 1. Fetch Style DNA archetype from profiles table
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('current_archetype')
  .eq('user_id', session.user.id) // ← THIS is your real column
  .maybeSingle();

if (profileError) {
  console.error('Failed to load archetype:', profileError);
  setStyleLabel('Style Explorer');
} else if (profile?.current_archetype) {
  setStyleLabel(profile.current_archetype);
} else {
  setStyleLabel('Style DNA Forming');
}

      
        // 2. Fetch all outfits (Single Query for stats)
        const { data, error } = await supabase
          .from('OutfitData')
          .select('created_at, score')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error || !data) throw error;

        // 3. Outfit count
        setHistoryCount(data.length);

        // 4. Average score
        const scored = data.filter(d => typeof d.score === 'number');
        if (scored.length > 0) {
          const total = scored.reduce((sum, i) => sum + i.score, 0);
          setAvgScore(Math.round(total / scored.length));
        } else {
          setAvgScore('--');
        }

        // 5. Streak calculation (timezone-safe, deterministic)
        const days = data.map(row => {
          const d = new Date(row.created_at);
          d.setHours(0, 0, 0, 0); // normalize
          return d.getTime();
        });

        const uniqueDays = Array.from(new Set(days)).sort((a, b) => b - a);

        let streak = 0;
        if (uniqueDays.length > 0) {
          // Check if latest is today or yesterday
          const latest = new Date(uniqueDays[0]);
          const today = new Date();
          today.setHours(0,0,0,0);
          
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          // Only count streak if latest outfit was today or yesterday
          if (latest.getTime() === today.getTime() || latest.getTime() === yesterday.getTime()) {
             let cursor = new Date(latest);
             for (const dayTs of uniqueDays) {
                if (dayTs === cursor.getTime()) {
                   streak++;
                   cursor.setDate(cursor.getDate() - 1);
                } else {
                   break;
                }
             }
          }
        }

        setCurrentStreak(streak);

      } catch (e) {
        console.error('Profile load failed:', e);
      }
    };

    loadProfileData();
  }, [session]);

  // --- UI EFFECTS ---
  useEffect(() => {
    if (activeSheet) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeSheet]);

  // --- HANDLERS ---

  const toggleNotifications = async (val: boolean) => {
  if (!session?.user?.id || notifLoading) return;

  setNotificationsEnabled(val); // optimistic UI

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: session.user.id,
        daily_style_reminders: val
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Failed to update notification prefs:', error);
    // rollback UI if needed
    setNotificationsEnabled(!val);
  }
};

 const handleResetStyleHistory = async () => {
  // 1. Guard against double clicks
  if (isResetting) return;

  // 2. No window.confirm needed. The UI Modal IS the confirmation.
  // We proceed immediately.

  // 3. Validate Session
  if (!session?.user?.id) {
    alert("Session expired. Please log in again.");
    return;
  }

  try {
    setIsResetting(true);

    // 4. Call RPC
    const { data, error } = await supabase.rpc('reset_user_history');

    // 5. Handle Network/Supabase Layer Errors
    if (error) throw error;

    // 6. Handle Logic/Database Layer Errors (from our custom JSON return)
    // Note: RPC returns 'data' as the JSON object we built in SQL
    const result = data as { success: boolean; deleted_count: number; error?: string; user?: string };

    if (!result.success) {
      throw new Error(result.error || 'Unknown database error');
    }

    console.log(`RESET COMPLETE. Deleted ${result.deleted_count} rows for user ${result.user}`);

    // 7. Clear Local Storage
    const keysToRemove = [
      'fitCheckLocalHistory', 
      'fitcheckai_profile_insights', 
      'fitcheckai_last_analyzed_count', 
      'fitCheckStreak',

    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 8. Reset UI State
    setCurrentStreak(0);
    setHistoryCount(0);
    setAvgScore('--');
    setStyleLabel('Style Explorer');
    setActiveSheet(null);

    // 9. Propagate to parent
    onResetApp();

  } catch (err: any) {
    console.error('Reset failed:', err);
    alert(`Reset Failed: ${err.message || 'Please check your connection.'}`);
  } finally {
    setIsResetting(false);
  }
};

const handleLogoutConfirm = async () => {
  console.log("LOGOUT STARTED");

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("LOGOUT ERROR:", error);
      alert("Logout failed. Try again.");
      return;
    }

    console.log("SESSION CLEARED");

    // Clear all client state
    [
      'fitCheckLocalHistory',
      'fitcheckai_profile_insights',
      'fitcheckai_last_analyzed_count',
      'fitCheckStreak',
    ].forEach(key => localStorage.removeItem(key));

    // Close modal
    setActiveSheet(null);

    // Hard redirect so user cannot go back

  } catch (err) {
    console.error("LOGOUT EXCEPTION:", err);
    alert("Unexpected logout error.");
  }
};

  const getLevelLabel = (streak: number) => {
    if (streak >= 30) return "Signature Authority";
    if (streak >= 22) return "Defined Perspective";
    if (streak >= 15) return "Aesthetic Realignment";
    if (streak >= 8) return "Established Routine";
    if (streak >= 4) return "Rhythmic Progression";
    if (streak >= 1) return "Foundation Set";
    return "Status Paused";
  };

  return (
    <div className="min-h-screen w-full bg-classik-beige text-classik-black flex flex-col font-manrope animate-fade-in relative overflow-hidden">
      
      {/* 1. Header Section */}
      <header className="sticky top-0 z-20 px-6 py-6 bg-classik-beige/95 backdrop-blur-sm flex items-center justify-between border-b border-classik-dark/5">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white/40 border border-white/20 flex items-center justify-center active:scale-95 transition-all shadow-sm">
          <ArrowLeftIcon className="w-5 h-5 text-classik-black" />
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-classik-black/40">Profile</span>
        <div className="w-10" />
      </header>

      <div className="max-w-md mx-auto px-6 py-12 flex flex-col gap-12 pb-24 flex-1 w-full">
        
        {/* 2. User Identity Card */}
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-white/40 blur-3xl rounded-full opacity-60 pointer-events-none" />
            <div className="relative w-32 h-32 rounded-full bg-white/30 backdrop-blur-2xl border border-white/60 flex items-center justify-center overflow-hidden shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_15px_35px_rgba(80,49,29,0.06)]">
              <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
              <ProfileIcon className="w-16 h-16 text-classik-taupe/40" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-1 uppercase">{firstName}</h2>
            <p className="text-sm font-bold text-classik-taupe tracking-wide mb-4 uppercase opacity-80">{styleLabel}</p>
            <div className="flex flex-col items-center gap-3">
              <div className="inline-flex items-center px-5 py-2 rounded-full bg-classik-taupe/10 text-classik-taupe text-[10px] font-black uppercase tracking-widest border border-white/40">
                {getLevelLabel(currentStreak)}
              </div>
              {email && (
                <span className="text-[11px] font-medium text-classik-taupe/60 lowercase tracking-tight">
                  {email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <button onClick={onHistory} className="col-span-1 bg-white/40 border border-white/60 rounded-3xl p-6 flex flex-col items-start gap-3 hover:bg-white/60 transition-all text-left group shadow-sm">
            <div className="w-10 h-10 rounded-full bg-classik-warm/10 flex items-center justify-center">
              <CameraIcon className="w-5 h-5 text-classik-warm" />
            </div>
            <div>
              <span className="text-4xl font-black block leading-none">{historyCount}</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Outfits</span>
            </div>
          </button>
          
          <div className="col-span-1 bg-white/40 border border-white/60 rounded-3xl p-6 flex flex-col items-start gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-classik-warm/10 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-classik-warm" />
            </div>
            <div>
              <span className="text-4xl font-black block leading-none">{currentStreak}</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Streak</span>
            </div>
          </div>
          
          <div className="col-span-2 bg-white/40 border border-white/60 rounded-3xl p-8 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#4A2E1B" strokeWidth="2" opacity="0.05" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="46" 
                    fill="none" 
                    stroke="#806248" 
                    strokeWidth="4" 
                    strokeLinecap="round" 
                    strokeDasharray="289" 
                    strokeDashoffset={289 - (289 * (typeof avgScore === 'number' ? avgScore : 0) / 100)} 
                    className="transition-all duration-1000" 
                  />
                </svg>
                <GaugeIcon className="w-6 h-6 text-classik-warm/60" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Avg Style Score</span>
              </div>
            </div>
            <span className="text-5xl font-black tracking-tighter">{avgScore}</span>
          </div>
        </div>

        {/* 4. Settings Section */}
        <div className="flex flex-col gap-10 pt-4">
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-classik-black/30 ml-4">Settings</h3>
            <div className="bg-white/40 border border-white/60 rounded-[32px] overflow-hidden divide-y divide-classik-dark/5 shadow-sm">
              <button onClick={() => setActiveSheet('notifications')} className="w-full flex items-center justify-between p-7 hover:bg-white/60 transition-colors group" >
                <div className="flex items-center gap-5">
                  <BellIcon className="w-5 h-5 text-classik-warm" />
                  <span className="text-sm font-bold tracking-tight">Notifications</span>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-20 group-hover:opacity-40" />
              </button>
              <button onClick={() => setActiveSheet('privacy')} className="w-full flex items-center justify-between p-7 hover:bg-white/60 transition-colors group" >
                <div className="flex items-center gap-5">
                  <LockIcon className="w-5 h-5 text-classik-warm" />
                  <span className="text-sm font-bold tracking-tight">Privacy & Data</span>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-20 group-hover:opacity-40" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-classik-black/30 ml-4">Account</h3>
            <div className="bg-white/40 border border-white/60 rounded-[32px] overflow-hidden divide-y divide-classik-dark/5 shadow-sm">
              <button onClick={() => setActiveSheet('reset')} className="w-full flex items-center justify-between p-7 hover:bg-red-50/50 transition-colors group" >
                <div className="flex items-center gap-5">
                  <RefreshIcon className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-bold tracking-tight text-red-500/80">Reset Style History</span>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-10" />
              </button>
              <button onClick={() => setActiveSheet('logout')} className="w-full flex items-center justify-between p-7 hover:bg-white/60 transition-colors group" >
                <div className="flex items-center gap-5">
                  <LogOutIcon className="w-5 h-5 text-classik-dark/40" />
                  <span className="text-sm font-bold tracking-tight opacity-60">Log Out Session</span>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-10" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- BOTTOM SHEETS --- */}
      {activeSheet === 'notifications' && (
        <SettingsSheet title="Notifications" onClose={() => setActiveSheet(null)}>
          <div className="flex flex-col gap-10">
            <p className="text-classik-taupe text-[15px] leading-relaxed font-medium">
              Enable notifications to receive fresh outfit insights, daily momentum reminders, and style updates.
            </p>
            <div className="flex items-center justify-between p-8 bg-white/40 rounded-[32px] border border-white shadow-sm">
              <span className="text-xs font-black uppercase tracking-widest opacity-80">Daily style reminder</span>
              <button
  disabled={notifLoading}
  onClick={() => toggleNotifications(!notificationsEnabled)}
  className={`relative w-16 h-9 rounded-full transition-all duration-500 ${
    notificationsEnabled ? 'bg-classik-dark' : 'bg-classik-dark/10'
  } ${notifLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  <div
    className={`absolute top-1 left-1 w-7 h-7 bg-white rounded-full transition-transform duration-500 transform shadow-md ${
      notificationsEnabled ? 'translate-x-7' : 'translate-x-0'
    }`}
  />
</button>
            </div>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'privacy' && (
        <SettingsSheet title="Privacy & Data" onClose={() => setActiveSheet(null)}>
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <div className="p-6 bg-white/40 rounded-[24px] border border-white">
                <p className="font-black text-[11px] uppercase tracking-widest mb-2 opacity-80">Data Sovereignty</p>
                <p className="text-classik-taupe text-[13px] leading-relaxed font-medium">Your data remains your own. We do not sell user profiles. Privacy is embedded in our styling model.</p>
              </div>
              <div className="p-6 bg-white/40 rounded-[24px] border border-white">
                <p className="font-black text-[11px] uppercase tracking-widest mb-2 opacity-80">Image Isolation</p>
                <p className="text-classik-taupe text-[13px] leading-relaxed font-medium">Analysis is performed in isolated environments. We do not use your photos for external model training.</p>
              </div>
            </div>
            <button onClick={() => setActiveSheet(null)} className="w-full h-16 rounded-full bg-classik-dark text-white font-black text-[11px] uppercase tracking-[0.3em] mt-4" >
              Acknowledge
            </button>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'reset' && (
        <SettingsSheet title="Confirm Reset" onClose={() => setActiveSheet(null)}>
          <div className="text-center space-y-10">
            <p className="text-classik-taupe text-base leading-relaxed font-medium">
              Resetting will <span className="text-red-500 font-black">permanently erase</span> your style timeline and identity DNA. This action is irreversible.
            </p>
            <div className="flex flex-col gap-4">
              <button 
  onClick={handleResetStyleHistory}
  disabled={isResetting}
  className={`w-full h-16 rounded-full text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-xl transition-all ${
    isResetting 
      ? 'bg-red-300 cursor-not-allowed' 
      : 'bg-red-500/80 active:scale-95'
  }`}
>
  {isResetting ? 'Resetting...' : 'Permanently Reset'}
</button>
              <button onClick={() => setActiveSheet(null)} className="w-full h-16 rounded-full bg-classik-black/5 text-classik-black/40 font-black text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all" >
                Keep My History
              </button>
            </div>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'logout' && (
        <SettingsSheet title="Sign Out" onClose={() => setActiveSheet(null)}>
          <div className="text-center space-y-10">
            <p className="text-classik-taupe text-base leading-relaxed font-medium">
              Do you wish to conclude your current session?
            </p>
            <div className="flex flex-col gap-4">
              <button onClick={handleLogoutConfirm} className="w-full h-16 rounded-full bg-classik-dark text-white font-black text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all shadow-xl" >
                Yes, Sign Out
              </button>
              <button onClick={() => setActiveSheet(null)} className="w-full h-16 rounded-full bg-classik-black/5 text-classik-black/40 font-black text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all" >
                Stay Logged In
              </button>
            </div>
          </div>
        </SettingsSheet>
      )}
    </div>
  );
};

