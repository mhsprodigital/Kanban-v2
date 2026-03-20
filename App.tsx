
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Patient, 
  PatientStatus, 
  Collaborator,
  PatientPriority,
  MovementType
} from './types';
import { useHospitalData } from './hooks/useHospitalData';
import { getStats, getGlobalStats } from './utils/calculations';
import { db, auth } from './lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';

// Modules
import DashboardView from './components/views/DashboardView';
import KanbanView from './components/views/KanbanView';
import AuditView from './components/views/AuditView';
import SettingsView from './components/views/SettingsView';

// Components
import PatientForm from './components/PatientForm';

// Icons
import { 
  LayoutDashboard, Users, Settings, History as HistoryIcon,
  Search, LogOut, Loader2, X, Bed, History, Edit3, ArrowRight, Clock, ShieldCheck, XCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(() => {
    const saved = localStorage.getItem('hrt_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [inactivityTimer, setInactivityTimer] = useState(600);

  useEffect(() => {
    if (!currentUser) return;

    const resetTimer = () => setInactivityTimer(600);
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    
    events.forEach(e => window.addEventListener(e, resetTimer));

    const interval = setInterval(() => {
      setInactivityTimer(prev => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
    };
  }, [currentUser]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as Collaborator;
            setCurrentUser(userData);
            
            if (userData.status === 'approved') {
              await addDoc(collection(db, 'access_logs'), {
                userId: user.uid,
                name: userData.name,
                email: userData.email,
                category: userData.category,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            // Check if pre-registered by email
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const preRegDoc = querySnapshot.docs[0];
              const preRegData = preRegDoc.data() as Collaborator;
              
              const newUser: Collaborator = {
                ...preRegData,
                uid: user.uid,
                name: user.displayName || preRegData.name || 'Usuário',
              };
              
              await setDoc(userDocRef, newUser);
              await deleteDoc(preRegDoc.ref);
              
              setCurrentUser(newUser);
              
              if (newUser.status === 'approved') {
                await addDoc(collection(db, 'access_logs'), {
                  userId: user.uid,
                  name: newUser.name,
                  email: newUser.email,
                  category: newUser.category,
                  timestamp: new Date().toISOString()
                });
              }
            } else {
              // Create new user
              const isSuperAdmin = user.email === 'mhs.pro.digital@gmail.com';
              const newUser: Collaborator = {
                uid: user.uid,
                email: user.email || '',
                name: user.displayName || 'Usuário',
                category: '',
                role: isSuperAdmin ? 'admin' : 'user',
                status: isSuperAdmin ? 'approved' : 'pending'
              };
              await setDoc(userDocRef, newUser);
              setCurrentUser(newUser);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setAuthError("Erro ao verificar autorização.");
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const { units, patients, movements, users, accessLogs, loading, fetchData, deleteUnitCascade } = useHospitalData(currentUser);

  const [currentUnitId, setCurrentUnitId] = useState<string>(() => localStorage.getItem('hrt_current_unit_id') || 'global');
  const [view, setView] = useState<'dashboard' | 'patients' | 'settings' | 'history'>('dashboard');
  const [activeFilter, setActiveFilter] = useState<PatientPriority | 'BLOCKED' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientDossierId, setSelectedPatientDossierId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | undefined>(undefined);
  const [targetBedForNew, setTargetBedForNew] = useState<string | undefined>(undefined);
  const [bedActionInfo, setBedActionInfo] = useState<{ unitId: string, bed: string, patient?: Patient } | null>(null);
  const [blockReasonModal, setBlockReasonModal] = useState<{ unitId: string, bed: string } | null>(null);
  const [blockReasonText, setBlockReasonText] = useState('');

  const [dashboardDates, setDashboardDates] = useState({
    start: new Date().toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    if (isAuthReady && currentUser?.category) {
      fetchData();
    }
  }, [fetchData, isAuthReady, currentUser]);

  useEffect(() => {
    localStorage.setItem('hrt_current_unit_id', currentUnitId);
  }, [currentUnitId]);

  useEffect(() => {
    if (currentUser && currentUser.category) {
      localStorage.setItem('hrt_auth', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  const stats = useMemo(() => {
    if (currentUnitId === 'global') return getGlobalStats(patients, units, movements, dashboardDates.start, dashboardDates.end);
    const unit = units.find(u => u.id === currentUnitId);
    return unit ? getStats(patients, unit, movements, dashboardDates.start, dashboardDates.end) : getGlobalStats(patients, units, movements, dashboardDates.start, dashboardDates.end);
  }, [patients, units, currentUnitId, movements, dashboardDates]);

  const logMovement = async (patientId: string, patientName: string, type: MovementType, bed: string, fromUnit?: string, toUnit?: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'movements'), {
        patientId,
        patientName,
        type,
        date: new Date().toISOString(),
        bed,
        fromUnit: fromUnit || '',
        toUnit: toUnit || '',
        collaborator: currentUser
      });
    } catch (e) {
      console.error("Erro ao registrar movimentação:", e);
    }
  };

  const handleSavePatient = async (data: Partial<Patient>) => {
    if (!data.name || !data.sesId) return toast.error("Nome e SES são obrigatórios.");
    
    const dbPayload = {
      unitId: data.unitId,
      bed: data.bed,
      sesId: data.sesId,
      name: data.name.toUpperCase(),
      gender: data.gender,
      age: data.age,
      entryDateHospital: new Date(data.entryDateHospital!).toISOString(),
      admissionDate: new Date(data.admissionDate!).toISOString(),
      dischargeDate: data.dischargeDate ? new Date(data.dischargeDate).toISOString() : null,
      origin: data.origin?.toUpperCase() || '',
      externalDestination: data.externalDestination?.toUpperCase() || '',
      status: data.status,
      diagnosis: data.diagnosis?.toUpperCase() || '',
      etiologicalAgent: data.etiologicalAgent?.toUpperCase() || '',
      isolationType: data.isolationType,
      isExtra: data.isExtra || false,
      blockReason: data.blockReason || '',
      pendingTasks: data.pendingTasks || []
    };

    try {
      if (editingPatient) {
        await updateDoc(doc(db, 'patients', editingPatient.id), dbPayload);
        
        // Determinar tipo de movimentação
        let mType: MovementType | null = null;
        const oldUnit = units.find(u => u.id === editingPatient.unitId)?.name;
        const newUnit = units.find(u => u.id === data.unitId)?.name;

        if (data.status === PatientStatus.DISCHARGED && editingPatient.status !== PatientStatus.DISCHARGED) mType = MovementType.DISCHARGE;
        else if (data.status === PatientStatus.DECEASED && editingPatient.status !== PatientStatus.DECEASED) mType = MovementType.DECEASED;
        else if (data.status === PatientStatus.EVASION && editingPatient.status !== PatientStatus.EVASION) mType = MovementType.EVASION;
        else if (data.status === PatientStatus.TRANSFERRED && editingPatient.status !== PatientStatus.TRANSFERRED) mType = MovementType.EXTERNAL_TRANSFER;
        else if (editingPatient.unitId !== data.unitId) mType = MovementType.TRANSFER;

        if (mType) {
          await logMovement(editingPatient.id, dbPayload.name, mType, dbPayload.bed!, oldUnit, newUnit);
        }
      } else {
        const docRef = await addDoc(collection(db, 'patients'), dbPayload);
        const unitName = units.find(u => u.id === data.unitId)?.name;
        await logMovement(docRef.id, dbPayload.name, MovementType.ADMISSION, dbPayload.bed!, undefined, unitName);
      }
      setIsFormOpen(false);
      setEditingPatient(undefined);
    } catch (e) { 
      console.error(e);
      toast.error("Erro ao salvar."); 
    }
  };

  const toggleBedBlock = async (uId: string, bed: string) => {
    const existing = patients.find(p => p.unitId === uId && p.bed === bed);
    const unitName = units.find(u => u.id === uId)?.name;

    try {
      if (existing?.status === PatientStatus.BLOCKED) {
        await deleteDoc(doc(db, 'patients', existing.id));
        await logMovement(existing.id, 'LEITO BLOQUEADO', MovementType.UNBLOCKAGE, bed, unitName);
      } else {
        setBlockReasonModal({ unitId: uId, bed });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao bloquear/desbloquear leito.");
    }
  };

  const confirmBlockBed = async () => {
    if (!blockReasonModal || !blockReasonText.trim()) {
      toast.error("O motivo do bloqueio é obrigatório.");
      return;
    }
    
    const { unitId, bed } = blockReasonModal;
    const unitName = units.find(u => u.id === unitId)?.name;

    try {
      const docRef = await addDoc(collection(db, 'patients'), {
        unitId, bed, name: 'LEITO BLOQUEADO', sesId: '---', status: PatientStatus.BLOCKED, diagnosis: blockReasonText.toUpperCase()
      });
      await logMovement(docRef.id, 'LEITO BLOQUEADO', MovementType.BLOCKAGE, bed, unitName);
      setBlockReasonModal(null);
      setBlockReasonText('');
      toast.success("Leito bloqueado com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao bloquear leito.");
    }
  };

  const handleAddUser = async (userData: Partial<Collaborator>) => {
    try {
      const newDocRef = doc(collection(db, 'users'));
      await setDoc(newDocRef, { ...userData, uid: newDocRef.id });
      toast.success("Usuário adicionado com sucesso.");
    } catch (error) {
      console.error("Erro ao adicionar usuário:", error);
      toast.error("Erro ao adicionar usuário.");
    }
  };

  const handleUpdateUser = async (userData: Collaborator) => {
    try {
      if (userData.uid) {
        await updateDoc(doc(db, 'users', userData.uid), { ...userData });
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      toast.error("Erro ao atualizar usuário.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      toast.error("Erro ao excluir usuário.");
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro no login:", error);
      toast.error("Erro ao fazer login com o Google.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('hrt_auth');
    setCurrentUser(null);
  };

  if (!isAuthReady) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  if (!currentUser || !currentUser.category || currentUser.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-[3rem] p-12 w-full max-w-md shadow-2xl">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-4xl font-black mb-6">H</div>
            <h1 className="text-3xl font-black text-slate-900 uppercase">Kanban HRT</h1>
            <p className="text-sm text-slate-500 mt-2">Gestão de Leitos e Fluxo</p>
          </div>
          
          {!auth.currentUser ? (
            <button onClick={handleLogin} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] uppercase flex items-center justify-center gap-3 hover:bg-indigo-700 transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Entrar com Google
            </button>
          ) : currentUser?.status === 'pending' ? (
            <div className="text-center space-y-6">
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="font-bold text-amber-800 mb-2">Acesso Pendente</p>
                <p className="text-xs text-amber-700">Seu cadastro foi recebido e está aguardando aprovação de um administrador.</p>
              </div>
              <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase">Sair</button>
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const category = formData.get('category') as string;
              
              if (auth.currentUser) {
                await updateDoc(doc(db, 'users', auth.currentUser.uid), { category });
                const updatedUser = { ...currentUser, category };
                setCurrentUser(updatedUser);
                
                // Log access after setting category
                await addDoc(collection(db, 'access_logs'), {
                  userId: auth.currentUser.uid,
                  name: updatedUser.name,
                  email: updatedUser.email,
                  category: updatedUser.category,
                  timestamp: new Date().toISOString()
                });
              }
            }} className="space-y-6">
              <div className="text-center mb-4">
                <p className="font-bold text-slate-700">Olá, {currentUser?.name}</p>
                <p className="text-xs text-slate-500">Por favor, selecione sua categoria para continuar.</p>
              </div>
              <select required name="category" className="w-full bg-slate-50 border-2 p-4 rounded-2xl font-bold outline-none focus:border-indigo-500">
                <option value="" disabled selected>Selecione sua categoria...</option>
                <option value="Médico">Médico(a)</option>
                <option value="Enfermeiro">Enfermeiro(a)</option>
                <option value="Gestor">Gestor(a)</option>
              </select>
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] uppercase hover:bg-indigo-700 transition-colors">Acessar Sistema</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <Toaster position="top-right" />
      <nav className="bg-white border-b sticky top-0 z-40 px-6 lg:px-12 h-24 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-3xl">H</div>
          <h1 className="text-2xl font-black text-slate-900 leading-none hidden md:block">Kanban HRT</h1>
        </div>
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-[1.5rem] border">
          <NavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Indicadores" />
          <NavBtn active={view === 'patients'} onClick={() => setView('patients')} icon={<Users size={20}/>} label="Quadro" />
          <NavBtn active={view === 'history'} onClick={() => setView('history')} icon={<HistoryIcon size={20}/>} label="Auditoria" />
          {currentUser?.role === 'admin' && (
            <NavBtn active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings size={20}/>} label="Ajustes" />
          )}
        </div>
        <div className="flex items-center gap-4">
           {loading && <Loader2 className="animate-spin text-indigo-600" size={20} />}
           {currentUser && (
             <div className="hidden lg:flex items-center space-x-2 text-slate-500 text-xs font-bold bg-slate-50 px-3 py-2 rounded-xl">
               <Clock size={14} />
               <span>Sessão expira em: {formatTime(inactivityTimer)}</span>
             </div>
           )}
           <div className="hidden md:block text-right mr-2">
             <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
             <p className="text-[10px] font-black text-indigo-600 uppercase">{currentUser.category}</p>
           </div>
           <button onClick={handleLogout} className="p-3 bg-white border rounded-2xl text-slate-400 hover:text-red-500 transition-all"><LogOut size={20}/></button>
        </div>
      </nav>

      {view !== 'settings' && (
        <div className="bg-slate-900 text-white py-4 px-6 lg:px-12 sticky top-24 z-30 shadow-2xl flex justify-between gap-6 items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => { setCurrentUnitId('global'); setActiveFilter(null); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentUnitId === 'global' ? 'bg-indigo-600 shadow-md' : 'text-slate-400 hover:text-white'}`}>Hospital Geral</button>
            <select value={currentUnitId === 'global' ? '' : currentUnitId} onChange={(e) => setCurrentUnitId(e.target.value || 'global')} className="bg-slate-800 rounded-xl py-2 px-4 text-[11px] font-black uppercase outline-none">
              <option value="" disabled>Selecionar Setor...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input type="text" placeholder="Pesquisar Nome ou SES..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-800 border-none rounded-xl py-2 pl-10 pr-4 text-xs font-bold w-full outline-none" />
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 lg:p-12">
        {view === 'dashboard' && <DashboardView stats={stats} dates={dashboardDates} onDateChange={(t,v) => setDashboardDates(p => ({...p, [t]: v}))} />}
        
        {view === 'patients' && (
          <KanbanView 
            patients={patients} units={units} currentUnitId={currentUnitId} stats={stats} 
            searchTerm={searchTerm} activeFilter={activeFilter} setActiveFilter={setActiveFilter}
            onAdmissao={() => setIsFormOpen(true)} onEdit={setEditingPatient} 
            onNewAtBed={b => { setTargetBedForNew(b); setIsFormOpen(true); }} 
            onHistoryClick={setSelectedPatientDossierId} onActionClick={setBedActionInfo} currentUser={currentUser}
          />
        )}

        {view === 'history' && <AuditView movements={movements} onHistoryClick={setSelectedPatientDossierId} />}

        {view === 'settings' && currentUser?.role === 'admin' && (
          <SettingsView 
            units={units} patients={patients} users={users} accessLogs={accessLogs}
            onAddUnit={async u => {
              try {
                const docRef = await addDoc(collection(db, 'units'), { name: u.name, capacity: u.capacity, bedNames: u.bedNames || [] });
                toast.success("Unidade adicionada com sucesso.");
              } catch (e) { console.error(e); toast.error("Erro ao adicionar unidade."); }
            }}
            onUpdateUnit={async u => {
              try {
                await updateDoc(doc(db, 'units', u.id), { name: u.name, capacity: u.capacity, bedNames: u.bedNames || [] });
                toast.success("Unidade atualizada com sucesso.");
              } catch (e) { console.error(e); toast.error("Erro ao atualizar unidade."); }
            }}
            onDeleteUnit={deleteUnitCascade} onToggleBlock={toggleBedBlock} onActionClick={setBedActionInfo}
            onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser}
          />
        )}
      </main>

      {/* Popups e Modais Shared */}
      {(isFormOpen || editingPatient) && (
        <PatientForm onClose={() => {setIsFormOpen(false); setEditingPatient(undefined); setTargetBedForNew(undefined);}} onSave={handleSavePatient} initialData={editingPatient} predefinedBed={targetBedForNew} predefinedUnit={currentUnitId !== 'global' ? currentUnitId : undefined} units={units} patients={patients} />
      )}

      {selectedPatientDossierId && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[300] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
             <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                <h3 className="text-2xl font-black text-slate-900 uppercase">Dossiê</h3>
                <button onClick={() => setSelectedPatientDossierId(null)} className="p-3 bg-white rounded-full text-slate-400 border shadow-sm"><X size={24} /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-10 space-y-6">
                {movements.filter(m => m.patientId === selectedPatientDossierId).map(m => (
                  <div key={m.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                     <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black uppercase">{m.type}</span>
                     <p className="mt-2 text-[10px] font-black text-slate-400">{new Date(m.date).toLocaleString('pt-BR')}</p>
                     <p className="text-xs font-bold text-slate-700 uppercase mt-1">{m.fromUnit || 'Início'} ➔ {m.toUnit || 'Saída'} (L-{m.bed})</p>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {bedActionInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl">
             <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${bedActionInfo.patient?.status === PatientStatus.BLOCKED ? 'bg-red-100 text-red-600' : bedActionInfo.patient ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {bedActionInfo.patient?.status === PatientStatus.BLOCKED ? <XCircle size={32} /> : bedActionInfo.patient ? <Bed size={32} /> : <ShieldCheck size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Leito {units.find(u => u.id === bedActionInfo.unitId)?.bedNames?.[parseInt(bedActionInfo.bed)-1] || bedActionInfo.bed}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                  {bedActionInfo.patient?.status === PatientStatus.BLOCKED ? 'Bloqueado' : bedActionInfo.patient ? bedActionInfo.patient.name : 'Livre'}
                </p>
             </div>
             <div className="space-y-4">
                {bedActionInfo.patient && bedActionInfo.patient.status !== PatientStatus.BLOCKED && (
                  <>
                    <button onClick={() => { setSelectedPatientDossierId(bedActionInfo.patient!.id); setBedActionInfo(null); }} className="w-full flex items-center justify-between p-5 bg-slate-50 border rounded-2xl hover:bg-indigo-50"><div className="flex items-center gap-3"><History size={20} /><span className="text-xs font-black uppercase">Dossiê</span></div><ArrowRight size={16} /></button>
                    <button onClick={() => { setEditingPatient(bedActionInfo.patient); setBedActionInfo(null); setIsFormOpen(true); }} className="w-full flex items-center justify-between p-5 bg-slate-50 border rounded-2xl hover:bg-emerald-50"><div className="flex items-center gap-3"><Edit3 size={20} /><span className="text-xs font-black uppercase">Editar</span></div><ArrowRight size={16} /></button>
                  </>
                )}
                
                {bedActionInfo.patient?.status === PatientStatus.BLOCKED ? (
                  <button onClick={() => { toggleBedBlock(bedActionInfo.unitId, bedActionInfo.bed); setBedActionInfo(null); }} className="w-full flex items-center justify-between p-5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl hover:bg-emerald-100"><div className="flex items-center gap-3"><ShieldCheck size={20} /><span className="text-xs font-black uppercase">Desbloquear Leito</span></div><ArrowRight size={16} /></button>
                ) : !bedActionInfo.patient ? (
                  <button onClick={() => { toggleBedBlock(bedActionInfo.unitId, bedActionInfo.bed); setBedActionInfo(null); }} className="w-full flex items-center justify-between p-5 bg-red-50 border border-red-200 text-red-700 rounded-2xl hover:bg-red-100"><div className="flex items-center gap-3"><XCircle size={20} /><span className="text-xs font-black uppercase">Bloquear Leito</span></div><ArrowRight size={16} /></button>
                ) : null}
                
                <button onClick={() => setBedActionInfo(null)} className="w-full py-4 text-[10px] font-black uppercase text-slate-400">Cancelar</button>
             </div>
          </div>
        </div>
      )}

      {blockReasonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 uppercase mb-6">Bloquear Leito</h3>
            <p className="text-sm text-slate-500 mb-6">Por favor, informe o motivo do bloqueio deste leito.</p>
            <textarea 
              value={blockReasonText}
              onChange={(e) => setBlockReasonText(e.target.value)}
              placeholder="Motivo do bloqueio..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 mb-6 min-h-[120px]"
            />
            <div className="flex gap-4">
              <button onClick={() => { setBlockReasonModal(null); setBlockReasonText(''); }} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={confirmBlockBed} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl uppercase text-xs hover:bg-red-700 transition-colors">Confirmar Bloqueio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center px-6 py-4 rounded-2xl text-xs font-black uppercase transition-all ${active ? 'bg-white text-indigo-700 shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>{icon} <span className="hidden lg:inline ml-3">{label}</span></button>
);

export default App;
