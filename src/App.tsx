import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { firebaseApiFetch } from './lib/firebaseApi';
import { trackEvent, setAnalyticsAdminFlag } from './lib/analytics';
import { supabase } from './integrations/supabase/client';
import {
  TIME_RANGE,
  TIME_RANGE_OPTIONS,
  POINTS_CAPTION,
  STATS_CAPTION,
  type TimeRange,
} from './lib/timeRanges';
import { isWithinRange, type DateRange } from './lib/timeRanges';
import { TimeRangeFilter, createDefaultTimeRangeValue, type TimeRangeValue } from './components/TimeRangeFilter';
import {
  StudentSearchFilter,
  applyStudentSearchFilter,
  emptyStudentSearchFilter,
  type StudentSearchFilterValue,
} from './components/StudentSearchFilter';
import { StudentSortDropdown, sortStudents, type SortKey } from './components/StudentSortDropdown';
import { StudentSearchAdvanced } from './components/StudentSearchAdvanced';
import { AdminImportExportTab } from './components/AdminImportExportTab';
import { AdminBackendTab } from './components/AdminBackendTab';
import { 
  Trophy, ArrowLeft, Plus, CheckCircle2, Circle, Medal, Award, Flame, 
  Settings, Search, Edit, Trash2, X, ChevronDown, ChevronUp, Users, 
  Target, FolderTree, Info, CheckSquare, Square, LogIn, LogOut, Loader2,
  Home, User as UserIcon, LayoutDashboard, MoreHorizontal, ArrowUp, ArrowDown,
  Palette, Save, Image as ImageIcon, TrendingUp, Crown, ZoomIn, ZoomOut,
  Database, Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Cropper from 'react-easy-crop';

// --- TYPES ---
interface Category {
  id: string;
  name: string;
}

interface MasterGoal {
  id: string;
  categoryId: string;
  title: string;
  points: number;
  description: string;
}

interface AssignedGoal {
  goalId: string;
  completed: boolean;
  completedAt?: string;
}

interface Student {
  id: string;
  name: string;
  bio: string;
  photo: string;
  tags?: string[];
  assignedGoals: AssignedGoal[];
  totalPoints?: number;
  previousRank?: number;
  createdAt?: string;
}

function ActionMenu({ onEdit, onDelete, placement = 'bottom-end' }: { onEdit: () => void, onDelete: () => void, placement?: 'bottom-end' | 'top-center' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const placementClass = placement === 'top-center' 
    ? 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-base-100 rounded-2xl border border-base-200 shadow-xl overflow-hidden z-50' 
    : 'absolute right-0 top-full mt-1 w-32 bg-base-100 rounded-2xl border border-base-200 shadow-xl overflow-hidden z-50';

  const animationProps = placement === 'top-center'
    ? { initial: { opacity: 0, y: 5, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 5, scale: 0.95 } }
    : { initial: { opacity: 0, y: -5, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -5, scale: 0.95 } };

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="p-1.5 hover:bg-base-200 rounded-lg text-text-light hover:text-text-main transition-colors"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      <AnimatePresence>
        {isOpen && (
           <motion.div 
             {...animationProps}
             transition={{ duration: 0.1 }}
             className={placementClass}
           >
             <button 
               onClick={(e) => { e.stopPropagation(); setIsOpen(false); onEdit(); }} 
               className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-main hover:bg-base-50 transition-colors"
             >
               <Edit className="w-4 h-4 text-primary-500" /> Edit
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); setIsOpen(false); onDelete(); }} 
               className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors border-t border-base-100"
             >
               <Trash2 className="w-4 h-4" /> Delete
             </button>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-base-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
      <div className="bg-base-100 rounded-[2rem] shadow-2xl p-8 max-w-sm w-full text-center">
        <h3 className="text-xl font-black text-text-main mb-2">{title}</h3>
        <p className="text-sm text-text-muted mb-8">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-3 rounded-xl bg-base-200 text-text-muted font-bold hover:bg-base-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-base-50 font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-200">Delete</button>
        </div>
      </div>
    </div>
  );
}

function RankMovement({ currentRank, previousRank }: { currentRank: number, previousRank?: number }) {
  if (previousRank === undefined || previousRank === null || previousRank === currentRank) {
    return <div className="text-base-300 font-bold text-xs flex items-center justify-center w-6">—</div>;
  }
  
  if (currentRank < previousRank) {
    return (
      <div className="flex flex-col items-center justify-center px-1.5 py-1 bg-accent-50/50 rounded-lg shrink-0">
        <ArrowUp className="w-3.5 h-3.5 text-accent-500" strokeWidth={3} />
        <span className="text-[10px] font-bold text-accent-600">{previousRank - currentRank}</span>
      </div>
    );
  } else {
    return (
      <div className="flex flex-col items-center justify-center px-1.5 py-1 bg-red-50 rounded-lg shrink-0">
        <ArrowDown className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
        <span className="text-[10px] font-bold text-red-600">{currentRank - previousRank}</span>
      </div>
    );
  }
}

const getLocalToken = () => {
  try {
    return localStorage.getItem('admin_token');
  } catch (e) {
    console.warn("localStorage is disabled or not accessible:", e);
    return window.__inMemoryToken || null;
  }
};

const setLocalToken = (token: string) => {
  try {
    localStorage.setItem('admin_token', token);
  } catch (e) {
    console.warn("localStorage is disabled, storing token in memory:", e);
    window.__inMemoryToken = token;
  }
};

const removeLocalToken = () => {
  try {
    localStorage.removeItem('admin_token');
  } catch (e) {
    window.__inMemoryToken = null;
  }
};

declare global {
  interface Window {
    __inMemoryToken?: string | null;
  }
}

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = getLocalToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Wrap every call in a per-request AbortController so a single hung backend
  // request can never block the entire UI loader forever. 20s is generous
  // for Supabase under load but short enough to surface real failures.
  const isWrite = (options.method || 'GET').toUpperCase() !== 'GET';
  const TIMEOUT_MS = isWrite ? 30000 : 20000;
  const userSignal = (options as any).signal as AbortSignal | undefined;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new DOMException('timeout', 'AbortError')), TIMEOUT_MS);
  if (userSignal) {
    if (userSignal.aborted) ctl.abort();
    else userSignal.addEventListener('abort', () => ctl.abort(), { once: true });
  }

  const doFetch = () =>
    url.startsWith('/api/')
      ? firebaseApiFetch(url, { ...options, headers, signal: ctl.signal })
      : fetch(url, { ...options, headers, credentials: 'same-origin', cache: 'no-store', signal: ctl.signal });

  try {
    let res: Response;
    try {
      res = await doFetch();
    } catch (err: any) {
      // One quick retry on transient network blips for idempotent reads only.
      if (!isWrite && err?.name !== 'AbortError') {
        await new Promise((r) => setTimeout(r, 300));
        res = await doFetch();
      } else {
        throw err;
      }
    }
    if (res.status === 401) {
      removeLocalToken();
      window.dispatchEvent(new Event('auth-expired'));
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
};

// --- APP COMPONENT ---
export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [masterGoals, setMasterGoals] = useState<MasterGoal[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState<any>({});
  
  const [currentRoute, setCurrentRoute] = useState<{ path: string; params: { id?: string } }>({ path: '/', params: {} });

  // Navigation Helper
  const navigateTo = (path: string, params = {}) => {
    setCurrentRoute({ path, params });
    window.scrollTo(0, 0);
  };

  // Auth Check
  useEffect(() => {
    const handleAuthExpired = () => {
      setIsAdmin(false);
      navigateTo('/login');
    };
    window.addEventListener('auth-expired', handleAuthExpired);

    const checkAuth = async () => {
      try {
        const res = await apiFetch('/api/me');
        if (!res.ok) throw new Error("Auth check failed");
        const data = await res.json();
        setIsAdmin(!!data.authenticated);
        setAnalyticsAdminFlag(!!data.authenticated);
      } catch (err) {
        console.error("Auth check error:", err);
        setIsAdmin(false);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkAuth();
    
    // Track unique view basically (once per loaded session)
    apiFetch('/api/track-visit', { method: 'POST' }).catch(() => {});
    // Rich app-event tracking (visitor + device).
    trackEvent('page_view');

    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

    // Data Loading — coalesces concurrent calls so rapid CRUD bursts don't
    // trigger a fetch storm against the backend (which is what was producing
    // the long buffering / white-screen behaviour).
  const refreshInflight = useRef<Promise<void> | null>(null);
  const refreshData = useCallback((showLoader = true) => {
    if (refreshInflight.current) return refreshInflight.current;
    if (showLoader) setIsLoading(true);
    const run = (async () => {
      try {
        const [catsRes, goalsRes, studentsRes, settingsRes] = await Promise.all([
          apiFetch('/api/categories'),
          apiFetch('/api/masterGoals'),
          apiFetch('/api/students'),
          apiFetch('/api/settings'),
        ]);
      
      const cats = catsRes.ok ? await catsRes.json() : [];
      const goals = goalsRes.ok ? await goalsRes.json() : [];
      const stus = studentsRes.ok ? await studentsRes.json() : [];
      let sets = settingsRes.ok ? await settingsRes.json() : {};
      
      // Fallback defaults if setting is empty (Cold Start Theme Bug Fix)
      if (!sets || Object.keys(sets).length === 0 || !sets.primaryColor) {
        sets = {
          ...sets,
          primaryColor: { h: 144, s: 29, l: 20 },
          accentColor: { h: 34, s: 62, l: 57 },
          bgColor: { h: 79, s: 29, l: 92 },
          textColor: { h: 144, s: 18, l: 15 },
          appName: sets.appName || 'Tiny Tree',
          badgeTitle: sets.badgeTitle || 'Bonsai Collection',
          heroTitle: sets.heroTitle || 'Bonsai',
          heroSubtitle: sets.heroSubtitle || 'The fascinating and amazing world of Bonsai.'
        };
      }

      setCategories(Array.isArray(cats) ? cats : []);
      setMasterGoals(Array.isArray(goals) ? goals : []);
      setStudents(Array.isArray(stus) ? stus : []);
      setAppSettings(sets);

      if (sets && sets.appName) {
        document.title = sets.appName;
      } else {
        document.title = 'Tiny Tree';
      }

      // Apply theme CSS variables immediately 
      applyThemeColors(sets);

      } catch (err) {
        console.error('Failed to load data', err);
      } finally {
        setIsLoading(false);
        refreshInflight.current = null;
      }
    })();
    refreshInflight.current = run;
    return run;
  }, []);

  useEffect(() => {
    refreshData();
  }, []);

  // When the user switches the active database (Lovable Cloud ↔ external
  // Supabase) we must immediately reload all app data so the UI reflects the
  // newly-selected backend instead of stale rows from the previous one.
  useEffect(() => {
    // Debounce: rapid CRUD bursts in the admin panel can dispatch this event
    // many times within a few milliseconds. Collapse them into one refresh.
    let t: any = null;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(() => refreshData(false), 150);
    };
    window.addEventListener('db-connection-changed', handler);
    return () => {
      window.removeEventListener('db-connection-changed', handler);
      clearTimeout(t);
    };
  }, [refreshData]);

  const calculateTotalPoints = useCallback((assignedGoals: AssignedGoal[]) => {
    if (!assignedGoals || !masterGoals) return 0;
    return assignedGoals.reduce((total, assigned) => {
      if (assigned.completed) {
        const goalData = masterGoals.find(mg => String(mg.id) === String(assigned.goalId));
        if (goalData) {
          const pts = goalData.points !== undefined ? goalData.points : (goalData as any).pointValue || (goalData as any).pts || 0;
          const numPts = typeof pts === 'number' ? pts : parseInt(String(pts), 10);
          return total + (isNaN(numPts) ? 0 : numPts);
        }
      }
      return total;
    }, 0);
  }, [masterGoals]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="fixed inset-0 bg-base-50 flex flex-col items-center justify-center z-50">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
        <p className="text-primary-800 font-bold tracking-widest uppercase text-xs">Loading Application...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 text-text-main font-sans flex flex-col pb-20 md:pb-0">
      {/* Navbar Global */}
      <nav className="bg-base-100/80 backdrop-blur-md border-b border-base-200 sticky top-0 z-40 shadow-sm hidden md:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => navigateTo('/')}
            >
              {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-xl" />
              ) : (
                <div className="bg-primary-600 p-2 rounded-xl group-hover:rotate-6 transition-transform">
                  <Trophy className="h-6 w-6 text-base-50" />
                </div>
              )}
              <span className="font-bold text-xl tracking-tight text-text-main">
                {appSettings.appName || 'Tiny Tree'}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigateTo('/')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${currentRoute.path === '/' ? 'bg-primary-50 text-primary-600' : 'text-text-muted hover:bg-base-200'}`}
              >
                Leaderboard
              </button>
              
              {isAdmin ? (
                <>
                  <button 
                    onClick={() => navigateTo('/admin')}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${currentRoute.path === '/admin' ? 'bg-primary-600 text-base-50 shadow-lg' : 'text-text-muted hover:bg-base-200'}`}
                  >
                    <Settings className="h-4 w-4" /> Admin Panel
                  </button>
                  <button 
                    onClick={async () => {
                      await apiFetch('/api/logout', { method: 'POST' });
                      removeLocalToken();
                      setIsAdmin(false);
                      setAnalyticsAdminFlag(false);
                      trackEvent('admin_logout', { isAdmin: true });
                      navigateTo('/');
                    }}
                    className="p-2 text-text-light hover:text-red-500 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => navigateTo('/login')}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-primary-600 hover:bg-primary-50 border border-primary-200 transition-all"
                >
                  Admin Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentRoute.path + (currentRoute.params.id || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {currentRoute.path === '/' && (
              <LeaderboardPage students={students} masterGoals={masterGoals} calculateTotalPoints={calculateTotalPoints} navigateTo={navigateTo} isLoading={isLoading} appSettings={appSettings} />
            )}
            {currentRoute.path === '/student' && (
              <StudentProfilePage 
                studentId={currentRoute.params.id || ''} 
                students={students} 
                masterGoals={masterGoals}
                categories={categories}
                calculateTotalPoints={calculateTotalPoints}
                navigateTo={navigateTo}
              />
            )}
            {currentRoute.path === '/login' && <LoginPage onLogin={() => {
              setIsAdmin(true);
              setAnalyticsAdminFlag(true);
              trackEvent('admin_login', { isAdmin: true });
              navigateTo('/admin');
            }} appSettings={appSettings} />}
            {currentRoute.path === '/admin' && (
              isAdmin ? (
                <AdminDashboard 
                  students={students} refreshData={refreshData}
                  masterGoals={masterGoals} 
                  categories={categories} 
                  calculateTotalPoints={calculateTotalPoints}
                  appSettings={appSettings}
                  setAppSettings={setAppSettings}
                />
              ) : <LoginPage onLogin={() => {
                setIsAdmin(true);
                setAnalyticsAdminFlag(true);
                trackEvent('admin_login', { isAdmin: true });
              }} appSettings={appSettings} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-200 px-8 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-between items-center md:hidden z-50">
        <button 
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(50);
            navigateTo('/');
          }}
          className={`flex flex-col items-center gap-1.5 transition-colors ${currentRoute.path === '/' || currentRoute.path === '/student' ? 'text-primary-600' : 'text-text-light hover:text-text-muted'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>

        {appSettings?.logoUrl ? (
          <div className="w-16 h-16 -mt-8 rounded-full border-4 border-base-200 bg-base-100 shadow-sm flex items-center justify-center overflow-hidden z-10 cursor-pointer active:scale-95 transition-transform" onClick={() => navigateTo('/')}>
             <img src={appSettings.logoUrl} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 -mt-8 rounded-full border-4 border-base-200 bg-base-100 shadow-sm flex items-center justify-center z-10 text-primary-500 cursor-pointer active:scale-95 transition-transform" onClick={() => navigateTo('/')}>
             <Trophy className="w-8 h-8" />
          </div>
        )}

        <button 
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(50);
            if (isAdmin) navigateTo('/admin'); else navigateTo('/login');
          }}
          className={`flex flex-col items-center gap-1.5 transition-colors ${currentRoute.path === '/admin' || currentRoute.path === '/login' ? 'text-primary-600' : 'text-text-light hover:text-text-muted'}`}
        >
          {isAdmin ? <LayoutDashboard className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
          <span className="text-[10px] font-bold uppercase tracking-wider">{isAdmin ? 'Admin' : 'Login'}</span>
        </button>
      </nav>
    </div>
  );
}

// --- LOGIN PAGE ---
function LoginPage({ onLogin, appSettings }: { onLogin: () => void, appSettings?: any }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) setLocalToken(data.token);
        onLogin();
      } else {
        setError('Invalid password. Please try again.');
      }
    } catch (err) {
      console.error("Login fetch error:", err);
      setError(`An error occurred: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-12">
      <div className="bg-base-100 rounded-3xl p-8 shadow-xl border border-base-200">
        <div className="text-center mb-8">
          {appSettings?.logoUrl ? (
            <img src={appSettings.logoUrl} alt="Logo" className="w-20 h-20 object-contain mx-auto mb-4" />
          ) : (
            <div className="w-16 h-16 bg-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
              <Settings className="w-8 h-8 text-base-50" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-text-main">{appSettings?.appName || 'Admin Login'}</h1>
          <p className="text-text-muted mt-1">Access restricted to authorized educators only.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Access Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-base-200 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all outline-none"
              placeholder="••••••••"
              required
            />
            {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary-600 py-3 rounded-2xl text-base-50 font-bold text-lg shadow-lg shadow-primary-100 hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Authorize Access"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- LEADERBOARD PAGE ---
function LeaderboardPage({ students, masterGoals, calculateTotalPoints, navigateTo, isLoading, appSettings }: { 
  students: Student[]; 
  masterGoals: MasterGoal[];
  calculateTotalPoints: (goals: AssignedGoal[]) => number; 
  navigateTo: (path: string, params?: any) => void;
  isLoading: boolean;
  appSettings?: any;
}) {
  const [timeFilter, setTimeFilter] = useState<TimeRange>(TIME_RANGE.ALL_TIME);
  const [searchFilter, setSearchFilter] = useState<StudentSearchFilterValue>(emptyStudentSearchFilter);
  const [sortKey, setSortKey] = useState<SortKey>('points');

  const sortedStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];

    const now = new Date();
    
    // Boundaries setup
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Monday 00:00 boundary for Weekly
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day; 
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const filterGoals = (goals: AssignedGoal[]) => {
      if (!goals || !Array.isArray(goals)) return [];
      
      return goals.filter(g => {
        if (!g.completed) return false;
        
        // "all-time" includes all completed goals regardless of date
        if (timeFilter === TIME_RANGE.ALL_TIME) return true;
        
        // "Monthly" and "Weekly" require completedAt to check boundaries
        if (!g.completedAt) return false;
        
        const completionDate = new Date(g.completedAt);
        const compTime = completionDate.getTime();
        
        // Robust check for invalid date
        if (isNaN(compTime)) return false;
        
        if (timeFilter === TIME_RANGE.MONTHLY) {
          return compTime >= startOfMonth.getTime();
        }
        if (timeFilter === TIME_RANGE.WEEKLY) {
          return compTime >= startOfWeek.getTime();
        }
        return false;
      });
    };

    const studentsWithPoints = students.map(student => {
      const filteredGoals = filterGoals(student.assignedGoals || []);
      
      // Calculate points internally for maximum reliability and to avoid stale closures
      const totalPoints = filteredGoals.reduce((total, assigned) => {
        const goalData = masterGoals.find(mg => String(mg.id) === String(assigned.goalId));
        if (goalData) {
          const pts = goalData.points !== undefined ? goalData.points : (goalData as any).pointValue || (goalData as any).pts || 0;
          const numPts = typeof pts === 'number' ? pts : parseInt(String(pts), 10);
          return total + (isNaN(numPts) ? 0 : numPts);
        }
        return total;
      }, 0);
      
      // Secondary Sort: Most recently achieved points comes first
      const lastCompletion = filteredGoals.reduce((max, g) => {
        if (!g.completedAt) return max;
        const compTime = new Date(g.completedAt).getTime();
        return isNaN(compTime) ? max : (compTime > max ? compTime : max);
      }, 0);

      return {
        ...student,
        totalPoints,
        lastCompletion
      };
    });

    return [...studentsWithPoints].sort((a, b) => {
      // Primary Sort: Total points descending
      const ptsA = a.totalPoints || 0;
      const ptsB = b.totalPoints || 0;
      if (ptsB !== ptsA) {
        return ptsB - ptsA;
      }
      // Secondary Sort: Recent achievement (as per "baru sampai lama" request)
      return (b.lastCompletion || 0) - (a.lastCompletion || 0);
    });
  }, [students, masterGoals, calculateTotalPoints, timeFilter]);

  const top3 = [sortedStudents[1], sortedStudents[0], sortedStudents[2]];
  const restOfStudentsRaw = sortedStudents.slice(3);
  const restOfStudents = useMemo(() => {
    const filtered = applyStudentSearchFilter(restOfStudentsRaw, searchFilter);
    // Default leaderboard ordering is points-desc and is already produced upstream;
    // only re-sort when the user picks a different key.
    return sortKey === 'points' ? filtered : sortStudents(filtered, sortKey);
  }, [restOfStudentsRaw, searchFilter, sortKey]);
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    (students || []).forEach((s) => (s.tags || []).forEach((t) => t && set.add(t)));
    return Array.from(set);
  }, [students]);
  const studentTagSource = useMemo(
    () => (students || []).map((s) => s.tags || []),
    [students]
  );
  const hasActiveFilter = !!(searchFilter.query || searchFilter.tags.length > 0);

  // Mocking "My Rank": User yang sedang login (Demo purpose, taking first student)
  const currentLoggedInStudentId = students[0]?.id;
  const myRankIndex = sortedStudents.findIndex(s => s.id === currentLoggedInStudentId);
  const myRankData = myRankIndex !== -1 ? sortedStudents[myRankIndex] : null;

  const renderPodiumStudent = (student: any, position: 'middle'|'left'|'right', idx: number) => {
    if (!student) return <div className="w-1/3 opacity-0" key={`empty-${position}`} />;
    
    const config = {
      middle: { rank: 1, height: 'h-40 md:h-48', avatarSize: 'w-24 h-24 md:w-32 md:h-32', border: 'border-yellow-400', crown: <Crown className="w-8 h-8 md:w-10 md:h-10 text-yellow-500 absolute -top-6 left-1/2 -translate-x-1/2 drop-shadow-md" />, delay: 0 },
      left: { rank: 2, height: 'h-28 md:h-32', avatarSize: 'w-16 h-16 md:w-20 md:h-20', border: 'border-slate-300', crown: <Medal className="w-6 h-6 md:w-8 md:h-8 text-slate-400 absolute -top-4 left-1/2 -translate-x-1/2 drop-shadow-md" />, delay: 0.1 },
      right: { rank: 3, height: 'h-24 md:h-28', avatarSize: 'w-16 h-16 md:w-20 md:h-20', border: 'border-orange-400', crown: <Medal className="w-6 h-6 md:w-8 md:h-8 text-orange-500 absolute -top-4 left-1/2 -translate-x-1/2 drop-shadow-md" />, delay: 0.2 },
    }[position];

    return (
      <motion.div 
        key={student.id}
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: config.delay }}
        className="flex flex-col items-center justify-end w-1/3 px-1 md:px-2 pt-6"
        onClick={() => {
          trackEvent('profile_open', { refId: student.id, metadata: { source: 'podium' } });
          navigateTo('/student', { id: student.id });
        }}
      >
        <div className="relative mb-2 cursor-pointer group active:scale-95 transition-transform flex flex-col items-center">
          {config.crown}
          <img src={student.photo} className={`${config.avatarSize} rounded-full object-cover border-[3px] md:border-4 ${config.border} shadow-lg group-hover:scale-105 transition-transform bg-base-100 relative z-10`} />
          <div className="absolute -bottom-2 md:-bottom-3 bg-base-900 text-white text-[10px] md:text-sm font-black px-2 md:px-3 py-0.5 rounded-full border-2 border-base-100 z-20 shadow-sm">
            #{config.rank}
          </div>
        </div>
        <div className="text-center w-full mt-2 md:mt-3 px-1">
          <h4 className="font-bold text-base-50 text-xs md:text-sm line-clamp-2 md:line-clamp-3 break-words leading-tight" title={student.name}>{student.name}</h4>
          <p className="text-[10px] md:text-xs font-black text-primary-200 mt-0.5">{student.totalPoints} pts</p>
        </div>
        <div className={`w-full ${config.height} bg-gradient-to-t from-primary-400/20 to-primary-100/10 mt-3 rounded-t-xl md:rounded-t-2xl border-t-[3px] ${config.border} shadow-inner backdrop-blur-sm`} />
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      {/* HEADER & PODIUM */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 pt-8 px-4 rounded-b-[2.5rem] md:rounded-[2.5rem] text-base-50 shadow-2xl relative overflow-hidden -mx-4 -mt-6 sm:mx-0 sm:mt-0">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 rotate-12 pointer-events-none">
          {appSettings?.logoUrl ? <img src={appSettings.logoUrl} className="w-64 h-64 opacity-50 grayscale" /> : <Trophy className="w-64 h-64" />}
        </div>
        
        <div className="relative z-10 space-y-4 max-w-2xl mx-auto mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-base-100/10 rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            <Flame className="w-3 h-3 text-accent-500" /> {appSettings?.badgeTitle || 'Season 2 Active'}
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">{appSettings?.heroTitle || 'Student Ranking'}</h1>
          <p className="text-base-50 drop-shadow-sm font-medium max-w-lg mx-auto text-sm md:text-base opacity-95 leading-relaxed">
            {appSettings?.heroSubtitle || 'Witness the rise of champions. Progress is tracked daily.'}
          </p>
          
          {/* HORIZONTAL TIME FILTERS */}
          <div className="flex justify-center mt-6">
            <div className="bg-base-900/30 backdrop-blur-md p-1.5 rounded-full flex items-center gap-1 overflow-x-auto no-scrollbar scrollbar-hide snap-x">
               {TIME_RANGE_OPTIONS.map((opt) => (
                 <button 
                  key={opt.value} 
                  onClick={() => {
                    setTimeFilter(opt.value);
                    trackEvent('leaderboard_filter', { metadata: { range: opt.value } });
                  }}
                  className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider transition-all snap-center whitespace-nowrap active:scale-95 ${
                    timeFilter === opt.value ? 'bg-base-50 text-primary-700 shadow-md' : 'text-base-50/90 hover:text-base-50 hover:bg-base-50/20'
                  }`}
                 >
                   {opt.shortLabel}
                 </button>
               ))}
            </div>
          </div>
        </div>

        {/* TOP 3 PODIUM */}
        <div className="relative z-10 flex items-end justify-center max-w-3xl mx-auto px-2 mt-8">
          {renderPodiumStudent(top3[0], 'left', 1)}
          {renderPodiumStudent(top3[1], 'middle', 0)}
          {renderPodiumStudent(top3[2], 'right', 2)}
        </div>
      </div>

      {/* REST OF STUDENTS LIST */}
      <div className="bg-base-100 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-base-200 overflow-hidden mx-0">
        <div className="px-4 md:px-8 pt-6 pb-2">
          <StudentSearchAdvanced
            value={searchFilter}
            onChange={setSearchFilter}
            sortKey={sortKey}
            onSortChange={setSortKey}
            availableTags={availableTags}
            studentTagSource={studentTagSource}
            placeholder="Search rank 4 and below..."
          />
        </div>
        {isLoading ? (
          <div className="p-20 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            <p className="text-text-light text-sm font-medium">Fetching leaderboard data...</p>
          </div>
        ) : restOfStudents.length === 0 ? (
          <div className="p-12 text-center text-text-light">
            <p className="font-bold">
              {hasActiveFilter ? 'No students match your search or tag filter.' : 'No other students found.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {restOfStudents.map((student, index) => {
              const rank = index + 4; // Because top 3 are extracted
              
              return (
                <li 
                  key={student.id || `leader-${index}`} 
                  onClick={() => {
                    trackEvent('profile_open', { refId: student.id, metadata: { source: 'leaderboard' } });
                    navigateTo('/student', { id: student.id });
                  }}
                  className="flex items-center gap-3 md:gap-4 py-5 px-4 md:px-8 hover:bg-primary-50/30 transition-all cursor-pointer group active:scale-[0.99] bg-base-100"
                >
                  <div className="flex flex-col items-center gap-1 w-8 md:w-10">
                    <div className="font-black text-lg md:text-xl text-text-light group-hover:text-primary-600 transition-colors">
                      {rank}
                    </div>
                  </div>
                  
                  <div className="relative">
                    <img src={student.photo} alt={student.name} className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-base-200 shadow-sm object-cover" />
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 
                      className="font-bold text-text-main group-hover:text-primary-600 transition-colors text-[clamp(0.95rem,4vw,1.1rem)] line-clamp-2 md:line-clamp-3 leading-tight break-words"
                      title={student.name}
                    >
                      {student.name}
                    </h3>
                    <p 
                      className="text-[clamp(0.7rem,3vw,0.75rem)] text-text-muted line-clamp-2 md:line-clamp-3 break-words mt-0.5 max-w-full"
                      title={student.bio}
                    >
                      {student.bio}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 md:gap-3 text-right">
                    <div className="flex flex-col items-end justify-center">
                      <div className="text-xl md:text-2xl font-black text-text-main group-hover:text-primary-700 transition-colors">{student.totalPoints}</div>
                      <div className="text-[9px] md:text-[10px] font-bold text-text-light uppercase tracking-widest leading-none">Points</div>
                    </div>
                    <RankMovement currentRank={rank} previousRank={student.previousRank} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>


    </div>
  );
}

// --- STUDENT PROFILE PAGE (with collapsible goals) ---
function StudentProfilePage({ studentId, students, masterGoals, categories, calculateTotalPoints, navigateTo }: {
  studentId: string;
  students: Student[];
  masterGoals: MasterGoal[];
  categories: Category[];
  calculateTotalPoints: (goals: AssignedGoal[]) => number;
  navigateTo: (path: string, params?: any) => void;
}) {
  const student = students.find(s => s.id === studentId);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  // Both charts now share the same reusable TimeRangeFilter (preset + date range).
  const [historyFilterValue, setHistoryFilterValue] = useState<TimeRangeValue>(() => createDefaultTimeRangeValue('all-time'));
  const [timelineFilterValue, setTimelineFilterValue] = useState<TimeRangeValue>(() => createDefaultTimeRangeValue('last-week'));

  const timelineData = React.useMemo(() => {
    if (!student?.assignedGoals) return { rows: [], totalGoals: 0, totalPoints: 0, days: 0 };
    // Resolve the active range. Unbounded sides fall back to the goal data extents.
    const now = new Date();
    const completedTs = student.assignedGoals
      .filter(g => g.completed && g.completedAt)
      .map(g => new Date(g.completedAt!).getTime())
      .filter(t => !isNaN(t));
    const minTs = completedTs.length ? Math.min(...completedTs) : now.getTime();
    const startDate = timelineFilterValue.range.start ?? new Date(minTs);
    const endDate = timelineFilterValue.range.end ?? now;
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const dayMs = 86400000;
    const days = Math.max(1, Math.min(366, Math.round((end.getTime() - start.getTime()) / dayMs) + 1));
    const compact = days > 14;

    // Build a date->{goals,points} map keyed by YYYY-MM-DD
    const map = new Map<string, { goals: number; points: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { goals: 0, points: 0 });
    }

    let totalGoals = 0;
    let totalPoints = 0;
    student.assignedGoals.forEach(g => {
      if (!g.completed || !g.completedAt) return;
      const cd = new Date(g.completedAt);
      const key = cd.toISOString().slice(0, 10);
      if (!map.has(key)) return;
      const mg = masterGoals.find(m => m.id === g.goalId);
      const pts = mg?.points || 0;
      const cur = map.get(key)!;
      cur.goals += 1;
      cur.points += pts;
      totalGoals += 1;
      totalPoints += pts;
    });

    const rows = Array.from(map.entries()).map(([date, v]) => {
      const d = new Date(date);
      const label = compact
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : d.toLocaleDateString(undefined, { weekday: 'short' });
      return { date: label, goals: v.goals, points: v.points };
    });
    return { rows, totalGoals, totalPoints, days };
  }, [student?.assignedGoals, masterGoals, timelineFilterValue]);

  const historicalData = React.useMemo(() => {
    if (!student?.assignedGoals || student.assignedGoals.length === 0) return [];

    // Some older completed goals might not have completedAt.
    // Space them out hourly backwards from now so they show up beautifully on the chart.
    const now = Date.now();
    const zeroCount = student.assignedGoals.filter(g => g.completed && !g.completedAt).length;
    let baseTime = now - (zeroCount * 3600000);

    const completedGoals = student.assignedGoals
      .filter(g => g.completed)
      .map(g => ({ ...g, timestamp: g.completedAt ? new Date(g.completedAt).getTime() : 0 }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(g => {
        if (g.timestamp === 0) {
          baseTime += 3600000;
          return { ...g, timestamp: baseTime };
        }
        return g;
      });

    // Filter to active range; pick chart granularity automatically based on span.
    const range: DateRange = historyFilterValue.range;
    const inRange = completedGoals.filter(g => isWithinRange(g.timestamp, range));

    // Determine the visible span so we can choose label granularity.
    const firstTs = inRange[0]?.timestamp ?? completedGoals[0]?.timestamp ?? Date.now();
    const lastTs  = inRange[inRange.length - 1]?.timestamp ?? completedGoals[completedGoals.length - 1]?.timestamp ?? Date.now();
    const spanStart = range.start ? range.start.getTime() : firstTs;
    const spanEnd   = range.end ? range.end.getTime() : lastTs;
    const spanDays = Math.max(1, (spanEnd - spanStart) / 86400000);

    type Granularity = 'hours' | 'days' | 'weeks' | 'months' | 'years';
    const granularity: Granularity =
      spanDays <= 2     ? 'hours'  :
      spanDays <= 60    ? 'days'   :
      spanDays <= 180   ? 'weeks'  :
      spanDays <= 1095  ? 'months' :
                          'years';

    const labelFor = (date: Date): string => {
      if (granularity === 'hours')  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`;
      if (granularity === 'days')   return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
      if (granularity === 'weeks') {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDays = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNumber = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
        return `W${weekNumber} ${date.getFullYear()}`;
      }
      if (granularity === 'months') {
        const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${m[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
      }
      return `${date.getFullYear()}`;
    };

    // Cumulative running total across goals in range.
    let runningTotal = 0;
    const historyMap = new Map<string, number>();
    inRange.forEach(g => {
      const mg = masterGoals.find(m => m.id === g.goalId);
      runningTotal += (mg?.points || 0);
      historyMap.set(labelFor(new Date(g.timestamp)), runningTotal);
    });

    const data = Array.from(historyMap.entries()).map(([date, points]) => ({ date, points }));
    if (data.length > 0 && data[0].points > 0) {
      data.unshift({ date: 'Start', points: 0 });
    }
    return data;
  }, [student?.assignedGoals, masterGoals, historyFilterValue]);

  if (!student) return <div className="text-center py-20 font-bold text-text-light underline cursor-pointer" onClick={() => navigateTo('/')}>Go Back Home</div>;

  const totalPoints = calculateTotalPoints(student.assignedGoals);
  const rankedStudents = [...students].map(s => ({...s, totalPts: calculateTotalPoints(s.assignedGoals || [])})).sort((a,b) => b.totalPts - a.totalPts);
  const currentRankIndex = rankedStudents.findIndex(s => s.id === studentId);
  const currentRank = currentRankIndex >= 0 ? currentRankIndex + 1 : 0;
  
  // Group goals by category
  const groupedGoals = categories.reduce((acc, cat) => {
    const goalsInCat = (student.assignedGoals || [])
      .map(ag => {
        const goalData = masterGoals.find(mg => mg.id === ag.goalId);
        if (goalData?.categoryId === cat.id) return { ...ag, ...goalData };
        return null;
      })
      .filter(Boolean) as (AssignedGoal & MasterGoal)[];
    
    if (goalsInCat.length > 0) acc[cat.id] = goalsInCat;
    return acc;
  }, {} as Record<string, (AssignedGoal & MasterGoal)[]>);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigateTo('/')} className="flex items-center gap-2 text-text-light hover:text-primary-600 transition-colors font-bold text-xs uppercase tracking-[0.2em] mb-4">
        <ArrowLeft className="h-4 w-4" /> Return to Board
      </button>

      <div className="bg-base-100 rounded-[2.5rem] p-8 shadow-xl border border-base-200 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-32 bg-primary-600 group-hover:h-36 transition-all duration-500"></div>
        <div className="relative z-10 flex flex-col items-center text-center mt-8">
          <div className="relative">
            <img src={student.photo} alt={student.name} className="w-32 h-32 rounded-[2rem] border-8 border-base-100 shadow-2xl bg-base-100 object-cover" />
            <div className="absolute -bottom-2 -right-2 bg-accent-500 p-2 rounded-xl text-base-50 shadow-lg">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <h1 className="text-3xl font-black text-text-main leading-tight">{student.name}</h1>
            <p className="text-text-muted text-sm max-w-md mx-auto italic">"{student.bio}"</p>
          </div>
          
          <div className="flex gap-4 mt-8 w-full">
            <div className="flex-1 bg-base-50 rounded-2xl p-4 border border-base-200 flex flex-col justify-center relative">
              <div className="text-[10px] font-black text-text-light uppercase tracking-widest mb-1">Rank</div>
              <div className="flex items-center justify-center gap-3">
                <div className="text-2xl font-black text-primary-600">#{currentRank}</div>
                <RankMovement currentRank={currentRank} previousRank={student.previousRank} />
              </div>
            </div>
            <div className="flex-1 bg-primary-600 rounded-2xl p-4 shadow-lg shadow-primary-200">
              <div className="text-[10px] font-black text-primary-200 uppercase tracking-widest mb-1">{POINTS_CAPTION.ALL_TIME}</div>
              <div className="text-2xl font-black text-base-50">{totalPoints}</div>
            </div>
          </div>
        </div>
      </div>

      {historicalData.length > 0 && (
        <div className="bg-base-100 rounded-3xl border border-base-200 p-6 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h4 className="font-bold text-text-main flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-500" /> Progression History
            </h4>
            <TimeRangeFilter value={historyFilterValue} onChange={setHistoryFilterValue} />
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={30} tickFormatter={value => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} 
                  itemStyle={{ color: 'var(--theme-accent-500)', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="points" stroke="var(--theme-accent-500)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-base-100 rounded-3xl border border-base-200 p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h4 className="font-bold text-text-main flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-accent-500" /> Activity Timeline
          </h4>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-light">
              <span className="px-2 py-1 rounded-lg bg-base-50 border border-base-200">
                {timelineData.totalGoals} goals
              </span>
              <span className="px-2 py-1 rounded-lg bg-base-50 border border-base-200">
                {timelineData.totalPoints} pts
              </span>
            </div>
            <TimeRangeFilter value={timelineFilterValue} onChange={setTimelineFilterValue} />
          </div>
        </div>
        <p className="text-xs text-text-muted mb-3">
          Daily completed goals — useful to validate weekly &amp; monthly leaderboard rankings.
        </p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData.rows}>
              <XAxis
                dataKey="date"
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={timelineData.days > 14 ? Math.ceil(timelineData.days / 10) : 0}
              />
              <YAxis
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={30}
                allowDecimals={false}
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: '1rem',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: any, name: any) => [value, name === 'goals' ? 'Goals' : 'Points']}
              />
              <Bar dataKey="goals" fill="var(--theme-accent-500)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-black text-text-main flex items-center gap-2 px-2">
          <Target className="w-6 h-6 text-primary-500" /> Assignment Board
        </h2>
        
        {Object.keys(groupedGoals).length === 0 ? (
          <div className="bg-base-100 rounded-3xl border border-base-200 p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-base-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-text-light" />
            </div>
            <h3 className="text-lg font-bold text-text-main mb-2">No Goals Yet</h3>
            <p className="text-text-muted text-sm max-w-sm mx-auto">This student hasn't been assigned any learning goals. Head to the Admin panel to assign their first track.</p>
          </div>
        ) : (
          Object.entries(groupedGoals).map(([catId, goals]) => {
            const category = categories.find(c => c.id === catId);
            const isExpanded = !!expandedCategories[catId];
            const completedCount = goals.filter(g => g.completed).length;
            const progress = goals.length > 0 ? (completedCount / goals.length) * 100 : 0;

            return (
              <div key={catId} className="bg-base-100 rounded-3xl border border-base-200 overflow-hidden shadow-sm">
                <button 
                  onClick={() => toggleCategory(catId)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-base-50 transition-colors"
                >
                  <div className="flex flex-1 items-center gap-4">
                    <div className={`p-3 rounded-xl ${isExpanded ? 'bg-primary-600 text-base-50' : 'bg-base-50 text-text-light'}`}>
                      <FolderTree className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-bold text-text-main line-clamp-2 break-words leading-tight mb-1" title={category?.name}>{category?.name}</h3>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-base-200 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-accent-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-text-light uppercase tracking-widest min-w-[3rem] text-right">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-text-light shrink-0" /> : <ChevronDown className="h-5 w-5 text-text-light shrink-0" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden bg-base-200/50 border-t border-base-200"
                    >
                      <div className="p-4 space-y-3">
                        {goals.map(goal => (
                          <div key={goal.id} className="flex items-center gap-4 bg-base-100 p-4 rounded-2xl border border-base-200 shadow-sm transition-all hover:border-primary-100 relative overflow-hidden">
                            {/* Accent line for completed goals */}
                            {goal.completed && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500" />}
                            
                            <div className={`shrink-0 z-10 ${goal.completed ? 'text-accent-500' : 'text-text-light'}`}>
                              {goal.completed ? <CheckCircle2 className="w-6 h-6 fill-accent-50" /> : <Circle className="w-6 h-6" />}
                            </div>
                            <div className="flex-1 min-w-0 z-10">
                              <h4 
                                className={`text-[clamp(0.875rem,3.5vw,1rem)] font-bold line-clamp-2 break-words leading-tight ${goal.completed ? 'text-text-muted line-through decoration-slate-300' : 'text-text-main'}`}
                                title={goal.title}
                              >
                                {goal.title}
                              </h4>
                              <p 
                                className="text-[clamp(0.65rem,2.5vw,0.75rem)] text-text-muted line-clamp-2 break-words mt-1" 
                                title={goal.description}
                              >
                                {goal.description}
                              </p>
                            </div>
                            <div className={`text-xs font-black z-10 px-2 py-1 rounded-lg ${goal.completed ? 'text-accent-600 bg-accent-50' : 'text-primary-600 bg-primary-50 border border-primary-100/50'}`}>
                              +{goal.points !== undefined ? goal.points : (goal as any).pointValue || 0} pts
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- ADMIN DASHBOARD ---
function AdminDashboard({ students, refreshData, masterGoals, categories, calculateTotalPoints, appSettings, setAppSettings }: {
  students: Student[];
  refreshData: () => void;
  masterGoals: MasterGoal[];
  categories: Category[];
  calculateTotalPoints: (goals: AssignedGoal[]) => number;
  appSettings: any;
  setAppSettings: any;
}) {
  const [activeTab, setActiveTab] = useState('students');
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-text-main">Admin Control</h1>
          <p className="text-text-muted font-medium">Manage students, learning goals, and tracks.</p>
        </div>
        <button 
          onClick={async () => {
            setIsRefreshing(true);
            await refreshData();
            setIsRefreshing(false);
          }}
          disabled={isRefreshing}
          className="bg-base-100 border border-base-200 px-4 py-2 rounded-xl text-sm font-bold text-text-muted hover:bg-base-200 flex items-center gap-2 active:scale-95 transition-all"
        >
          {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
          Force Sync
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Scrollable Horizontal Tabs */}
        <div className="-mx-4 sm:mx-0 overflow-x-auto no-scrollbar scrollbar-hide snap-x pb-3">
          <div className="flex items-center gap-2 sm:gap-4 border-b border-base-200 min-w-max px-4 sm:px-0">
            {[
              { id: 'students', label: 'Students', icon: Users },
              { id: 'goals', label: 'Tracks & Goals', icon: Target },
              { id: 'appearance', label: 'Appearance', icon: Palette },
              { id: 'statistics', label: 'Statistics', icon: Search },
              { id: 'import-export', label: 'Import / Export', icon: Database },
              { id: 'backend', label: 'Backend & DB', icon: Server }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(50);
                  setActiveTab(tab.id);
                }}
                className={`group flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4 min-h-11 font-bold text-base sm:text-lg transition-all whitespace-nowrap active:scale-95 border-b-[3px] snap-start ${
                  activeTab === tab.id 
                    ? 'border-primary-600 text-primary-600' 
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <tab.icon className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 transition-colors ${activeTab === tab.id ? 'text-primary-600' : 'text-text-light group-hover:text-text-muted'}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-base-100 rounded-3xl md:rounded-[2.5rem] border border-base-200 shadow-sm overflow-hidden min-h-[600px]">
          {activeTab === 'students' && (
            <AdminStudentsTab 
              students={students} refreshData={refreshData}
              masterGoals={masterGoals} categories={categories}
              calculateTotalPoints={calculateTotalPoints}
            />
          )}
          {activeTab === 'goals' && (
            <AdminGoalsTab 
              masterGoals={masterGoals} refreshData={refreshData}
              categories={categories} 
            />
          )}
          {activeTab === 'appearance' && (
            <AdminAppearanceTab refreshData={refreshData} appSettings={appSettings} setAppSettings={setAppSettings} />
          )}
          {activeTab === 'statistics' && (
            <AdminStatisticsTab />
          )}
          {activeTab === 'import-export' && (
            <AdminImportExportTab
              apiFetch={apiFetch}
              students={students}
              masterGoals={masterGoals}
              categories={categories}
              refreshData={refreshData}
            />
          )}
          {activeTab === 'backend' && (
            <AdminBackendTab refreshData={refreshData} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- ADMIN TABS (API INTEGRATED) ---

function AdminStudentsTab({ students, refreshData, masterGoals, categories, calculateTotalPoints }: any) {
  const [searchFilter, setSearchFilter] = useState<StudentSearchFilterValue>(emptyStudentSearchFilter);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  const studentsList = Array.isArray(students) ? students : [];
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    studentsList.forEach((s: any) => (s.tags || []).forEach((t: string) => t && set.add(t)));
    return Array.from(set);
  }, [studentsList]);
  const studentTagSource = useMemo(
    () => studentsList.map((s: any) => s.tags || []),
    [studentsList]
  );
  const filtered = useMemo(() => {
    const matched = applyStudentSearchFilter(studentsList, searchFilter);
    // Precompute totalPoints so 'points' sort works against the live goal data.
    const enriched = matched.map((s: any) => ({
      ...s,
      totalPoints: calculateTotalPoints(s.assignedGoals || []),
    }));
    return sortStudents(enriched, sortKey);
  }, [studentsList, searchFilter, sortKey, calculateTotalPoints]);

  const handleSave = async (formData: any) => {
    // 1. Calculate old ranks for all students
    const calculateRanks = (list: any[]) => {
      const mapped = list.map(s => ({ ...s, totalPts: calculateTotalPoints(s.assignedGoals || []) }));
      mapped.sort((a,b) => b.totalPts - a.totalPts);
      return mapped.map((s, index) => ({ id: s.id, rank: index + 1 }));
    };
    
    const oldRanks = calculateRanks(studentsList);
    const oldRanksMap = Object.fromEntries(oldRanks.map(r => [r.id, r.rank]));

    const isNew = !formData.id;
    const url = isNew ? '/api/students' : `/api/students/${formData.id}`;
    const method = isNew ? 'POST' : 'PUT';

    // To be perfectly accurate, we update old rank into the formData BEFORE saving.
    let finalData = { ...formData };
    if (!isNew && oldRanksMap[formData.id]) {
        finalData.previousRank = oldRanksMap[formData.id];
    }

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalData)
    });
    if (!res.ok) {
      alert(`Failed to save: ${res.statusText}`);
      return;
    }
    refreshData();
    setModalOpen(false);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const res = await apiFetch(`/api/students/${deleteConfirm.id}`, { method: 'DELETE' });
    if (!res.ok) alert(`Failed to delete: ${res.statusText}`);
    setDeleteConfirm(null);
    refreshData();
  };

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h3 className="text-2xl font-black text-text-main underline decoration-primary-500 decoration-4 underline-offset-8">Student List</h3>
          <p className="text-text-muted text-sm mt-3">Manage profile and goal assignments.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={async () => {
              const baseC = confirm('Are you sure you want to snapshot current ranks? This will freeze the current leader positions to calculate rank changes.');
              if(!baseC) return;
              try {
                const res = await apiFetch('/api/students/snapshot-ranks', { method: 'POST' });
                if(res.ok) {
                  alert('Ranks successfully snapshotted. Rank changes (up/down arrows) will now appear on the leaderboard when students gain points.');
                  refreshData();
                } else alert('Failed to snapshot ranks');
              } catch(e) { console.error(e); }
            }}
            className="bg-accent-500 text-base-50 px-6 py-3 rounded-2xl text-sm font-black hover:bg-accent-600 shadow-lg shadow-accent-100 flex justify-center items-center gap-2 active:scale-95 transition-all w-full sm:w-auto"
            title="Saves current ranks so you can track movement (up/down)"
          >
            <TrendingUp className="h-4 w-4" /> Snapshot Ranks
          </button>
          <button onClick={() => { setEditData(null); setModalOpen(true); }} className="bg-primary-600 text-base-50 px-6 py-3 rounded-2xl text-sm font-black hover:bg-primary-700 shadow-lg shadow-primary-100 flex items-center gap-2 active:scale-95 transition-all w-full sm:w-auto justify-center">
            <Plus className="h-4 w-4" /> Add Student
          </button>
        </div>
      </div>

      <div className="mb-6">
        <StudentSearchAdvanced
          value={searchFilter}
          onChange={setSearchFilter}
          sortKey={sortKey}
          onSortChange={setSortKey}
          availableTags={availableTags}
          studentTagSource={studentTagSource}
          placeholder="Search students..."
        />
      </div>

      <div className="space-y-3">
        {filtered.map((s: any, index: number) => (
          <div key={s.id || `student-${index}`} className="flex items-center gap-4 p-4 rounded-2xl border border-base-200 bg-base-100 hover:border-primary-200 transition-colors shadow-sm">
            <img src={s.photo} className="w-12 h-12 rounded-xl bg-base-200" />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-text-main line-clamp-2 break-words leading-tight" title={s.name}>{s.name}</h4>
              <p className="text-[10px] font-black text-text-light uppercase tracking-widest mt-1 mb-1">{s.assignedGoals.length} Handled Goals</p>
              {s.tags && s.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.tags.slice(0, 3).map((tag: string, idx: number) => (
                    <span key={idx} className="bg-primary-100/50 text-text-muted text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center break-all">
                      {tag}
                    </span>
                  ))}
                  {s.tags.length > 3 && (
                    <span className="bg-base-200 text-text-light text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center">
                      +{s.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ActionMenu 
                onEdit={() => { setEditData(s); setModalOpen(true); }}
                onDelete={() => setDeleteConfirm(s)}
              />
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <StudentAdminModal 
          student={editData} 
          masterGoals={masterGoals} 
          categories={categories} 
          onClose={() => setModalOpen(false)} 
          onSave={handleSave} 
        />
      )}
      
      <ConfirmModal 
        isOpen={!!deleteConfirm}
        title="Delete Student"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This action cannot be undone.`}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// Student Edit Modal (Shared with initial but updated styles)
function StudentAdminModal({ student, masterGoals, categories, onClose, onSave }: any) {
  const [formData, setFormData] = useState<Student>({
    id: student?.id || '',
    name: student?.name || '',
    bio: student?.bio || '',
    photo: student?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.floor(Math.random()*100)}&backgroundColor=b6e3f4`,
    tags: student?.tags ? [...student.tags] : [],
    assignedGoals: student?.assignedGoals ? [...student.assignedGoals] : []
  });

  const [filterCat, setFilterCat] = useState('ALL');
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CROPPING STATE ---
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImage(event.target?.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const confirmCrop = () => {
    if (!cropImage || !croppedAreaPixels) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 512;
      canvas.width = MAX_SIZE;
      canvas.height = MAX_SIZE;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          image,
          croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height,
          0, 0, MAX_SIZE, MAX_SIZE
        );
        const compressedDataUrl = canvas.toDataURL('image/webp', 0.8);
        setFormData(prev => ({ ...prev, photo: compressedDataUrl }));
        setCropImage(null);
      }
    };
    image.src = cropImage;
  };

  const addTag = () => {
    if (tagInput.trim() !== '' && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tagToRemove) }));
  };

  const displayedMasterGoals = filterCat === 'ALL' 
    ? masterGoals 
    : masterGoals.filter((mg: any) => mg.categoryId === filterCat);

  const isAssigned = (goalId: string) => formData.assignedGoals.some(ag => ag.goalId === goalId);
  const isCompleted = (goalId: string) => formData.assignedGoals.find(ag => ag.goalId === goalId)?.completed || false;

  const toggleAssignment = (goalId: string) => {
    setFormData(prev => {
      if (isAssigned(goalId)) {
        return { ...prev, assignedGoals: prev.assignedGoals.filter(ag => ag.goalId !== goalId) };
      } else {
        return { ...prev, assignedGoals: [...prev.assignedGoals, { goalId, completed: false }] };
      }
    });
  };

  const toggleCompletion = (goalId: string) => {
    if (!isAssigned(goalId)) return;
    setFormData(prev => ({
      ...prev,
      assignedGoals: prev.assignedGoals.map(ag => ag.goalId === goalId ? { ...ag, completed: !ag.completed, completedAt: !ag.completed ? new Date().toISOString() : undefined } : ag)
    }));
  };

  // ── Bulk track-scoped actions ──────────────────────────────────────────────
  // Operate on whatever is currently visible in the goal list (respects the
  // "All Tracks" / specific-track filter at the top of the panel).
  const visibleGoalIds: string[] = displayedMasterGoals.map((mg: any) => mg.id);
  const visibleAssignedCount = visibleGoalIds.filter(id => isAssigned(id)).length;
  const visibleCompletedCount = visibleGoalIds.filter(id => isCompleted(id)).length;
  const allVisibleAssigned = visibleGoalIds.length > 0 && visibleAssignedCount === visibleGoalIds.length;
  const allVisibleCompleted = visibleAssignedCount > 0 && visibleCompletedCount === visibleAssignedCount;
  const scopeLabel = filterCat === 'ALL'
    ? 'all tracks'
    : (categories.find((c: any) => c.id === filterCat)?.name || 'this track');

  const bulkSetAssigned = (assign: boolean) => {
    setFormData(prev => {
      if (assign) {
        const existingIds = new Set(prev.assignedGoals.map(ag => ag.goalId));
        const additions = visibleGoalIds
          .filter(id => !existingIds.has(id))
          .map(id => ({ goalId: id, completed: false }));
        if (additions.length === 0) return prev;
        return { ...prev, assignedGoals: [...prev.assignedGoals, ...additions] };
      }
      // Unassign: drop everything in scope (also clears their completion).
      const drop = new Set(visibleGoalIds);
      return { ...prev, assignedGoals: prev.assignedGoals.filter(ag => !drop.has(ag.goalId)) };
    });
  };

  const bulkSetCompleted = (complete: boolean) => {
    setFormData(prev => {
      const scope = new Set(visibleGoalIds);
      const nowIso = new Date().toISOString();
      let next = prev.assignedGoals.map(ag => {
        if (!scope.has(ag.goalId)) return ag;
        if (complete) {
          return ag.completed ? ag : { ...ag, completed: true, completedAt: ag.completedAt || nowIso };
        }
        return { ...ag, completed: false, completedAt: undefined };
      });
      // When marking complete, auto-assign any visible goals that weren't yet assigned.
      if (complete) {
        const existingIds = new Set(next.map(ag => ag.goalId));
        const additions = visibleGoalIds
          .filter(id => !existingIds.has(id))
          .map(id => ({ goalId: id, completed: true, completedAt: nowIso }));
        if (additions.length) next = [...next, ...additions];
      }
      return { ...prev, assignedGoals: next };
    });
  };

  return (
    <div className="fixed inset-0 bg-base-900/60 backdrop-blur-md z-[60] flex justify-center items-center p-4">
       <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-base-100 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative"
      >
        <div className="flex justify-between items-center p-6 border-b border-base-200">
          <h2 className="text-xl font-black text-text-main">{student ? 'Edit Credentials' : 'Enroll Student'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-base-200 rounded-xl transition-colors"><X className="h-6 w-6 text-text-light" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">
          {/* Biodata */}
          <div className="w-full lg:w-80 space-y-6">
            <div className="text-center">
               <div className="relative inline-block group">
                <img src={formData.photo} alt="Avatar" className="w-32 h-32 rounded-[2rem] border-4 border-slate-50 bg-base-200 shadow-md object-cover" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-900/60 p-3 rounded-full text-base-50 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-xl" title="Upload Photo">
                  <ImageIcon className="w-6 h-6" />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                <button type="button" onClick={() => setFormData(p => ({...p, photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.floor(Math.random()*1000)}&backgroundColor=d1d4f9`}))} className="absolute -bottom-2 -right-2 bg-primary-600 p-2 rounded-xl text-base-50 shadow-lg active:scale-90 transition-transform">
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </button>
              </div>
              <p className="text-[10px] font-black text-text-light uppercase tracking-widest mt-3">Profile Identity</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Photo URL (Optional)</label>
                <input type="text" className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" placeholder="Paste image URL here" value={formData.photo} onChange={e => setFormData(p => ({...p, photo: e.target.value}))}/>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Full Name</label>
                <input type="text" className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))}/>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Short Bio</label>
                <textarea rows={2} className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" value={formData.bio} onChange={e => setFormData(p => ({...p, bio: e.target.value}))}/>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Tags (Multi-tags for Search)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formData.tags || []).map((tag, idx) => (
                    <span key={idx} className="bg-primary-100 text-primary-800 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      {tag} <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeTag(tag)} />
                    </span>
                  ))}
                </div>
                <input 
                  type="text" 
                  className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" 
                  placeholder="Type a tag & press Enter" 
                  value={tagInput} 
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                />
              </div>
            </div>
          </div>

          {/* Goal Selector */}
          <div className="flex-1 border-base-200 lg:border-l lg:pl-8 pt-8 lg:pt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
              <div>
                <h3 className="text-lg font-black text-text-main">Track Assigments</h3>
                <p className="text-[10px] font-black text-text-light uppercase tracking-widest leading-none mt-1">Configure goals for this student</p>
              </div>
              <select className="bg-base-200 border-none rounded-xl p-2 text-xs font-bold text-text-muted focus:ring-2 focus:ring-primary-100" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="ALL">All Tracks</option>
                {categories.map((c: any, index: number) => <option key={c.id || `cp1-${index}`} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Bulk actions for the current track scope */}
            {visibleGoalIds.length > 0 && (
              <div className="mb-4 p-3 rounded-2xl bg-base-50 border border-base-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-text-light">
                  Bulk on <span className="text-primary-600">{scopeLabel}</span>
                  <span className="ml-2 normal-case tracking-normal font-bold text-text-muted">
                    · {visibleAssignedCount}/{visibleGoalIds.length} assigned · {visibleCompletedCount} completed
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => bulkSetAssigned(!allVisibleAssigned)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all ${
                      allVisibleAssigned
                        ? 'bg-base-200 text-text-muted hover:bg-base-300'
                        : 'bg-primary-600 text-base-50 hover:bg-primary-700'
                    }`}
                    title={allVisibleAssigned ? 'Unassign all visible' : 'Assign all visible'}
                  >
                    {allVisibleAssigned ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                    {allVisibleAssigned ? 'Unassign all' : 'Assign all'}
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSetCompleted(!allVisibleCompleted)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all ${
                      allVisibleCompleted
                        ? 'bg-base-200 text-text-muted hover:bg-base-300'
                        : 'bg-accent-500 text-base-50 hover:bg-accent-600'
                    }`}
                    title={allVisibleCompleted ? 'Unmark all completed' : 'Mark all completed'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {allVisibleCompleted ? 'Unmark all' : 'Mark all done'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 pb-4">
              {displayedMasterGoals.map((mg: any, index: number) => {
                const assigned = isAssigned(mg.id);
                const completed = isCompleted(mg.id);
                
                return (
                  <div key={mg.id || `mg-display-${index}`} className={`p-4 rounded-3xl border-2 transition-all ${
                    assigned 
                      ? completed ? 'border-accent-100 bg-accent-50/20' : 'border-primary-100 bg-primary-50/20' 
                      : 'border-slate-50 bg-base-100 hover:border-base-200 shadow-sm'
                  }`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-sm text-text-main">{mg.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{mg.points !== undefined ? mg.points : (mg as any).pointValue || 0} pts</span>
                          <span className="text-[10px] text-text-light">•</span>
                          <span className="text-[10px] font-medium text-text-light">{categories.find((c: any)=>c.id === mg.categoryId)?.name}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={() => toggleAssignment(mg.id)}
                          className={`p-2 rounded-xl transition-all ${assigned ? 'bg-primary-600 text-base-50' : 'bg-base-200 text-text-light'}`}
                        >
                          {assigned ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => toggleCompletion(mg.id)}
                          disabled={!assigned}
                          className={`p-2 rounded-xl transition-all ${!assigned ? 'opacity-20' : completed ? 'bg-accent-500 text-base-50' : 'bg-base-200 text-text-light'}`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-base-200 bg-base-200 flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-3 rounded-2xl font-bold text-text-light hover:text-text-main transition-colors">Cancel</button>
          <button onClick={() => onSave(formData)} className="bg-primary-600 px-8 py-3 rounded-2xl text-base-50 font-black shadow-lg shadow-primary-100 hover:bg-primary-700 active:scale-95 transition-all">
            Confirm Changes
          </button>
        </div>

        {/* Cropper Overlay */}
        {cropImage && (
          <div className="absolute inset-0 bg-base-900 z-[100] flex flex-col mt-0 border-t-0 p-0 shadow-none">
            <div className="flex-1 relative">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-4 bg-base-900 border-t border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4 w-full sm:w-1/2">
                <ZoomOut className="text-slate-400 w-5 h-5 flex-shrink-0" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <ZoomIn className="text-slate-400 w-5 h-5 flex-shrink-0" />
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setCropImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }} 
                  className="px-6 py-2 rounded-xl font-bold text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmCrop} 
                  className="bg-primary-600 px-6 py-2 rounded-xl text-white font-black hover:bg-primary-700 transition-colors"
                >
                  Apply Crop
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Tracks & Master Goals Unified Tab
function AdminGoalsTab({ masterGoals, refreshData, categories }: any) {
  // Goal Modal States
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editGoalData, setEditGoalData] = useState<any>(null);
  const [deleteGoalConfirm, setDeleteGoalConfirm] = useState<any>(null);

  // Category States
  const [newCatName, setNewCatName] = useState('');
  const [editCatData, setEditCatData] = useState<any>(null);
  const [editCatName, setEditCatName] = useState('');
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<any>(null);

  // UI States
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const toggleCat = (id: string) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- GOAL ACTIONS ---
  const handleSaveGoal = async (formData: any) => {
    const isNew = !formData.id;
    const url = isNew ? '/api/masterGoals' : `/api/masterGoals/${formData.id}`;
    const res = await apiFetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (!res.ok) alert(`Failed to save template: ${res.statusText}`);
    else { refreshData(); setGoalModalOpen(false); }
  };

  const executeDeleteGoal = async () => {
    if (!deleteGoalConfirm) return;
    const res = await apiFetch(`/api/masterGoals/${deleteGoalConfirm.id}`, { method: 'DELETE' });
    if (!res.ok) alert(`Failed to delete: ${res.statusText}`);
    setDeleteGoalConfirm(null); refreshData();
  };

  // --- CATEGORY ACTIONS ---
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await apiFetch('/api/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCatName })
    });
    if (!res.ok) alert(`Failed to create category: ${res.statusText}`);
    else { setNewCatName(''); refreshData(); }
  };

  const updateCategory = async () => {
    if (!editCatName.trim() || !editCatData) return;
    const res = await apiFetch(`/api/categories/${editCatData.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editCatName })
    });
    if (!res.ok) alert(`Failed to update category: ${res.statusText}`);
    else { setEditCatData(null); setEditCatName(''); refreshData(); }
  };

  const executeDeleteCategory = async () => {
    if (!deleteCatConfirm) return;
    const res = await apiFetch(`/api/categories/${deleteCatConfirm.id}`, { method: 'DELETE' });
    if (!res.ok) alert(`Failed to delete: ${res.statusText}`);
    setDeleteCatConfirm(null); refreshData();
  };

  // --- DATA PREP ---
  const groupedGoals = useMemo(() => {
    const groups: { [key: string]: { category: any, goals: any[] } } = {};
    const unknownCatId = 'unknown-cat';
    
    categories.forEach((c: any) => {
      groups[c.id] = { category: c, goals: [] };
    });
    groups[unknownCatId] = { category: { id: unknownCatId, name: 'Unknown Category', isSystem: true }, goals: [] };

    masterGoals.forEach((g: any) => {
      if (g.categoryId && groups[g.categoryId]) {
        groups[g.categoryId].goals.push(g);
      } else {
        groups[unknownCatId].goals.push(g);
      }
    });

    return Object.values(groups).filter(g => !g.category.isSystem || g.goals.length > 0);
  }, [categories, masterGoals]);

  return (
    <div className="p-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h3 className="text-2xl font-black text-text-main underline decoration-primary-500 decoration-4 underline-offset-8">Tracks & Goals</h3>
          <p className="text-text-muted text-sm mt-3">Manage categories and their goal templates.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <form 
            onSubmit={(e) => { e.preventDefault(); addCategory(); }} 
            className="flex items-center gap-2 bg-base-200 p-1.5 rounded-2xl border border-base-200"
          >
            <input 
              type="text" placeholder="New Track Name" value={newCatName} onChange={e => setNewCatName(e.target.value)}
              className="bg-transparent border-none px-4 py-2 text-sm font-bold focus:ring-0 w-48"
            />
            <button type="submit" className="bg-primary-600 text-base-50 p-2 rounded-xl hover:bg-primary-700 active:scale-95 transition-all">
              <Plus className="h-5 w-5" />
            </button>
          </form>
          <button onClick={() => { setEditGoalData(null); setGoalModalOpen(true); }} className="bg-primary-600 text-base-50 px-6 py-2 rounded-2xl text-sm font-black flex items-center gap-2 active:scale-95 shadow-md shadow-primary-500/20">
            <Target className="h-4 w-4" /> New Goal
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {groupedGoals.map((group) => {
          const isExpanded = expandedCats[group.category.id] !== false; // Default expanded
          const isSystem = group.category.isSystem;
          
          return (
            <div key={group.category.id} className="bg-base-200/30 border border-base-200 rounded-[2rem] relative">
              {/* Category Header */}
              <div 
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-base-200/50 transition-colors ${isExpanded ? 'rounded-t-[2rem]' : 'rounded-[2rem]'}`}
                onClick={() => toggleCat(group.category.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  {editCatData?.id === group.category.id ? (
                    <div className="flex flex-1 gap-2 items-center" onClick={e => e.stopPropagation()}>
                      <input 
                        type="text" value={editCatName} onChange={e => setEditCatName(e.target.value)} autoFocus
                        className="bg-base-100 border border-base-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-primary-100"
                      />
                      <button onClick={updateCategory} className="bg-accent-500 text-base-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent-600">Save</button>
                      <button onClick={() => setEditCatData(null)} className="bg-base-200 text-text-muted px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 items-start ml-2">
                      <span className="font-black text-text-main">{group.category.name}</span>
                      <span className="text-text-light text-xs font-bold">{group.goals.length} goals</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {!isSystem && editCatData?.id !== group.category.id && (
                    <div className="flex items-center mr-2" onClick={e => e.stopPropagation()}>
                      <ActionMenu 
                        onEdit={() => { setEditCatData(group.category); setEditCatName(group.category.name); }}
                        onDelete={() => setDeleteCatConfirm(group.category)}
                      />
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-text-light" /> : <ChevronDown className="w-5 h-5 text-text-light" />}
                </div>
              </div>

              {/* Goals Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <div className="p-4 pt-0 border-t border-base-200/50 bg-base-100/50 rounded-b-[2rem]">
                      {group.goals.length === 0 ? (
                        <p className="text-sm font-bold text-text-muted text-center py-8">No goals in this track.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          {group.goals.map((mg: any) => (
                            <div key={mg.id} className="bg-base-100 p-5 rounded-[1.5rem] border border-base-200 shadow-sm space-y-3 group hover:border-primary-200 transition-colors">
                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-text-main leading-tight flex-1" title={mg.title}>{mg.title}</h4>
                                <div className="bg-base-200 px-2 py-1 rounded-lg text-xs font-black text-primary-600 ml-2 whitespace-nowrap">+{mg.points !== undefined ? mg.points : mg.pointValue || 0}</div>
                              </div>
                              <p className="text-xs text-text-muted italic leading-relaxed line-clamp-2" title={mg.description}>{mg.description}</p>
                              <div className="flex justify-end gap-1 pt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <ActionMenu 
                                  placement="top-center"
                                  onEdit={() => { setEditGoalData(mg); setGoalModalOpen(true); }}
                                  onDelete={() => setDeleteGoalConfirm(mg)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {goalModalOpen && <GoalAdminModal goal={editGoalData} categories={categories} onClose={() => setGoalModalOpen(false)} onSave={handleSaveGoal} />}
      
      <ConfirmModal 
        isOpen={!!deleteGoalConfirm} title="Delete Master Goal"
        message={`Are you sure you want to delete ${deleteGoalConfirm?.title}? Students will keep the reference but data won't sync.`}
        onConfirm={executeDeleteGoal} onCancel={() => setDeleteGoalConfirm(null)}
      />

      <ConfirmModal 
        isOpen={!!deleteCatConfirm} title="Delete Track"
        message={`Are you sure you want to delete ${deleteCatConfirm?.name}? Goals using this track will be moved to Unknown.`}
        onConfirm={executeDeleteCategory} onCancel={() => setDeleteCatConfirm(null)}
      />
    </div>
  );
}

// Goal Admin Modal (Internal usage)
function GoalAdminModal({ goal, categories, onClose, onSave }: any) {
  const [formData, setFormData] = useState<MasterGoal>({
    id: goal?.id || '',
    title: goal?.title || '',
    points: goal?.points || 10,
    categoryId: goal?.categoryId || categories[0]?.id || '',
    description: goal?.description || ''
  });

  return (
    <div className="fixed inset-0 bg-base-900/60 backdrop-blur-md z-[60] flex justify-center items-center p-4">
      <div className="bg-base-100 rounded-[2rem] shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-base-200 font-black text-lg">{goal ? 'Edit Template' : 'New Template'}</div>
        <div className="p-8 space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Track Name</label>
            <input type="text" className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" required value={formData.title} onChange={e => setFormData(p=>({...p, title: e.target.value}))}/>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Category</label>
              <select className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" value={formData.categoryId} onChange={e => setFormData(p=>({...p, categoryId: e.target.value}))}>
                {categories.map((c: any, index: number) => <option key={c.id || `cp2-${index}`} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Points</label>
              <input type="number" className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" min="1" value={formData.points} onChange={e => setFormData(p=>({...p, points: parseInt(e.target.value)||0}))}/>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Description</label>
            <textarea rows={3} className="w-full bg-base-200 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100" value={formData.description} onChange={e => setFormData(p=>({...p, description: e.target.value}))}/>
          </div>
        </div>
        <div className="p-6 border-t border-base-200 bg-base-200 flex justify-end gap-3 rounded-b-[2rem]">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-text-light transition-colors">Cancel</button>
          <button onClick={() => onSave(formData)} className="bg-primary-600 px-8 py-3 rounded-xl text-base-50 font-black shadow-lg shadow-primary-100 active:scale-95 transition-all">Save Template</button>
        </div>
      </div>
    </div>
  );
}


const PRESETS = {
  elegant_gold: {
    primaryColor: { h: 43, s: 74, l: 49 },
    accentColor: { h: 45, s: 93, l: 47 },
    bgColor: { h: 36, s: 100, l: 97 },
    textColor: { h: 30, s: 8, l: 14 }
  },
  bonsai_green: {
    primaryColor: { h: 144, s: 29, l: 20 },
    accentColor: { h: 34, s: 62, l: 57 },
    bgColor: { h: 79, s: 29, l: 92 },
    textColor: { h: 144, s: 18, l: 15 }
  },
  classic_madrasah: {
    primaryColor: { h: 158, s: 64, l: 39 },
    accentColor: { h: 45, s: 93, l: 47 },
    bgColor: { h: 40, s: 33, l: 96 },
    textColor: { h: 0, s: 0, l: 15 }
  },
  deep_forest: {
    primaryColor: { h: 160, s: 40, l: 15 },
    accentColor: { h: 160, s: 60, l: 40 },
    bgColor: { h: 0, s: 0, l: 95 },
    textColor: { h: 160, s: 20, l: 10 }
  }
};

export const applyThemeColors = (settings: any) => {
  if (!settings) return;
  const applyHSL = (name: string, val: any) => {
    if (!val || typeof val !== 'object' || val.h === undefined) return;
    document.documentElement.style.setProperty(name, `hsl(${val.h}, ${val.s}%, ${val.l}%)`);
    
    if (name === '--theme-primary-600') {
      document.documentElement.style.setProperty('--theme-primary-50', `hsl(${val.h}, ${val.s}%, ${Math.min(100, val.l + 45)}%)`);
      document.documentElement.style.setProperty('--theme-primary-100', `hsl(${val.h}, ${val.s}%, ${Math.min(100, val.l + 40)}%)`);
      document.documentElement.style.setProperty('--theme-primary-200', `hsl(${val.h}, ${val.s}%, ${Math.min(100, val.l + 30)}%)`);
      document.documentElement.style.setProperty('--theme-primary-400', `hsl(${val.h}, ${val.s}%, ${Math.min(100, Math.max(0, val.l + 10))}%)`);
      document.documentElement.style.setProperty('--theme-primary-500', `hsl(${val.h}, ${val.s}%, ${Math.min(100, Math.max(0, val.l + 5))}%)`);
      document.documentElement.style.setProperty('--theme-primary-700', `hsl(${val.h}, ${val.s}%, ${Math.max(0, val.l - 10)}%)`);
      document.documentElement.style.setProperty('--theme-primary-800', `hsl(${val.h}, ${val.s}%, ${Math.max(0, val.l - 20)}%)`);
    }

    if (name === '--theme-base-50') {
      const isDark = val.l < 50;
      const sign = isDark ? 1 : -1;
      document.documentElement.style.setProperty('--theme-base-100', `hsl(${val.h}, ${val.s}%, ${Math.max(0, Math.min(100, val.l + sign * 6))}%)`);
      document.documentElement.style.setProperty('--theme-base-200', `hsl(${val.h}, ${val.s}%, ${Math.max(0, Math.min(100, val.l + sign * 14))}%)`);
      document.documentElement.style.setProperty('--theme-base-300', `hsl(${val.h}, ${val.s}%, ${Math.max(0, Math.min(100, val.l + sign * 20))}%)`);
    }
    if (name === '--theme-text-main') {
      const isDark = val.l < 50;
      const sign = isDark ? 1 : -1;
      document.documentElement.style.setProperty('--theme-text-muted', `hsl(${val.h}, ${val.s}%, ${Math.max(0, Math.min(100, val.l + sign * 20))}%)`);
      document.documentElement.style.setProperty('--theme-text-light', `hsl(${val.h}, ${val.s}%, ${Math.max(0, Math.min(100, val.l + sign * 40))}%)`);
    }
    if (name === '--theme-primary-600') {
      document.documentElement.style.setProperty('--theme-primary-50', `hsl(${val.h}, ${val.s}%, 95%)`);
      document.documentElement.style.setProperty('--theme-primary-100', `hsl(${val.h}, ${val.s}%, 90%)`);
      document.documentElement.style.setProperty('--theme-primary-200', `hsl(${val.h}, ${val.s}%, 80%)`);
      document.documentElement.style.setProperty('--theme-primary-500', `hsl(${val.h}, ${val.s}%, ${Math.min(100, val.l + 10)}%)`);
      document.documentElement.style.setProperty('--theme-primary-700', `hsl(${val.h}, ${val.s}%, ${Math.max(0, val.l - 10)}%)`);
    }
  };
  
  if (settings.primaryColor) applyHSL('--theme-primary-600', settings.primaryColor);
  if (settings.accentColor) applyHSL('--theme-accent-500', settings.accentColor);
  if (settings.bgColor) applyHSL('--theme-base-50', settings.bgColor);
  if (settings.textColor) applyHSL('--theme-text-main', settings.textColor);
};

function HSLPicker({ label, value, onChange }: any) {
  if (!value || typeof value !== 'object' || value.h === undefined) return null;
  return (
    <div className="space-y-2 mb-4 p-4 bg-base-100/50 rounded-xl border border-base-200">
      <div className="flex justify-between items-center mb-4">
        <label className="text-xs font-bold uppercase tracking-widest text-text-muted">{label}</label>
        <div className="flex gap-2 items-center">
           <div className="w-6 h-6 rounded-md shadow-inner border border-base-200" style={{ backgroundColor: `hsl(${value.h}, ${value.s}%, ${value.l}%)` }} />
           <span className="text-[10px] font-mono bg-base-200/50 px-2 py-1 rounded text-text-muted">hsl({value.h}, {value.s}%, {value.l}%)</span>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-light w-4">H</span>
          <input type="range" min="0" max="360" value={value.h} onChange={e => onChange({...value, h: parseInt(e.target.value)})} className="flex-1 h-2 rounded-lg appearance-none bg-gradient-to-r from-red-500 via-green-500 to-blue-500 cursor-pointer" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-light w-4">S</span>
          <input type="range" min="0" max="100" value={value.s} onChange={e => onChange({...value, s: parseInt(e.target.value)})} className="flex-1 h-2 rounded-lg appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, hsl(${value.h}, 0%, ${value.l}%), hsl(${value.h}, 100%, ${value.l}%))` }} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-light w-4">L</span>
          <input type="range" min="0" max="100" value={value.l} onChange={e => onChange({...value, l: parseInt(e.target.value)})} className="flex-1 h-2 rounded-lg appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, hsl(${value.h}, ${value.s}%, 0%), hsl(${value.h}, ${value.s}%, 100%))` }} />
        </div>
      </div>
    </div>
  );
}

function AdminAppearanceTab({ refreshData, appSettings, setAppSettings }: any) {
  // Alias for compatibility within this component
  const settings = appSettings || {};
  const setSettings = setAppSettings;
  
  const [saving, setSaving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');

  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<any>(null);

  // Live CSS Injection
  React.useEffect(() => {
    if (settings) applyThemeColors(settings);
  }, [settings?.primaryColor, settings?.accentColor, settings?.bgColor, settings?.textColor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSettings((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImage(event.target?.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      if (logoInputRef.current) logoInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = React.useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const confirmCrop = () => {
    if (!cropImage || !croppedAreaPixels) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 512;
      canvas.width = MAX_SIZE;
      canvas.height = MAX_SIZE;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          image,
          croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height,
          0, 0, MAX_SIZE, MAX_SIZE
        );
        const compressedDataUrl = canvas.toDataURL('image/webp', 0.8);
        setSettings((prev: any) => ({ ...prev, logoUrl: compressedDataUrl }));
        setCropImage(null);
      }
    };
    image.src = cropImage;
  };

  const handleColorChange = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    setSettings((prev: any) => ({
      ...prev,
      ...PRESETS[presetKey]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings || {})
      });
      if (res.ok) {
        setSuccessMsg('Appearance settings and branding applied successfully!');
        if (refreshData) {
          refreshData();
        }
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        alert('Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings || Object.keys(settings).length === 0) {
     return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600"/></div>;
  }

  return (
    <div className="p-8 relative">
      <h3 className="text-2xl font-black text-text-main underline decoration-primary-500 decoration-4 underline-offset-8 mb-8">
        Appearance & Branding Manager
      </h3>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-2xl flex items-center gap-3 font-bold">
          <CheckCircle2 className="w-5 h-5" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* TEMPLATES */}
          <div className="p-6 bg-base-50 rounded-2xl border border-base-200 shadow-sm">
            <h4 className="font-bold text-text-main mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary-500" /> Preset Templates
            </h4>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => applyPreset('classic_madrasah')} 
                className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-lg hover:bg-emerald-600"
              >
                Classic Madrasah
              </button>
              <button 
                onClick={() => applyPreset('elegant_gold')} 
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-lg hover:bg-amber-500"
              >
                Elegant Gold
              </button>
              <button 
                onClick={() => applyPreset('deep_forest')} 
                className="px-4 py-2 bg-slate-800 text-emerald-100 rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-lg hover:bg-slate-700"
              >
                Deep Forest
              </button>
            </div>
            <p className="text-xs text-text-muted mt-3">Clicking a preset instantly updates the live preview. Don't forget to push "Save & Publish" to lock it in.</p>
          </div>

          <div className="p-6 bg-base-50 rounded-2xl border border-base-200 shadow-sm">
            <h4 className="font-bold text-text-main mb-6 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary-500" /> Advanced Color Editor (HSL)
            </h4>
            <HSLPicker label="Primary Color" value={settings.primaryColor} onChange={(v:any) => handleColorChange('primaryColor', v)} />
            <HSLPicker label="Accent Color" value={settings.accentColor} onChange={(v:any) => handleColorChange('accentColor', v)} />
            <HSLPicker label="Background Base" value={settings.bgColor} onChange={(v:any) => handleColorChange('bgColor', v)} />
            <HSLPicker label="Main Text Color" value={settings.textColor} onChange={(v:any) => handleColorChange('textColor', v)} />
          </div>

          <div className="p-6 bg-base-50 rounded-2xl border border-base-200 shadow-sm">
            <h4 className="font-bold text-text-main mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary-500" /> Dynamic Branding
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-text-main mb-1">Application Name</label>
                <input type="text" name="appName" value={settings.appName} onChange={handleChange} className="w-full bg-base-100 border border-base-200 rounded-xl px-4 py-3 text-sm" placeholder="e.g. Mamba'ul Huda Student Portal" />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-main mb-1">Badge Title</label>
                <input type="text" name="badgeTitle" value={settings.badgeTitle} onChange={handleChange} className="w-full bg-base-100 border border-base-200 rounded-xl px-4 py-3 text-sm" placeholder="e.g. Season 2 Active" />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-main mb-1">Hero Headline</label>
                <input type="text" name="heroTitle" value={settings.heroTitle} onChange={handleChange} className="w-full bg-base-100 border border-base-200 rounded-xl px-4 py-3 text-sm" placeholder="e.g. Global Leaderboard" />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-main mb-1">Hero Subtitle</label>
                <textarea rows={3} name="heroSubtitle" value={settings.heroSubtitle} onChange={(e:any) => handleChange(e)} className="w-full bg-base-100 border border-base-200 rounded-xl px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-main mb-2">Logo</label>
                <div className="flex gap-4 items-center">
                  <div className="relative inline-block group">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl border-4 border-base-100 bg-base-200 shadow-sm object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl border-4 border-base-100 bg-base-200 shadow-sm flex items-center justify-center text-primary-500">
                        <ImageIcon className="w-8 h-8 opacity-50" />
                      </div>
                    )}
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-base-900/60 rounded-2xl flex items-center justify-center text-base-50 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm" title="Upload Logo">
                      <ImageIcon className="w-6 h-6" />
                    </button>
                    <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                  </div>
                  <div className="flex-1">
                    <input type="text" name="logoUrl" value={settings.logoUrl} onChange={handleChange} className="w-full bg-base-100 border border-base-200 rounded-xl px-4 py-3 text-sm mb-2" placeholder="https://example.com/logo.png" />
                    <p className="text-[10px] text-text-light font-bold">Square image recommended. Max size 512x512, compressed via WebP.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full bg-primary-600 text-base-50 px-8 py-5 rounded-2xl font-black shadow-lg shadow-primary-200 flex justify-center items-center gap-2 hover:bg-primary-700 active:scale-95 transition-all text-lg"
          >
            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            {saving ? 'Synchronizing to Firebase...' : 'Save & Publish Theme Engine'}
          </button>
        </div>

        {/* LIVE PREVIEW PANE */}
        <div className="space-y-6">
          <div className="sticky top-8">
             <h4 className="font-black text-text-main mb-4 uppercase tracking-widest text-sm">Live Sandbox Preview</h4>
             
             {/* Preview: Navbar mini */}
             <div className="bg-base-50 border border-base-200 rounded-2xl p-4 mb-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} className="w-8 h-8 rounded-lg object-contain" />
                  ) : (
                    <div className="bg-primary-600 p-2 rounded-lg"><Trophy className="w-4 h-4 text-base-50" /></div>
                  )}
                  <span className="font-bold text-text-main">{settings.appName}</span>
                </div>
                <div className="w-8 h-8 bg-base-200 rounded-full" />
             </div>

             {/* Preview: Hero */}
             <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-8 rounded-[2rem] text-base-50 shadow-2xl relative overflow-hidden mb-6">
                <div className="absolute top-0 right-0 opacity-20 transform translate-x-1/4 -translate-y-1/4 rotate-12 mix-blend-overlay">
                  {settings.logoUrl ? <img src={settings.logoUrl} className="w-48 h-48" /> : <Trophy className="w-48 h-48" />}
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-base-100/10 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                    <Flame className="w-3 h-3 text-accent-500" /> {settings.badgeTitle}
                  </div>
                  <h1 className="text-3xl font-black tracking-tight leading-tight">{settings.heroTitle}</h1>
                  <p className="text-sm opacity-80 leading-relaxed max-w-sm">
                    {settings.heroSubtitle}
                  </p>
                </div>
             </div>

             {/* Preview: Card */}
             <div className="bg-base-50 rounded-2xl p-6 border border-base-200 shadow-sm transition-all hover:border-primary-300 hover:shadow-lg">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 bg-base-200 rounded-full flex items-center justify-center font-bold text-text-muted">
                    1
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-200 to-primary-100 rounded-full flex justify-center items-center overflow-hidden">
                     <UserIcon className="w-6 h-6 text-primary-500" />
                  </div>
                  <div>
                    <h5 className="font-bold text-text-main text-lg">Student Example</h5>
                    <p className="text-xs font-bold text-text-light uppercase tracking-widest">Web Dev Track</p>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xl font-black text-accent-500">1,250</div>
                    <div className="text-[10px] text-text-light font-bold uppercase tracking-widest">PTS</div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Cropper Overlay */}
      {cropImage && (
        <div className="fixed inset-0 bg-base-900 z-[100] flex flex-col mt-0 border-t-0 p-0 shadow-none">
          <div className="flex-1 relative">
            <Cropper
              image={cropImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="p-4 bg-base-900 border-t border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 w-full sm:w-1/2">
              <ZoomOut className="text-slate-400 w-5 h-5 flex-shrink-0" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <ZoomIn className="text-slate-400 w-5 h-5 flex-shrink-0" />
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setCropImage(null);
                  if (logoInputRef.current) logoInputRef.current.value = '';
                }} 
                className="px-6 py-2 rounded-xl font-bold text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmCrop} 
                className="bg-primary-600 px-6 py-2 rounded-xl text-white font-black hover:bg-primary-700 transition-colors"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
function AdminStatisticsTab() {
  // Reusable shared filter (preset + date range picker).
  const [filter, setFilter] = useState<TimeRangeValue>(() => createDefaultTimeRangeValue('last-week'));
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Map shared preset → legacy `range=` param the API understands.
        // Custom range takes precedence via from/to ISO params.
        const presetMap: Record<string, string> = {
          'last-week':  '1w',
          'last-month': '1m',
          'last-year':  '1y',
          'all-time':   'all',
          'custom':     'all',
        };
        const params = new URLSearchParams();
        params.set('range', presetMap[filter.preset] || 'all');
        if (filter.preset === 'custom') {
          if (filter.range.start) params.set('from', filter.range.start.toISOString());
          if (filter.range.end)   params.set('to',   filter.range.end.toISOString());
        }
        const [statsRes, logsRes] = await Promise.all([
          apiFetch(`/api/stats?${params.toString()}`),
          apiFetch('/api/logs')
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (logsRes.ok) {
          const l = await logsRes.json();
          setLogs(l.sort((a:any, b:any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filter]);

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h3 className="text-2xl font-black text-text-main underline decoration-primary-500 decoration-4 underline-offset-8">
          Dashboard Statistics & Logging
        </h3>
        <TimeRangeFilter value={filter} onChange={setFilter} size="md" />
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title={STATS_CAPTION.STUDENTS} value={stats?.totalStudents} icon={Users} color="text-blue-500" />
            <StatCard title={STATS_CAPTION.ACTIVE_GOALS} value={stats?.totalActiveGoals} icon={Target} color="text-amber-500" />
            <StatCard title={STATS_CAPTION.UNIQUE_VIEWS} value={stats?.uniqueVisitors} icon={Search} color="text-emerald-500" />
            <StatCard title={STATS_CAPTION.POINTS_DISTRIBUTED} value={stats?.totalPoints} icon={Trophy} color="text-purple-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-base-50 rounded-2xl p-6 border border-base-200 shadow-sm">
              <h4 className="font-bold text-text-main mb-6">Points Trend</h4>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats?.chartData || []}>
                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="points" stroke="var(--theme-primary-600)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-base-50 rounded-2xl p-6 border border-base-200 shadow-sm flex flex-col h-full">
              <h4 className="font-bold text-text-main mb-4">Activity Logs</h4>
              <div className="overflow-y-auto max-h-[300px] flex-1 space-y-4 pr-2">
                {logs.length === 0 && <p className="text-text-muted text-sm text-center py-10">No recent activity</p>}
                {logs.slice(0, 50).map((l: any, i: number) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="mt-1">
                      {l.type === 'education' ? <Target className="w-4 h-4 text-accent-500" /> : <Settings className="w-4 h-4 text-primary-500" />}
                    </div>
                    <div>
                      <p className="font-bold text-text-main">{l.action}</p>
                      <p className="text-xs text-text-muted">{l.details}</p>
                      <p className="text-[10px] text-text-light mt-1 font-mono">{new Date(l.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <AppAnalyticsPanel />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-base-50 p-6 rounded-2xl border border-base-200 shadow-sm flex items-center gap-4">
      <div className={`p-4 rounded-xl bg-base-100 ${color} shadow-sm border border-base-200`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">{title}</p>
        <p className="text-2xl font-black text-text-main">{value || 0}</p>
      </div>
    </div>
  );
}

// ============================================================================
// App Analytics — visitors / logged-in / device / interactions, sourced from
// the public.app_events table populated by src/lib/analytics.ts
// ============================================================================

const INTERACTION_EVENTS = ['leaderboard_filter', 'profile_open', 'admin_action', 'admin_login'] as const;

function AppAnalyticsPanel() {
  const [filter, setFilter] = useState<TimeRangeValue>(() => createDefaultTimeRangeValue('last-week'));
  const [events, setEvents] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = supabase.from('app_events').select('*').order('created_at', { ascending: true }).limit(10000);
        if (filter.range.start) q = q.gte('created_at', filter.range.start.toISOString());
        if (filter.range.end)   q = q.lte('created_at', filter.range.end.toISOString());
        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) setEvents(data || []);
      } catch (e) {
        console.error('Failed to load app_events', e);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filter]);

  // Aggregate metrics + chart-ready series.
  const metrics = useMemo(() => {
    const list = events || [];
    const sessionVisitors = new Set<string>();
    const adminSessions = new Set<string>();
    const deviceSessions: Record<string, Set<string>> = { desktop: new Set(), tablet: new Set(), mobile: new Set() };
    let interactions = 0;
    const interactionBreakdown: Record<string, number> = {};

    // Daily buckets (YYYY-MM-DD).
    const buckets: Record<string, { visitors: Set<string>; loggedIn: Set<string>; interactions: number }> = {};
    const bucketKey = (d: Date) => d.toISOString().slice(0, 10);

    list.forEach((e: any) => {
      const sid = e.session_id || 'anon';
      sessionVisitors.add(sid);
      if (e.is_admin) adminSessions.add(sid);
      if (deviceSessions[e.device]) deviceSessions[e.device].add(sid);
      else deviceSessions.desktop.add(sid);

      if ((INTERACTION_EVENTS as readonly string[]).includes(e.event_type)) {
        interactions++;
        interactionBreakdown[e.event_type] = (interactionBreakdown[e.event_type] || 0) + 1;
      }

      const k = bucketKey(new Date(e.created_at));
      if (!buckets[k]) buckets[k] = { visitors: new Set(), loggedIn: new Set(), interactions: 0 };
      buckets[k].visitors.add(sid);
      if (e.is_admin) buckets[k].loggedIn.add(sid);
      if ((INTERACTION_EVENTS as readonly string[]).includes(e.event_type)) buckets[k].interactions++;
    });

    const trend = Object.keys(buckets).sort().map((date) => ({
      date,
      visitors: buckets[date].visitors.size,
      loggedIn: buckets[date].loggedIn.size,
      interactions: buckets[date].interactions,
    }));

    const deviceData = (['desktop', 'tablet', 'mobile'] as const).map((d) => ({
      device: d.charAt(0).toUpperCase() + d.slice(1),
      visitors: deviceSessions[d].size,
    }));

    const interactionData = Object.keys(interactionBreakdown).map((k) => ({
      type: k.replace(/_/g, ' '),
      count: interactionBreakdown[k],
    }));

    return {
      visitors: sessionVisitors.size,
      loggedIn: adminSessions.size,
      anonymous: sessionVisitors.size - adminSessions.size,
      interactions,
      trend,
      deviceData,
      interactionData,
    };
  }, [events]);

  return (
    <div className="mt-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h3 className="text-2xl font-black text-text-main underline decoration-accent-500 decoration-4 underline-offset-8">
          App Analytics
        </h3>
        <TimeRangeFilter value={filter} onChange={setFilter} size="md" />
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="App Visitors"    value={metrics.visitors}     icon={Users}      color="text-blue-500" />
            <StatCard title="Logged-in Visitors" value={metrics.loggedIn}  icon={LogIn}      color="text-emerald-500" />
            <StatCard title="Anonymous Visitors" value={metrics.anonymous} icon={UserIcon}   color="text-slate-500" />
            <StatCard title="Interactions"    value={metrics.interactions} icon={TrendingUp} color="text-purple-500" />
          </div>

          <div className="bg-base-50 rounded-2xl p-6 border border-base-200 shadow-sm">
            <h4 className="font-bold text-text-main mb-6">Visitor & Interaction Trend</h4>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.trend}>
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="visitors"     stroke="var(--theme-primary-600)" strokeWidth={3} dot={{ r: 3 }} name="Visitors" />
                  <Line type="monotone" dataKey="loggedIn"     stroke="#10b981"                  strokeWidth={3} dot={{ r: 3 }} name="Logged-in" />
                  <Line type="monotone" dataKey="interactions" stroke="#a855f7"                  strokeWidth={3} dot={{ r: 3 }} name="Interactions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-base-50 rounded-2xl p-6 border border-base-200 shadow-sm">
              <h4 className="font-bold text-text-main mb-6">Visitors by Device</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.deviceData}>
                    <XAxis dataKey="device" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar dataKey="visitors" fill="var(--theme-primary-600)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-base-50 rounded-2xl p-6 border border-base-200 shadow-sm">
              <h4 className="font-bold text-text-main mb-6">Interactions Breakdown</h4>
              {metrics.interactionData.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-16">No interactions in this range</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.interactionData} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="type" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={120} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#a855f7" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
