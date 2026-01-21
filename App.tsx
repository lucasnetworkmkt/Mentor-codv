
import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import LiveVoice from './components/LiveVoice';
import MentalMap from './components/MentalMap';
import ExecutionTimer from './components/ExecutionTimer';
import ChatHistory from './components/ChatHistory';
import EagleEmblem from './components/EagleEmblem';
import ProgressionModal from './components/ProgressionModal';
import { AppView, UserStats, TimerState, ChatSession, UserProfile, MentalMapItem } from './types';
import { MessageSquare, Mic, Map, Timer, Menu, X, Terminal, Trophy, Star, Zap, Clock, LogIn, Lock, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { INITIAL_MESSAGE } from './constants';
import { authService } from './services/authService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [progressionModalOpen, setProgressionModalOpen] = useState(false);
  
  // --- Auth States ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState('');

  // Form Inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  // --- Initial Auth Check ---
  useEffect(() => {
    const checkSession = async () => {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setCurrentView(AppView.CHAT);
      }
    };
    checkSession();
  }, []);

  // --- Auth Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoadingAuth(true);
    try {
      const response = await authService.login(loginEmail, loginPass);
      setUser(response.user);
      setCurrentView(AppView.CHAT);
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao acessar o sistema.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoadingAuth(true);
    try {
      const response = await authService.register(regName, regEmail, regPass);
      setUser(response.user);
      setCurrentView(AppView.CHAT);
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao criar conta.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setCurrentView(AppView.LOGIN);
    setAuthMode('LOGIN');
    setLoginEmail('');
    setLoginPass('');
    setRegName('');
    setRegEmail('');
    setRegPass('');
    setSidebarOpen(false);
  };

  // --- Data Loading Logic (Strictly tied to user.id) ---
  
  const loadUserData = <T,>(key: string, defaultVal: T): T => {
    if (!user?.id) return defaultVal;
    const saved = localStorage.getItem(`mentor_data_${user.id}_${key}`);
    try {
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error(`Error loading ${key}`, e); }
    return defaultVal;
  };

  const saveUserData = (key: string, data: any) => {
    if (!user?.id) return;
    localStorage.setItem(`mentor_data_${user.id}_${key}`, JSON.stringify(data));
  };

  // State Declarations
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [mentalMaps, setMentalMaps] = useState<MentalMapItem[]>([]); // New state for Maps
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [userStats, setUserStats] = useState<UserStats>({ userId: '', points: 0, level: 1, streak: 0, achievements: [] });
  const [timer, setTimer] = useState<TimerState>({ minutes: 25, seconds: 0, isActive: false, mode: 'FOCUS', deliverable: '' });

  // Load Data Effect (Runs whenever user changes)
  useEffect(() => {
    if (!user?.id) return;

    // Load Sessions
    const loadedSessions = loadUserData<ChatSession[]>('sessions', [{
      id: Date.now().toString(),
      title: 'Sessão Inicial',
      messages: [{ id: 'init', role: 'model', text: INITIAL_MESSAGE, timestamp: new Date() }],
      lastModified: new Date()
    }]);
    
    // Fix Dates from JSON
    const parsedSessions = loadedSessions.map(s => ({
        ...s,
        lastModified: new Date(s.lastModified),
        messages: s.messages.map(m => ({...m, timestamp: new Date(m.timestamp)}))
    }));
    setSessions(parsedSessions);
    setActiveSessionId(parsedSessions[0].id);

    // Load Mental Maps
    const loadedMaps = loadUserData<MentalMapItem[]>('maps', []);
    const parsedMaps = loadedMaps.map(m => ({
      ...m,
      createdAt: new Date(m.createdAt)
    }));
    setMentalMaps(parsedMaps);

    // Load Stats
    const loadedStats = loadUserData<UserStats>('stats', {
      userId: user.id,
      points: 0,
      level: 1,
      streak: 0,
      achievements: []
    });
    setUserStats(loadedStats);

  }, [user?.id]);

  // Persistence Effects
  useEffect(() => {
    if (user?.id && sessions.length > 0) saveUserData('sessions', sessions);
  }, [sessions, user?.id]);

  useEffect(() => {
    if (user?.id) saveUserData('maps', mentalMaps);
  }, [mentalMaps, user?.id]);

  useEffect(() => {
    if (user?.id) saveUserData('stats', userStats);
  }, [userStats, user?.id]);


  // --- Logic Functions ---

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Nova Estratégia',
      messages: [{ id: 'init', role: 'model', text: INITIAL_MESSAGE, timestamp: new Date() }],
      lastModified: new Date()
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
    setCurrentView(AppView.CHAT);
    setSidebarOpen(false);
  };

  const updateSession = (updatedSession: ChatSession) => {
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  const getActiveSession = () => {
    if (sessions.length === 0) {
        return {
            id: 'loading',
            title: 'Carregando...',
            messages: [],
            lastModified: new Date()
        };
    }
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  };

  const saveMentalMap = (topic: string, content: string) => {
    const newMap: MentalMapItem = {
      id: Date.now().toString(),
      topic,
      content,
      createdAt: new Date()
    };
    setMentalMaps(prev => [newMap, ...prev]);
  };

  const addPoints = (amount: number, reason?: string) => {
    if (amount <= 0) return;
    setUserStats(prev => {
      const newPoints = Math.min(prev.points + amount, 10000);
      const newLevel = Math.floor(newPoints / 500) + 1;
      const newAchievements = [...prev.achievements];
      
      if (newPoints >= 500 && !newAchievements.find(a => a.id === 'milestone_500')) {
        newAchievements.push({
          id: 'milestone_500',
          title: 'Primeira Quebra',
          description: 'Atingiu 500 pontos. Você saiu da inércia.',
          icon: '🥉',
          unlockedAt: new Date()
        });
      }
      return { ...prev, points: newPoints, level: newLevel, achievements: newAchievements };
    });
  };

  const updateTimer = (newState: Partial<TimerState>) => {
    setTimer(prev => ({ ...prev, ...newState }));
  };

  // Timer Interval
  useEffect(() => {
    let interval: any = null;
    if (timer.isActive) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev.seconds === 0) {
            if (prev.minutes === 0) {
              clearInterval(interval);
              // PLAY LOUDER ALARM
              const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
              audio.volume = 1.0;
              audio.play().catch(e => console.log("Audio autoplay blocked", e));
              return { ...prev, isActive: false };
            }
            return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
          }
          return { ...prev, seconds: prev.seconds - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer.isActive]);


  // --- Render Helpers ---

  const renderView = () => {
    switch (currentView) {
      case AppView.CHAT:
        return (
          <ChatInterface 
            activeSession={getActiveSession()}
            onUpdateSession={updateSession}
            onAwardPoints={addPoints}
          />
        );
      case AppView.VOICE:
        return <LiveVoice />;
      case AppView.MAPS:
        return (
          <MentalMap 
            history={mentalMaps}
            onSave={saveMentalMap}
          />
        );
      case AppView.TIMER:
        return (
          <ExecutionTimer 
            timer={timer}
            updateTimer={updateTimer}
            onComplete={addPoints}
          />
        );
      case AppView.HISTORY:
        return (
          <ChatHistory 
            sessions={sessions}
            currentSessionId={activeSessionId}
            onSelectSession={(id) => {
              setActiveSessionId(id);
              setCurrentView(AppView.CHAT);
            }}
            onNewChat={createNewSession}
            userPoints={userStats.points}
          />
        );
      default:
        return null;
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: AppView, icon: any, label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all uppercase tracking-wider text-sm font-bold ${
        currentView === view 
          ? 'bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.3)]' 
          : 'text-[#9FB4C7] hover:bg-[#1a1a1a] hover:text-white'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
      {view === AppView.TIMER && timer.isActive && (
        <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}
    </button>
  );

  // --- LOGIN VIEW ---
  if (currentView === AppView.LOGIN) {
    return (
      <div className="flex h-[100dvh] bg-[#0A0A0A] items-center justify-center p-6 text-white overflow-hidden relative">
         {/* Background Eagle */}
         <div className="absolute opacity-5 pointer-events-none scale-150">
            <EagleEmblem points={10000} size="xl" />
         </div>

         <div className="max-w-md w-full bg-[#111] border border-[#333] rounded-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 backdrop-blur-md">
            
            {/* Header */}
            <div className="text-center mb-8">
               <div className="w-16 h-16 bg-[#E50914] rounded-full mx-auto flex items-center justify-center shadow-[0_0_20px_#E50914] mb-4">
                  <Terminal size={32} className="text-white" />
               </div>
               <h1 className="text-2xl font-bold uppercase tracking-widest">Acesso ao Mentor</h1>
               <p className="text-[#9FB4C7] text-sm mt-2">Identidade Verificada. Evolução Contínua.</p>
            </div>

            {/* Auth Toggle */}
            <div className="flex bg-[#050505] rounded-lg p-1 mb-6 border border-[#333]">
              <button 
                onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded transition-all ${authMode === 'LOGIN' ? 'bg-[#333] text-white shadow' : 'text-[#555] hover:text-[#9FB4C7]'}`}
              >
                Login
              </button>
              <button 
                onClick={() => { setAuthMode('REGISTER'); setAuthError(''); }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded transition-all ${authMode === 'REGISTER' ? 'bg-[#E50914] text-white shadow' : 'text-[#555] hover:text-[#9FB4C7]'}`}
              >
                Criar Conta
              </button>
            </div>

            {/* ERROR DISPLAY */}
            {authError && (
              <div className="mb-4 bg-red-900/20 border border-red-900/50 p-3 rounded flex items-center gap-2 animate-in slide-in-from-top-2">
                 <AlertCircle size={16} className="text-[#E50914]" />
                 <p className="text-xs text-[#E50914] font-bold">{authError}</p>
              </div>
            )}

            {/* LOGIN FORM */}
            {authMode === 'LOGIN' && (
              <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <div className="space-y-3">
                    <div>
                      <input 
                        type="email" 
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="Seu E-mail"
                        className="w-full bg-[#050505] border border-[#333] rounded-lg p-4 text-white placeholder-[#555] focus:outline-none focus:border-[#E50914] font-mono text-sm"
                        required
                      />
                    </div>
                    <div>
                      <input 
                        type="password" 
                        value={loginPass}
                        onChange={e => setLoginPass(e.target.value)}
                        placeholder="Sua Senha"
                        className="w-full bg-[#050505] border border-[#333] rounded-lg p-4 text-white placeholder-[#555] focus:outline-none focus:border-[#E50914] font-mono text-sm"
                        required
                      />
                    </div>
                 </div>
                 <button 
                   type="submit"
                   disabled={isLoadingAuth}
                   className="w-full bg-[#333] hover:bg-[#E50914] hover:shadow-[0_0_20px_rgba(229,9,20,0.4)] disabled:opacity-50 text-white font-bold py-4 rounded-lg uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2"
                 >
                   {isLoadingAuth ? <Loader2 className="animate-spin" /> : <><LogIn size={18} /> Acessar Sistema</>}
                 </button>
              </form>
            )}

            {/* REGISTER FORM */}
            {authMode === 'REGISTER' && (
              <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <div className="space-y-3">
                    <div>
                      <input 
                        type="text" 
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        placeholder="Seu Nome / Codinome"
                        className="w-full bg-[#050505] border border-[#333] rounded-lg p-4 text-white placeholder-[#555] focus:outline-none focus:border-[#E50914] font-mono text-sm"
                        required
                      />
                    </div>
                    <div>
                      <input 
                        type="email" 
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="E-mail"
                        className="w-full bg-[#050505] border border-[#333] rounded-lg p-4 text-white placeholder-[#555] focus:outline-none focus:border-[#E50914] font-mono text-sm"
                        required
                      />
                    </div>
                    <div>
                      <input 
                        type="password" 
                        value={regPass}
                        onChange={e => setRegPass(e.target.value)}
                        placeholder="Senha Forte"
                        className="w-full bg-[#050505] border border-[#333] rounded-lg p-4 text-white placeholder-[#555] focus:outline-none focus:border-[#E50914] font-mono text-sm"
                        required
                        minLength={6}
                      />
                    </div>
                 </div>
                 <button 
                   type="submit"
                   disabled={isLoadingAuth}
                   className="w-full bg-[#E50914] hover:bg-red-700 hover:shadow-[0_0_20px_rgba(229,9,20,0.4)] disabled:opacity-50 text-white font-bold py-4 rounded-lg uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2"
                 >
                   {isLoadingAuth ? <Loader2 className="animate-spin" /> : <><UserPlus size={18} /> Criar Identidade</>}
                 </button>
              </form>
            )}

            <div className="mt-8 text-center border-t border-[#333] pt-4">
               <p className="text-[10px] text-[#555] uppercase font-mono flex items-center justify-center gap-2">
                  <Lock size={10} /> Sistema Seguro V2.0
               </p>
            </div>
         </div>
      </div>
    );
  }

  // --- APP VIEW ---
  return (
    <div className="flex h-[100dvh] bg-[#0A0A0A] overflow-hidden font-sans text-white">
      <ProgressionModal 
        isOpen={progressionModalOpen} 
        onClose={() => setProgressionModalOpen(false)} 
        currentPoints={userStats.points} 
      />

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30 w-72 bg-[#050505] border-r border-[#9FB4C7]/20 transform transition-transform duration-300 ease-in-out flex flex-col h-full
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-[#9FB4C7]/20 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-[#E50914] rounded flex items-center justify-center shadow-[0_0_15px_#E50914]">
            <Terminal className="text-white" size={24} />
          </div>
          <div>
             <h1 className="text-white font-bold tracking-tighter uppercase leading-none text-lg">O Mentor</h1>
             <div className="flex flex-col">
                <span className="text-[#FFD700] text-xs font-bold tracking-wide">{user?.name}</span>
                <span className="text-[#555] text-[10px] font-mono tracking-widest uppercase truncate max-w-[150px]">
                  ID: {user?.id?.substring(0, 6)}...
                </span>
             </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden ml-auto text-[#9FB4C7]">
            <X size={24} />
          </button>
        </div>

        {/* User Stats Widget */}
        <div 
          onClick={() => setProgressionModalOpen(true)}
          className="p-4 mx-4 mt-4 bg-[#111] border border-[#9FB4C7]/20 rounded-lg shrink-0 relative overflow-hidden cursor-pointer group hover:border-[#E50914]/50 transition-all active:scale-95"
        >
           <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
              <EagleEmblem points={userStats.points} size="lg" />
           </div>

           <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                  <span className="text-xs text-[#9FB4C7] uppercase font-mono block group-hover:text-[#E50914] transition-colors">Patente</span>
                  <span className="text-white font-bold uppercase tracking-wider text-sm">
                    {userStats.points < 500 ? "Iniciado" : 
                     userStats.points < 2500 ? "Aprendiz" :
                     userStats.points < 5000 ? "Praticante" :
                     userStats.points < 10000 ? "Dominante" : "Lenda"}
                  </span>
              </div>
              <div className="bg-black/40 rounded-full p-1 border border-[#333] group-hover:border-[#E50914] transition-colors">
                 <EagleEmblem points={userStats.points} size="sm" />
              </div>
           </div>

           <div className="flex justify-between items-end mb-2 relative z-10">
              <span className="text-xs text-[#9FB4C7] uppercase font-mono">Nível {userStats.level}</span>
              <div className="flex items-center gap-1 text-[#FFD700]">
                 <Trophy size={14} />
                 <span className="font-bold text-sm">{userStats.points} PTS</span>
              </div>
           </div>
           
           <div className="w-full bg-[#333] h-1.5 rounded-full overflow-hidden relative z-10">
              <div 
                className="bg-[#E50914] h-full transition-all duration-500" 
                style={{ width: `${(userStats.points % 500) / 5}%` }}
              />
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[#333]">
          <div className="text-[10px] font-bold text-[#555] px-4 py-2 uppercase tracking-widest mb-1">Comando Central</div>
          <NavItem view={AppView.CHAT} icon={MessageSquare} label="Direção (Chat)" />
          <NavItem view={AppView.VOICE} icon={Mic} label="Ao Vivo (Voz)" />
          
          <div className="text-[10px] font-bold text-[#555] px-4 py-2 uppercase tracking-widest mb-1 mt-6">Ferramentas</div>
          <NavItem view={AppView.HISTORY} icon={Clock} label="Histórico" />
          <NavItem view={AppView.MAPS} icon={Map} label="Mapas Mentais" />
          <NavItem view={AppView.TIMER} icon={Timer} label="Execução" />
        </nav>

        <div className="p-6 border-t border-[#9FB4C7]/20 shrink-0">
           <button onClick={handleLogout} className="w-full text-center text-[#555] hover:text-white text-xs font-mono uppercase mb-2 flex items-center justify-center gap-2">
              <Lock size={10} /> Encerrar Sessão
           </button>
           <div className="bg-[#0A0A0A] rounded p-3 border border-[#9FB4C7]/10 flex flex-col items-center gap-2">
              <Zap size={16} className="text-[#FFD700]" />
              <p className="text-[#9FB4C7] text-[10px] text-center font-mono uppercase">
                 "A dor passa. A honra fica."
              </p>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden p-4 bg-[#050505] border-b border-[#9FB4C7]/20 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-2">
              <Terminal className="text-[#E50914]" size={20} />
              <span className="text-white font-bold uppercase tracking-wider">O Mentor</span>
           </div>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-1 text-[#FFD700] text-xs font-bold">
                 <Star size={12} fill="#FFD700" /> {userStats.points}
             </div>
             <button onClick={() => setSidebarOpen(true)} className="text-white">
               <Menu size={24} />
             </button>
           </div>
        </div>

        <main className="flex-1 overflow-hidden relative">
           {user?.id ? renderView() : null}
        </main>
      </div>
    </div>
  );
};

export default App;
