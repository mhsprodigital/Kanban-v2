
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Patient, 
  PatientStatus, 
  Collaborator,
  PatientPriority,
  MovementType,
  Gender,
  IsolationType,
  DischargePrediction,
  PendingTask,
  UserInvitation
} from './types';
import { useHospitalData } from './hooks/useHospitalData';
import { getStats, getGlobalStats } from './utils/calculations';
import { db, auth } from './lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';

// Modules
import DashboardView from './components/views/DashboardView';
import KanbanView from './components/views/KanbanView';
import AuditView from './components/views/AuditView';
import SettingsView from './components/views/SettingsView';

// Components
import PatientForm from './components/PatientForm';
import LoginScreen from './components/LoginScreen';

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
          const userEmail = (user.email || '').toLowerCase().trim();
          const isMasterAdmin = userEmail === 'mhs.pro.digital@gmail.com' || 
                                userEmail === 'matheus.sousa@hrt.local' ||
                                userEmail.startsWith('matheus.sousa');

          // Find user by UID in users collection
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as Collaborator;
            // Ensure master admin has full admin privileges
            if (isMasterAdmin && (userData.role !== 'admin' || userData.category !== 'Administrador')) {
              userData.role = 'admin';
              userData.category = 'Administrador';
              await updateDoc(doc(db, 'users', user.uid), { role: 'admin', category: 'Administrador' });
            }
            setCurrentUser(userData);
            
            // Log access
            await addDoc(collection(db, 'access_logs'), {
              userId: user.uid,
              name: userData.name,
              email: user.email || '',
              category: userData.category || 'N/A',
              timestamp: new Date().toISOString()
            });
          } else {
            // Master admin first login (e.g. via Google or new auth)
            if (isMasterAdmin) {
              const masterProfile: Collaborator = {
                uid: user.uid,
                username: 'matheus.sousa',
                name: user.displayName || 'Matheus Sousa',
                email: user.email || 'mhs.pro.digital@gmail.com',
                role: 'admin',
                status: 'active',
                category: 'Administrador'
              };

              await setDoc(doc(db, 'users', user.uid), masterProfile, { merge: true });
              await setDoc(doc(db, 'invitations', 'matheus.sousa'), {
                id: 'matheus.sousa',
                username: 'matheus.sousa',
                name: masterProfile.name,
                authEmail: user.email || 'matheus.sousa@hrt.local',
                role: 'admin',
                status: 'active',
                authVersion: 1,
                resetRequested: false,
                uid: user.uid,
                createdAt: new Date().toISOString(),
                createdBy: 'system'
              }, { merge: true });

              setCurrentUser(masterProfile);

              await addDoc(collection(db, 'access_logs'), {
                userId: user.uid,
                name: masterProfile.name,
                email: user.email || '',
                category: masterProfile.category,
                timestamp: new Date().toISOString()
              });
              setIsAuthReady(true);
              return;
            }

            // Look up invitation by authEmail
            const q = query(collection(db, 'invitations'), where('authEmail', '==', user.email));
            const invSnapshot = await getDocs(q);
            
            if (!invSnapshot.empty) {
              const invData = invSnapshot.docs[0].data();
              
              const newUserProfile = {
                uid: user.uid,
                username: invData.username,
                name: invData.name,
                role: invData.role,
                status: 'active',
                category: invData.cargo || (invData.role === 'admin' ? 'Administrador' : 'Usuário'),
                email: user.email || ''
              };
              
              await setDoc(doc(db, 'users', user.uid), newUserProfile, { merge: true });
              setCurrentUser(newUserProfile as Collaborator);
              
              await addDoc(collection(db, 'access_logs'), {
                userId: user.uid,
                name: newUserProfile.name,
                email: user.email || '',
                category: newUserProfile.category || 'N/A',
                timestamp: new Date().toISOString()
              });
            } else {
              console.error("No invitation found for this user:", user.email);
              await signOut(auth);
              setCurrentUser(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setAuthError("Erro ao verificar autorização.");
          await signOut(auth);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const { units, patients, movements, users, invitations, accessLogs, loading, fetchData, deleteUnitCascade } = useHospitalData(currentUser);

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin' || 
                  currentUser?.email === 'mhs.pro.digital@gmail.com' || 
                  currentUser?.email === 'matheus.sousa@hrt.local' ||
                  currentUser?.username?.toLowerCase() === 'matheus.sousa' ||
                  currentUser?.category?.toLowerCase() === 'administrador' ||
                  currentUser?.category?.toLowerCase() === 'admin';

  const [currentUnitId, setCurrentUnitId] = useState<string>(() => localStorage.getItem('hrt_current_unit_id') || 'global');
  const [view, setView] = useState<'dashboard' | 'patients' | 'settings' | 'history'>('patients');
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
    if (isAuthReady && currentUser && currentUser.status === 'active') {
      const cleanup = fetchData();
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, [fetchData, isAuthReady, currentUser]);

  useEffect(() => {
    localStorage.setItem('hrt_current_unit_id', currentUnitId);
  }, [currentUnitId]);

  useEffect(() => {
    if (currentUser && currentUser.status === 'active') {
      localStorage.setItem('hrt_auth', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  const stats = useMemo(() => {
    if (currentUnitId === 'global') return getGlobalStats(patients, units, movements, dashboardDates.start, dashboardDates.end);
    const unit = units.find(u => u.id === currentUnitId);
    return unit ? getStats(patients, unit, movements, dashboardDates.start, dashboardDates.end) : getGlobalStats(patients, units, movements, dashboardDates.start, dashboardDates.end);
  }, [patients, units, currentUnitId, movements, dashboardDates]);

  // Utilitário para limpar qualquer valor undefined antes de persistir no Firestore
  const cleanFirestoreData = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) {
      return obj
        .map(item => cleanFirestoreData(item))
        .filter(item => item !== undefined);
    }
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        const cleaned = cleanFirestoreData(v);
        if (cleaned !== undefined) {
          res[k] = cleaned;
        }
      }
    }
    return res;
  };

  const logMovement = async (patientId: string, patientName: string, type: MovementType, bed: string, fromUnit?: string, toUnit?: string, details?: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'movements'), cleanFirestoreData({
        patientId: patientId || '',
        patientName: patientName || '',
        type,
        date: new Date().toISOString(),
        bed: bed || '',
        fromUnit: fromUnit || '',
        toUnit: toUnit || '',
        collaborator: currentUser,
        details: details || ''
      }));
    } catch (e) {
      console.error("Erro ao registrar movimentação:", e);
    }
  };

  const handleDeletePatient = async (id: string) => {
    try {
      const patient = patients.find(p => p.id === id);
      if (patient) {
        const unitName = units.find(u => u.id === patient.unitId)?.name;
        await logMovement(id, patient.name, MovementType.DELETION, patient.bed, unitName);
      }
      await deleteDoc(doc(db, 'patients', id));
      toast.success("Registro excluído com sucesso.");
      setIsFormOpen(false);
      setEditingPatient(undefined);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir registro.");
    }
  };

  const handleSavePatient = async (data: Partial<Patient>) => {
    // Validação estrita apenas dos campos obrigatórios do sistema: nome, ses, admissão, unidade, leito e status
    if (!data.name || !data.name.trim()) return toast.error("O Nome do paciente é obrigatório.");
    if (!data.sesId || !data.sesId.trim()) return toast.error("O SES (Prontuário) é obrigatório.");
    if (!data.admissionDate) return toast.error("A Data de Admissão é obrigatória.");
    if (!data.unitId) return toast.error("A Unidade / Setor é obrigatória.");
    if (!data.bed) return toast.error("O Leito é obrigatório.");
    if (!data.status) return toast.error("O Status do paciente é obrigatório.");
    
    const sanitizeValue = (val: any, fallback: any = '') => (val === undefined || val === null ? fallback : val);

    const cleanedTasks = (data.pendingTasks || []).map(t => {
      const taskObj: any = {
        id: t.id || Math.random().toString(36).substring(2, 9),
        description: t.description || '',
        createdAt: t.createdAt || new Date().toISOString()
      };
      if (t.expiresAt) {
        taskObj.expiresAt = t.expiresAt;
      }
      return taskObj;
    });

    const cleanedPredictions = (data.dischargePredictions || []).map(dp => {
      const predObj: any = {
        id: dp.id || String(Date.now()),
        predictedDate: dp.predictedDate || '',
        reason: dp.reason || '',
        createdAt: dp.createdAt || new Date().toISOString()
      };
      if (dp.previousDate) {
        predObj.previousDate = dp.previousDate;
      }
      return predObj;
    });

    const admissionDateISO = data.admissionDate ? new Date(data.admissionDate).toISOString() : new Date().toISOString();
    const entryDateHospitalISO = data.entryDateHospital ? new Date(data.entryDateHospital).toISOString() : admissionDateISO;

    const dbPayload = cleanFirestoreData({
      unitId: sanitizeValue(data.unitId, ''),
      bed: sanitizeValue(data.bed, ''),
      sesId: sanitizeValue(data.sesId, '').trim(),
      name: sanitizeValue(data.name, '').trim().toUpperCase(),
      gender: sanitizeValue(data.gender, Gender.M),
      age: typeof data.age === 'number' && !isNaN(data.age) ? data.age : (parseInt(String(data.age || 0), 10) || 0),
      entryDateHospital: entryDateHospitalISO,
      admissionDate: admissionDateISO,
      dischargeDate: data.dischargeDate ? new Date(data.dischargeDate).toISOString() : null,
      origin: sanitizeValue(data.origin, '').trim().toUpperCase(),
      externalDestination: sanitizeValue(data.externalDestination, '').trim().toUpperCase(),
      status: sanitizeValue(data.status, PatientStatus.ADMITTED),
      diagnosis: sanitizeValue(data.diagnosis, '').trim().toUpperCase(),
      etiologicalAgent: sanitizeValue(data.etiologicalAgent, '').trim().toUpperCase(),
      isolationType: sanitizeValue(data.isolationType, IsolationType.NONE),
      isExtra: Boolean(data.isExtra),
      blockReason: sanitizeValue(data.blockReason, ''),
      pendingTasks: cleanedTasks,
      predictedDischargeDate: data.predictedDischargeDate ? String(data.predictedDischargeDate) : null,
      dischargePredictions: cleanedPredictions
    });

    try {
      if (editingPatient) {
        await updateDoc(doc(db, 'patients', editingPatient.id), dbPayload);
        
        // Determinar tipo de movimentação clínica
        let mType: MovementType | null = null;
        const oldUnit = units.find(u => u.id === editingPatient.unitId)?.name;
        const newUnit = units.find(u => u.id === data.unitId)?.name;

        if (data.status === PatientStatus.DISCHARGED && editingPatient.status !== PatientStatus.DISCHARGED) mType = MovementType.DISCHARGE;
        else if (data.status === PatientStatus.DECEASED && editingPatient.status !== PatientStatus.DECEASED) mType = MovementType.DECEASED;
        else if (data.status === PatientStatus.EVASION && editingPatient.status !== PatientStatus.EVASION) mType = MovementType.EVASION;
        else if (data.status === PatientStatus.DELETED && editingPatient.status !== PatientStatus.DELETED) mType = MovementType.DELETION;
        else if (data.status === PatientStatus.TRANSFERRED && editingPatient.status !== PatientStatus.TRANSFERRED) mType = MovementType.EXTERNAL_TRANSFER;
        else if (editingPatient.unitId !== data.unitId) mType = MovementType.TRANSFER;

        if (mType) {
          await logMovement(editingPatient.id, dbPayload.name, mType, dbPayload.bed!, oldUnit, newUnit);
        }

        // Auditoria de Previsibilidade de Alta / Reprogramação do PTS
        const oldPredictions = editingPatient.dischargePredictions || [];
        const newPredictions = data.dischargePredictions || [];
        const hasNewPrediction = newPredictions.length > oldPredictions.length;
        const dateChanged = data.predictedDischargeDate !== editingPatient.predictedDischargeDate && data.predictedDischargeDate;

        if (hasNewPrediction || dateChanged) {
          const latest = newPredictions[newPredictions.length - 1];
          const isRecalc = newPredictions.length > 1;
          const targetDateStr = latest?.predictedDate || data.predictedDischargeDate || '';
          const targetDateBR = targetDateStr ? new Date(targetDateStr + 'T00:00:00').toLocaleDateString('pt-BR') : '';
          const prevDateBR = latest?.previousDate ? new Date(latest.previousDate + 'T00:00:00').toLocaleDateString('pt-BR') : '';
          
          let detailsText = '';
          if (isRecalc) {
            detailsText = `PTS Recalculado (${newPredictions.length}ª revisão): Nova meta de alta para ${targetDateBR}${prevDateBR ? ` (Previsão anterior: ${prevDateBR})` : ''}. Motivo: ${latest?.reason || 'Revisão clínica do Projeto Terapêutico Singular'}`;
          } else {
            detailsText = `Previsibilidade de Alta definida para ${targetDateBR}. Motivo: ${latest?.reason || 'Meta inicial do Projeto Terapêutico Singular (PTS)'}`;
          }

          await logMovement(
            editingPatient.id,
            dbPayload.name,
            MovementType.PTS_PREDICTION,
            dbPayload.bed!,
            newUnit || oldUnit,
            undefined,
            detailsText
          );
        }
      } else {
        const docRef = await addDoc(collection(db, 'patients'), dbPayload);
        const unitName = units.find(u => u.id === data.unitId)?.name;
        await logMovement(docRef.id, dbPayload.name, MovementType.ADMISSION, dbPayload.bed!, undefined, unitName);

        // Se já tiver previsão de alta na admissão, auditar
        if (data.predictedDischargeDate) {
          const newPredictions = data.dischargePredictions || [];
          const latest = newPredictions[newPredictions.length - 1];
          const targetDateBR = new Date(data.predictedDischargeDate + 'T00:00:00').toLocaleDateString('pt-BR');
          const detailsText = `Previsibilidade de Alta inicial fixada na admissão para ${targetDateBR}. Motivo: ${latest?.reason || 'Meta inicial do PTS'}`;
          await logMovement(
            docRef.id,
            dbPayload.name,
            MovementType.PTS_PREDICTION,
            dbPayload.bed!,
            undefined,
            unitName,
            detailsText
          );
        }
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

  const handleAddInvitation = async (invitationData: Partial<UserInvitation>) => {
    try {
      // Check if username already exists in users or invitations
      const qUsers = query(collection(db, 'users'), where('username', '==', invitationData.username));
      const uSnap = await getDocs(qUsers);
      if (!uSnap.empty) {
        toast.error("Este nome de usuário já está em uso.");
        return;
      }

      const qInv = query(collection(db, 'invitations'), where('username', '==', invitationData.username));
      const iSnap = await getDocs(qInv);
      if (!iSnap.empty) {
        toast.error("Já existe um convite para este nome de usuário.");
        return;
      }

      const usernameId = invitationData.username!.toLowerCase().trim();
      const newDocRef = doc(db, 'invitations', usernameId);
      await setDoc(newDocRef, { 
        id: usernameId,
        username: usernameId,
        name: invitationData.name || usernameId,
        authEmail: invitationData.authEmail || `${usernameId}@hrt.local`,
        role: invitationData.role || 'user',
        status: 'pending',
        authVersion: 1,
        resetRequested: false,
        setor: invitationData.setor || '',
        cargo: invitationData.cargo || '',
        uid: null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid || 'admin'
      });
      toast.success("Convite criado com sucesso. O usuário já pode fazer o primeiro acesso.");
    } catch (error) {
      console.error("Erro ao criar convite:", error);
      toast.error("Erro ao criar convite.");
    }
  };

  const handleUpdateInvitation = async (invitationData: UserInvitation) => {
    try {
      if (invitationData.id) {
        const updatePayload: Record<string, any> = {
          name: invitationData.name || '',
          username: invitationData.username || '',
          role: invitationData.role || 'user',
          status: invitationData.status || 'pending',
          setor: invitationData.setor || '',
          cargo: invitationData.cargo || '',
          authEmail: invitationData.authEmail || `${invitationData.username}@hrt.local`
        };

        if (invitationData.resetRequested !== undefined) {
          updatePayload.resetRequested = invitationData.resetRequested;
        }
        if (invitationData.authVersion !== undefined) {
          updatePayload.authVersion = invitationData.authVersion;
        }

        await updateDoc(doc(db, 'invitations', invitationData.id), updatePayload);

        if (invitationData.uid) {
          await setDoc(doc(db, 'users', invitationData.uid), {
            uid: invitationData.uid,
            name: invitationData.name || '',
            username: invitationData.username || '',
            role: invitationData.role || 'user',
            status: invitationData.status || 'pending',
            category: invitationData.cargo || (invitationData.role === 'admin' ? 'Administrador' : 'Usuário'),
            setor: invitationData.setor || '',
            cargo: invitationData.cargo || ''
          }, { merge: true });
        }
        toast.success("Usuário atualizado com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      toast.error("Erro ao atualizar usuário.");
    }
  };

  const handleDeleteInvitation = async (id: string) => {
    try {
      const inv = invitations.find(i => i.id === id);
      if (inv?.uid) {
        await deleteDoc(doc(db, 'users', inv.uid));
      }
      await deleteDoc(doc(db, 'invitations', id));
      toast.success("Usuário excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      toast.error("Erro ao excluir usuário.");
    }
  };


  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('hrt_auth');
      setCurrentUser(null);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  if (!currentUser || currentUser.status !== 'active') {
    return <LoginScreen onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <Toaster position="top-right" />
      <nav className="bg-white border-b sticky top-0 z-40 px-6 lg:px-12 h-24 flex justify-between items-center shadow-sm print:hidden">
        <div className="flex items-center space-x-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-3xl">H</div>
          <h1 className="text-2xl font-black text-slate-900 leading-none hidden md:block">Kanban HRT</h1>
        </div>
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-[1.5rem] border">
          <NavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Indicadores" />
          <NavBtn active={view === 'patients'} onClick={() => setView('patients')} icon={<Users size={20}/>} label="Quadro" />
          <NavBtn active={view === 'history'} onClick={() => setView('history')} icon={<HistoryIcon size={20}/>} label="Auditoria" />
          {isAdmin && (
            <div className="relative">
              <NavBtn active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings size={20}/>} label="Ajustes" />
              {invitations.some(inv => inv.resetRequested) && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
           {loading && <Loader2 className="animate-spin text-indigo-600" size={20} />}
           <div className="hidden md:block text-right mr-2">
             <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
             <p className="text-[10px] font-black text-indigo-600 uppercase">{currentUser.category}</p>
           </div>
           <button onClick={handleLogout} className="p-3 bg-white border rounded-2xl text-slate-400 hover:text-red-500 transition-all"><LogOut size={20}/></button>
        </div>
      </nav>

      {view !== 'settings' && (
        <div className="bg-slate-900 text-white py-4 px-6 lg:px-12 sticky top-24 z-30 shadow-2xl flex justify-between gap-6 items-center print:hidden">
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
        {view === 'dashboard' && (
          <DashboardView 
            stats={stats} 
            dates={dashboardDates} 
            onDateChange={(t,v) => setDashboardDates(p => ({...p, [t]: v}))} 
            patients={patients}
            units={units}
            movements={movements}
            currentUnitId={currentUnitId}
            onEditPatient={(p) => {
              setEditingPatient(p);
              setIsFormOpen(true);
            }}
            onOpenDossier={(pId) => setSelectedPatientDossierId(pId)}
          />
        )}
        
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

        {view === 'settings' && isAdmin && (
          <SettingsView 
            units={units} patients={patients} users={users} invitations={invitations} accessLogs={accessLogs}
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
            onAddInvitation={handleAddInvitation} onUpdateInvitation={handleUpdateInvitation} onDeleteInvitation={handleDeleteInvitation}
          />
        )}
      </main>

      {/* Popups e Modais Shared */}
      {(isFormOpen || editingPatient) && (
        <PatientForm onClose={() => {setIsFormOpen(false); setEditingPatient(undefined); setTargetBedForNew(undefined);}} onSave={handleSavePatient} onDelete={handleDeletePatient} initialData={editingPatient} predefinedBed={targetBedForNew} predefinedUnit={currentUnitId !== 'global' ? currentUnitId : undefined} units={units} patients={patients} />
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
                  <div key={m.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                     <div className="flex items-center justify-between">
                       <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${m.type === MovementType.PTS_PREDICTION ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-indigo-100 text-indigo-700'}`}>
                         {m.type}
                       </span>
                       <span className="text-[10px] font-black text-slate-400">{new Date(m.date).toLocaleString('pt-BR')}</span>
                     </div>
                     <p className="text-xs font-bold text-slate-700 uppercase">
                       {m.fromUnit || 'Início'} ➔ {m.toUnit || 'Saída'} (L-{m.bed})
                     </p>
                     {m.details && (
                       <p className="text-xs font-bold text-indigo-900 bg-indigo-50/80 p-3 rounded-xl border border-indigo-100 leading-relaxed">
                         {m.details}
                       </p>
                     )}
                     <p className="text-[9px] font-bold text-slate-400 uppercase">
                       Responsável: {m.collaborator?.name || 'Sistema'}
                     </p>
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
