import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Trophy,
  LayoutDashboard,
  Grid3X3,
  Flame,
  Target,
  ListTodo,
  LogOut,
  Save,
  Loader2,
  CalendarCheck,
  Moon,
  Smile,
  Frown,
  Meh,
  Laugh,
  Angry,
  Minus,
  Plus as PlusIcon
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot
} from "firebase/firestore";

import { firebaseConfig, appId as importedAppId } from './firebaseConfig';

// --- FIREBASE INITIALIZATION (Once) ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = importedAppId;

// --- CONSTANTS ---
const GREEN_PRIMARY = "#10b981";
const GREEN_DIM = "#34d399";
const GRAY_TRACK = "#f3f4f6";
const TARGET_LINE = "#f87171";

const MOODS = {
  1: { icon: Angry, color: "text-red-500", label: "Angry" },
  2: { icon: Frown, color: "text-orange-500", label: "Bad" },
  3: { icon: Meh, color: "text-yellow-500", label: "Okay" },
  4: { icon: Smile, color: "text-emerald-500", label: "Good" },
  5: { icon: Laugh, color: "text-blue-500", label: "Great" }
};

// --- HELPER FUNCTIONS ---
const getMonthDates = (year, month) => {
  const dates = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(new Date(year, month, d));
  }
  return dates;
};

// --- MAIN COMPONENT ---
export default function HabitTracker() {
  // --- FIREBASE SETUP ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState('today');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Data State
  const initialHabits = [
    { id: 1, name: "Wake up at 5:00 AM", goal: 100, data: {} },
    { id: 2, name: "Deep Work (2 hrs)", goal: 80, data: {} },
    { id: 3, name: "No Sugar", goal: 90, data: {} },
    { id: 4, name: "Read 10 Pages", goal: 100, data: {} },
    { id: 5, name: "Workout / Gym", goal: 75, data: {} },
  ];

  const [habits, setHabits] = useState(initialHabits);
  const [metrics, setMetrics] = useState({}); // { 'YYYY-MM-DD': { mood: 1-5, sleep: number } }

  // Derived Date Info
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month]);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // --- FIREBASE INIT & AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== 'undefined' && window.__initial_auth_token) {
        await signInWithCustomToken(auth, window.__initial_auth_token);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // --- REAL-TIME DATABASE LISTENER ---
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'data', 'userHabits');

        const unsubDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setHabits(data.habits || initialHabits);
            setMetrics(data.metrics || {});
          } else {
            // Initialize new user
            setDoc(userDocRef, { habits: initialHabits, metrics: {} });
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching data:", error);
          setLoading(false);
        });
        return () => unsubDoc();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- ACTIONS ---

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        alert("Popup was blocked. Please allow popups for this site and try again.");
      } else {
        alert("Login failed. Please try again.");
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setHabits(initialHabits);
    setMetrics({});
  };

  const saveToCloud = async (newHabits, newMetrics) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'userHabits'), {
        habits: newHabits !== undefined ? newHabits : habits,
        metrics: newMetrics !== undefined ? newMetrics : metrics,
        lastUpdated: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error saving:", e);
    }
  };

  const backupToDrive = () => {
    setSyncing(true);
    setTimeout(() => {
      const exportData = { habits, metrics };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "habit_tracker_backup.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      setSyncing(false);
      alert("Backup downloaded! (Enable Drive API for real sync)");
    }, 1500);
  };

  // Habit Toggles
  const toggleHabit = (habitId, dateObj) => {
    const dateKey = dateObj.toISOString().split('T')[0];
    const newHabits = habits.map(h => {
      if (h.id === habitId) {
        const newData = { ...h.data };
        if (newData[dateKey]) delete newData[dateKey];
        else newData[dateKey] = true;
        return { ...h, data: newData };
      }
      return h;
    });
    setHabits(newHabits);
    saveToCloud(newHabits, undefined);
  };

  const deleteHabit = (id) => {
    if (confirm("Delete this habit row?")) {
      const newHabits = habits.filter(h => h.id !== id);
      setHabits(newHabits);
      saveToCloud(newHabits, undefined);
    }
  };

  const addHabit = () => {
    const name = prompt("Enter new habit name:");
    if (name) {
      const newHabits = [...habits, { id: Date.now(), name, goal: 100, data: {} }];
      setHabits(newHabits);
      saveToCloud(newHabits, undefined);
    }
  };

  // Metrics Updates
  const updateMetric = (dateObj, type, value) => {
    const dateKey = dateObj.toISOString().split('T')[0];
    const newMetrics = { ...metrics };
    if (!newMetrics[dateKey]) newMetrics[dateKey] = {};
    newMetrics[dateKey][type] = value;

    setMetrics(newMetrics);
    saveToCloud(undefined, newMetrics);
  };

  // --- STATS CALCULATIONS ---

  const dailyStats = useMemo(() => {
    return monthDates.map(date => {
      const dateKey = date.toISOString().split('T')[0];
      const completed = habits.filter(h => h.data[dateKey]).length;
      const total = habits.length;
      const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
      return {
        date: dateKey,
        day: date.getDate(),
        fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed,
        notDone: total - completed,
        rate
      };
    });
  }, [habits, monthDates]);

  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  const todayCompleted = habits.filter(h => h.data[todayKey]).length;
  const todayTotal = habits.length;
  const todayRate = todayTotal === 0 ? 0 : Math.round((todayCompleted / todayTotal) * 100);

  // Current Mood/Sleep for Today
  const currentMood = metrics[todayKey]?.mood || 0;
  const currentSleep = metrics[todayKey]?.sleep || 0;

  const getHabitStats = (habit) => {
    let count = 0;
    monthDates.forEach(d => {
      const k = d.toISOString().split('T')[0];
      if (habit.data[k]) count++;
    });
    const totalDays = monthDates.length;
    return {
      actual: totalDays,
      done: count,
      percentage: totalDays === 0 ? 0 : Math.round((count / totalDays) * 100)
    };
  };

  // Metrics Stats for Tracker
  const getMetricStats = (type) => {
    if (type === 'mood') {
      let loggedDays = 0;
      monthDates.forEach(d => {
        if (metrics[d.toISOString().split('T')[0]]?.mood) loggedDays++;
      });
      return { label: "Logged", value: loggedDays };
    }
    if (type === 'sleep') {
      let totalSleep = 0;
      let loggedDays = 0;
      monthDates.forEach(d => {
        const val = metrics[d.toISOString().split('T')[0]]?.sleep;
        if (val) {
          totalSleep += val;
          loggedDays++;
        }
      });
      const avg = loggedDays > 0 ? (totalSleep / loggedDays).toFixed(1) : 0;
      return { label: "Avg Hrs", value: avg };
    }
    return { label: "-", value: 0 };
  };

  // --- COMPONENT: DONUT CHART ---
  const DailyProgressRing = ({ percentage }) => {
    const data = [{ name: 'Done', value: percentage }, { name: 'Left', value: 100 - percentage }];
    return (
      <div className="relative h-64 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={75} outerRadius={95} startAngle={90} endAngle={-270} dataKey="value" stroke="none" cornerRadius={5} paddingAngle={2}>
              <Cell key="cell-0" fill={GREEN_PRIMARY} />
              <Cell key="cell-1" fill={GRAY_TRACK} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute flex flex-col items-center justify-center pointer-events-none">
          <span className="text-5xl font-bold text-gray-800 tracking-tight">{percentage}%</span>
          <span className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Done</span>
        </div>
      </div>
    );
  };

  // --- LOGIN VIEW ---
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Habit<span className="text-emerald-600">Master</span></h1>
          <p className="text-gray-500 mb-8">Turn your life into a game. Login to sync your progress.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="group-hover:text-gray-900">Login with Google</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-emerald-600"><Loader2 className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800 font-sans overflow-hidden">
      {/* ... keeping the rest of the render logic the same ... */}

      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 shadow-sm z-20">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 text-white p-1.5 rounded-lg shadow-sm">
            <Trophy size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight text-gray-800 hidden sm:inline-block">Habit<span className="text-emerald-600">Master</span></span>
        </div>
        <div className="flex items-center gap-2">
          {activeTab !== 'today' && (
            <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 px-1 py-1 shadow-inner mr-2">
              <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-1 hover:bg-white hover:shadow-sm rounded transition text-gray-500"><ChevronLeft size={16} /></button>
              <span className="w-24 sm:w-32 text-center text-sm font-bold text-gray-700">{monthName} {year}</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-1 hover:bg-white hover:shadow-sm rounded transition text-gray-500"><ChevronRight size={16} /></button>
            </div>
          )}
          <button onClick={backupToDrive} disabled={syncing} className={`p-2 rounded-lg text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors ${syncing ? 'animate-pulse' : ''}`}><Save size={20} /></button>
          <button onClick={handleLogout} className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">

        {/* --- VIEW 1: TODAY (Activity) --- */}
        {activeTab === 'today' && (
          <div className="h-full overflow-y-auto p-4 md:p-6 bg-gray-50/50">
            <div className="max-w-2xl mx-auto space-y-6 pb-20">

              {/* Header Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Today's Focus</h1>
                    <p className="text-sm text-gray-500 font-medium flex items-center gap-2 mt-1">
                      <CalendarCheck size={14} />
                      {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-emerald-600">{todayRate}%</div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Complete</div>
                  </div>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${todayRate}%` }}></div>
                </div>
              </div>

              {/* Wellness Check Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Smile size={20} className="text-blue-500" /> Wellness Check</h2>

                <div className="space-y-6">
                  {/* Mood Selector */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Overall Mood</p>
                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                      {[1, 2, 3, 4, 5].map(m => {
                        const MIcon = MOODS[m].icon;
                        const isSelected = currentMood === m;
                        return (
                          <button
                            key={m}
                            onClick={() => updateMetric(today, 'mood', m)}
                            className={`p-2 rounded-lg transition-all transform duration-200 flex flex-col items-center gap-1 ${isSelected ? 'bg-white shadow-md scale-110 ring-2 ring-emerald-100' : 'hover:bg-gray-200 opacity-60 hover:opacity-100'}`}
                          >
                            <MIcon size={28} className={isSelected ? MOODS[m].color : 'text-gray-600'} />
                            {isSelected && <span className="text-[9px] font-bold text-gray-500">{MOODS[m].label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sleep Input */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Hours Slept</p>
                    <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200 max-w-[200px]">
                      <button onClick={() => updateMetric(today, 'sleep', Math.max(0, currentSleep - 1))} className="p-1 bg-white rounded-md shadow-sm hover:bg-gray-100 text-gray-600"><Minus size={18} /></button>
                      <div className="flex-1 text-center flex items-center justify-center gap-1">
                        <Moon size={16} className="text-indigo-500" />
                        <span className="text-xl font-bold text-gray-800">{currentSleep}</span>
                        <span className="text-xs text-gray-500 font-medium">hrs</span>
                      </div>
                      <button onClick={() => updateMetric(today, 'sleep', currentSleep + 1)} className="p-1 bg-white rounded-md shadow-sm hover:bg-gray-100 text-gray-600"><PlusIcon size={18} /></button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Habit List */}
              <div className="space-y-3">
                {habits.map(habit => {
                  const isDone = habit.data[todayKey];
                  return (
                    <div
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id, today)}
                      className={`relative overflow-hidden group p-4 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between shadow-sm select-none ${isDone ? 'bg-emerald-500 border-emerald-500 transform scale-[1.01]' : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-md'}`}
                    >
                      <div className="flex items-center gap-4 z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${isDone ? 'bg-white border-white text-emerald-500' : 'bg-transparent border-gray-300 text-transparent group-hover:border-emerald-400'}`}>
                          <Check size={16} strokeWidth={4} />
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold transition-colors duration-300 ${isDone ? 'text-white' : 'text-gray-800'}`}>{habit.name}</h3>
                          {isDone && <p className="text-xs text-emerald-100 font-medium">Completed!</p>}
                        </div>
                      </div>
                      {isDone && <Flame className="text-emerald-400 opacity-50 absolute right-4 bottom-[-10px] w-24 h-24 transform rotate-12" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="h-full overflow-y-auto p-4 md:p-8 bg-gray-50/50">
            <div className="max-w-6xl mx-auto space-y-6 pb-20">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Overview</h1>
                  <p className="text-sm text-gray-500 font-medium">Monthly progress report</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 flex flex-col items-center justify-between relative overflow-hidden">
                  <div className="w-full flex justify-between items-start z-10">
                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Today's Focus</h3>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold">{today.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  </div>
                  <DailyProgressRing percentage={todayRate} />
                  <div className="w-full grid grid-cols-2 gap-3 z-10">
                    <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-center">
                      <span className="block text-lg font-bold text-gray-800">{todayCompleted}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Done</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-center">
                      <span className="block text-lg font-bold text-gray-800">{todayTotal - todayCompleted}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Left</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-gray-900 font-bold text-lg">Consistency Trend</h3>
                      <p className="text-xs text-gray-400 font-medium">Daily completion rate vs Goal</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                      <Flame size={14} fill="#10b981" />
                      Active Streak
                    </div>
                  </div>
                  <div className="flex-1 min-h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyStats} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={GREEN_PRIMARY} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={GREEN_PRIMARY} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} interval={4} dy={10} />
                        <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fill: '#d1d5db', fontSize: 10 }} domain={[0, 100]} ticks={[0, 50, 100]} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }} itemStyle={{ color: GREEN_PRIMARY }} />
                        <ReferenceLine y={80} stroke={TARGET_LINE} strokeDasharray="3 3" strokeWidth={2} label={{ position: 'top', value: 'Goal (80%)', fill: TARGET_LINE, fontSize: 10, fontWeight: 700 }} />
                        <Area type="monotone" dataKey="rate" stroke={GREEN_PRIMARY} strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" activeDot={{ r: 6, strokeWidth: 0, fill: GREEN_PRIMARY }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                  <h3 className="font-bold text-gray-800 text-lg">Habit Performance</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-400 font-medium"><Target size={14} /> Monthly Goal</div>
                </div>
                <div className="divide-y divide-gray-50">
                  {habits.map(habit => {
                    const stats = getHabitStats(habit);
                    const isHigh = stats.percentage >= 80;
                    const isMed = stats.percentage >= 50 && stats.percentage < 80;
                    return (
                      <div key={habit.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors gap-3">
                        <div className="flex items-center gap-4 min-w-[150px]">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isHigh ? 'bg-emerald-100 text-emerald-600' : isMed ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                            {stats.percentage}%
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{habit.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Score</p>
                          </div>
                        </div>
                        <div className="flex-1 max-w-md flex items-center gap-3">
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${stats.percentage}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 3: TRACKER --- */}
        {activeTab === 'tracker' && (
          <div className="h-full flex flex-col bg-white">
            <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-2 bg-gray-50">
              <button onClick={addHabit} className="flex items-center gap-1.5 text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 text-gray-600 shadow-sm transition-all">
                <Plus size={14} /> New Habit
              </button>
              <div className="h-4 w-[1px] bg-gray-300 mx-2"></div>
              <span className="text-xs text-gray-400 font-medium italic">Tap cells to mark as complete</span>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="inline-block min-w-full align-middle relative">
                {/* Grid Header */}
                <div className="flex sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
                  <div className="sticky left-0 w-32 md:w-64 bg-gray-50 border-r border-gray-200 p-3 font-bold text-xs uppercase tracking-wider text-gray-500 flex items-center shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">Habit</div>
                  {monthDates.map(date => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div key={date.toString()} className={`flex-shrink-0 w-11 text-center border-r border-gray-100 py-2 flex flex-col justify-center ${isToday ? 'bg-emerald-50' : ''}`}>
                        <span className="text-[9px] text-gray-400 font-bold uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</span>
                        <span className={`text-sm font-bold ${isToday ? 'text-emerald-600' : 'text-gray-700'}`}>{date.getDate()}</span>
                      </div>
                    );
                  })}
                  <div className="flex-shrink-0 w-16 p-3 font-bold text-[10px] uppercase tracking-wider text-gray-400 text-center border-r border-gray-200 flex items-center justify-center bg-gray-50">Actual</div>
                  <div className="flex-shrink-0 w-16 p-3 font-bold text-[10px] uppercase tracking-wider text-gray-400 text-center border-r border-gray-200 flex items-center justify-center bg-gray-50">Done</div>
                  <div className="flex-shrink-0 w-24 p-3 font-bold text-[10px] uppercase tracking-wider text-gray-400 text-center border-r border-gray-200 flex items-center justify-center bg-gray-50">Progress</div>
                </div>

                {/* Habit Rows */}
                {habits.map((habit, idx) => {
                  const stats = getHabitStats(habit);
                  return (
                    <div key={habit.id} className="flex border-b border-gray-100 hover:bg-gray-50/50 group">
                      <div className="sticky left-0 w-32 md:w-64 bg-white group-hover:bg-gray-50 border-r border-gray-200 p-3 flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] z-0">
                        <span className="text-sm font-semibold text-gray-700 truncate">{habit.name}</span>
                        <button onClick={() => deleteHabit(habit.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"><Trash2 size={14} /></button>
                      </div>
                      {monthDates.map(date => {
                        const dateKey = date.toISOString().split('T')[0];
                        const isChecked = habit.data[dateKey];
                        return (
                          <div key={dateKey} onClick={() => toggleHabit(habit.id, date)} className={`flex-shrink-0 w-11 border-r border-gray-100 cursor-pointer flex items-center justify-center transition-all duration-200 ${isChecked ? 'bg-emerald-500 shadow-inner' : 'hover:bg-gray-50'}`}>
                            {isChecked && <Check size={18} className="text-white drop-shadow-sm" strokeWidth={3.5} />}
                          </div>
                        );
                      })}
                      <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50/30 flex items-center justify-center"><span className="text-xs font-medium text-gray-500">{stats.actual}</span></div>
                      <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50/30 flex items-center justify-center"><span className="text-xs font-bold text-gray-700">{stats.done}</span></div>
                      <div className="flex-shrink-0 w-24 border-r border-gray-200 bg-gray-50/30 flex items-center justify-center px-2">
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.percentage}%` }}></div></div>
                        <span className="text-[10px] font-bold text-gray-500 ml-1">{stats.percentage}%</span>
                      </div>
                    </div>
                  );
                })}

                {/* Divider */}
                <div className="h-8 bg-gray-100 border-t border-b border-gray-200 flex items-center px-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bio-Metrics</span>
                </div>

                {/* Bio-Metrics Rows */}
                {/* 1. MOOD */}
                <div className="flex border-b border-gray-100 bg-white group">
                  <div className="sticky left-0 w-32 md:w-64 bg-white border-r border-gray-200 p-3 flex items-center gap-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] z-0">
                    <div className="bg-blue-100 p-1 rounded-md text-blue-500"><Smile size={14} /></div>
                    <span className="text-sm font-semibold text-gray-700 truncate">Mood</span>
                  </div>
                  {monthDates.map(date => {
                    const dateKey = date.toISOString().split('T')[0];
                    const moodVal = metrics[dateKey]?.mood;
                    const MIcon = moodVal ? MOODS[moodVal].icon : null;
                    return (
                      <div key={dateKey} className="flex-shrink-0 w-11 border-r border-gray-100 flex items-center justify-center bg-gray-50/30">
                        {MIcon && <MIcon size={16} className={MOODS[moodVal].color} />}
                      </div>
                    );
                  })}
                  <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50/30 flex items-center justify-center text-[10px] text-gray-400">Days</div>
                  <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50/30 flex items-center justify-center text-xs font-bold text-gray-700">{getMetricStats('mood').value}</div>
                  <div className="flex-shrink-0 w-24 border-r border-gray-200 bg-gray-50/30"></div>
                </div>

                {/* 2. SLEEP */}
                <div className="flex border-b border-gray-100 bg-white group">
                  <div className="sticky left-0 w-32 md:w-64 bg-white border-r border-gray-200 p-3 flex items-center gap-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] z-0">
                    <div className="bg-indigo-100 p-1 rounded-md text-indigo-500"><Moon size={14} /></div>
                    <span className="text-sm font-semibold text-gray-700 truncate">Sleep Hours</span>
                  </div>
                  {monthDates.map(date => {
                    const dateKey = date.toISOString().split('T')[0];
                    const sleepVal = metrics[dateKey]?.sleep;
                    return (
                      <div key={dateKey} className="flex-shrink-0 w-11 border-r border-gray-100 flex items-center justify-center bg-gray-50/30">
                        {sleepVal > 0 && <span className="text-xs font-bold text-indigo-600">{sleepVal}</span>}
                      </div>
                    );
                  })}
                  <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50/30 flex items-center justify-center text-[10px] text-gray-400">Avg</div>
                  <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50/30 flex items-center justify-center text-xs font-bold text-gray-700">{getMetricStats('sleep').value}</div>
                  <div className="flex-shrink-0 w-24 border-r border-gray-200 bg-gray-50/30"></div>
                </div>


                {/* Stats Footer */}
                <div className="bg-gray-50 border-t border-gray-300 sticky bottom-0 z-10 shadow-[0_-5px_10px_-5px_rgba(0,0,0,0.1)] mt-auto">
                  <div className="flex border-b border-gray-200">
                    <div className="sticky left-0 w-32 md:w-64 bg-gray-50 border-r border-gray-200 p-2 font-bold text-[10px] uppercase tracking-wider text-emerald-600 text-right shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">Done</div>
                    {dailyStats.map(stat => (
                      <div key={`done-${stat.date}`} className="flex-shrink-0 w-11 border-r border-gray-200 flex items-center justify-center bg-emerald-50/50"><span className="text-[10px] font-bold text-emerald-600">{stat.completed}</span></div>
                    ))}
                    <div className="flex-shrink-0 w-[224px] border-r border-gray-200 bg-gray-100"></div>
                  </div>
                  <div className="flex border-b border-gray-200">
                    <div className="sticky left-0 w-32 md:w-64 bg-gray-50 border-r border-gray-200 p-2 font-bold text-[10px] uppercase tracking-wider text-gray-400 text-right shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">Not Done</div>
                    {dailyStats.map(stat => (
                      <div key={`notdone-${stat.date}`} className="flex-shrink-0 w-11 border-r border-gray-200 flex items-center justify-center"><span className="text-[10px] font-medium text-gray-400">{stat.notDone}</span></div>
                    ))}
                    <div className="flex-shrink-0 w-[224px] border-r border-gray-200 bg-gray-100"></div>
                  </div>
                  <div className="flex border-b border-gray-200">
                    <div className="sticky left-0 w-32 md:w-64 bg-gray-50 border-r border-gray-200 p-2 font-bold text-[10px] uppercase tracking-wider text-gray-600 text-right shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">Percentage</div>
                    {dailyStats.map(stat => (
                      <div key={`pct-${stat.date}`} className="flex-shrink-0 w-11 border-r border-gray-200 flex items-center justify-center"><span className="text-[10px] font-bold text-gray-700">{stat.rate}%</span></div>
                    ))}
                    <div className="flex-shrink-0 w-[224px] border-r border-gray-200 bg-gray-100"></div>
                  </div>
                  <div className="flex h-20 bg-white">
                    <div className="sticky left-0 w-32 md:w-64 bg-white border-r border-gray-200 flex items-center justify-end p-3 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] z-20"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Progress Trend</span></div>
                    <div style={{ width: `${monthDates.length * 44}px` }} className="flex-shrink-0 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyStats} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="chartColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={GREEN_PRIMARY} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={GREEN_PRIMARY} stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Tooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', padding: '4px 8px', fontSize: '12px' }} itemStyle={{ color: GREEN_PRIMARY, fontWeight: 'bold' }} labelStyle={{ display: 'none' }} formatter={(value) => [`${value}%`]} />
                          <Area type="monotone" dataKey="rate" stroke={GREEN_PRIMARY} strokeWidth={2} fill="url(#chartColor)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-shrink-0 w-[224px] bg-gray-50 border-l border-gray-200"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* App Navigation */}
      <nav className="bg-white border-t border-gray-200 h-16 flex items-center justify-around pb-2 safe-area-bottom shadow-[0_-5px_15px_rgba(0,0,0,0.02)] z-30">
        <button onClick={() => setActiveTab('today')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'today' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1 rounded-full ${activeTab === 'today' ? 'bg-emerald-50' : ''}`}><ListTodo size={24} strokeWidth={activeTab === 'today' ? 2.5 : 2} /></div>
          <span className="text-[10px] font-bold">Today</span>
        </button>
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1 rounded-full ${activeTab === 'dashboard' ? 'bg-emerald-50' : ''}`}><LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} /></div>
          <span className="text-[10px] font-bold">Dashboard</span>
        </button>
        <button onClick={() => setActiveTab('tracker')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'tracker' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1 rounded-full ${activeTab === 'tracker' ? 'bg-emerald-50' : ''}`}><Grid3X3 size={24} strokeWidth={activeTab === 'tracker' ? 2.5 : 2} /></div>
          <span className="text-[10px] font-bold">Tracker</span>
        </button>
      </nav>

    </div>
  );
}
