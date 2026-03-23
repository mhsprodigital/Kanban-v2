import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { Loader2, User, Lock, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginScreenProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'first_access' | 'forgot_password'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Preencha usuário e senha');
      return;
    }
    setLoading(true);
    try {
      // 1. Check if user exists in invitations
      const userDoc = await getDoc(doc(db, 'invitations', username.trim().toLowerCase()));
      
      if (!userDoc.exists()) {
        // --- MASTER LOGIN BOOTSTRAP ---
        if (username.trim().toLowerCase() === 'matheus.sousa' && password === '394437') {
          try {
            const authEmail = 'matheus.sousa@hrt.local';
            let uid;
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
              uid = userCredential.user.uid;
            } catch (authErr: any) {
              if (authErr.code === 'auth/email-already-in-use') {
                const userCredential = await signInWithEmailAndPassword(auth, authEmail, password);
                uid = userCredential.user.uid;
              } else {
                throw authErr;
              }
            }
            
            // Create invitation
            await setDoc(doc(db, 'invitations', 'matheus.sousa'), {
              id: 'matheus.sousa',
              username: 'matheus.sousa',
              name: 'Matheus Sousa',
              authEmail,
              role: 'admin',
              status: 'active',
              authVersion: 1,
              resetRequested: false,
              uid,
              createdAt: new Date().toISOString(),
              createdBy: 'system'
            });
            
            // Create user profile
            await setDoc(doc(db, 'users', uid), {
              uid,
              username: 'matheus.sousa',
              name: 'Matheus Sousa',
              email: authEmail,
              role: 'admin',
              status: 'active',
              category: 'Administrador',
              createdAt: new Date().toISOString()
            });
            
            toast.success('Conta master criada e logada com sucesso!');
            onSuccess();
            return;
          } catch (e: any) {
            console.error('Master login error:', e);
            if (e.code === 'auth/operation-not-allowed') {
              toast.error('ERRO: Autenticação por E-mail/Senha não está ativada no Firebase. Por favor, ative-a no Console do Firebase (Authentication > Sign-in method).', { duration: 8000 });
            } else {
              toast.error('Erro ao criar conta master.');
            }
            setLoading(false);
            return;
          }
        }
        // --- END MASTER LOGIN BOOTSTRAP ---

        toast.error('Usuário não encontrado.');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();

      if (userData.resetRequested) {
        toast.error('Sua solicitação de redefinição de senha está pendente. Aguarde o administrador.');
        setLoading(false);
        return;
      }

      if (userData.status === 'pending') {
        toast.error('Este é seu primeiro acesso. Clique em "Primeiro Acesso" para criar sua senha.');
        setMode('first_access');
        setLoading(false);
        return;
      }

      // 2. Login with Firebase Auth
      await signInWithEmailAndPassword(auth, userData.authEmail, password);
      onSuccess();
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Senha incorreta.');
      } else {
        toast.error('Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Preencha usuário e a nova senha');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setLoading(true);
    try {
      const userRef = doc(db, 'invitations', username.trim().toLowerCase());
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        toast.error('Usuário não encontrado.');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();

      if (userData.resetRequested) {
        toast.error('Sua solicitação de redefinição de senha está pendente. Aguarde o administrador.');
        setLoading(false);
        return;
      }

      if (userData.status === 'active') {
        toast.error('Este usuário já possui uma senha. Faça login normalmente.');
        setMode('login');
        setLoading(false);
        return;
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, userData.authEmail, password);
      
      // Update invitation status
      await updateDoc(userRef, {
        uid: userCredential.user.uid,
        status: 'active'
      });

      toast.success('Senha criada com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('First access error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Erro interno: E-mail de autenticação já em uso. Contate o administrador.');
      } else {
        toast.error('Erro ao criar senha. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast.error('Preencha seu nome de usuário');
      return;
    }
    
    setLoading(true);
    try {
      const userRef = doc(db, 'invitations', username.trim().toLowerCase());
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        toast.error('Usuário não encontrado.');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      
      if (userData.resetRequested) {
        toast.error('Você já solicitou a redefinição. Aguarde a liberação do administrador.');
        setLoading(false);
        return;
      }

      await updateDoc(userRef, {
        resetRequested: true
      });

      toast.success('Solicitação enviada! Aguarde a liberação do administrador para criar uma nova senha.');
      setMode('login');
      setPassword('');
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error('Erro ao solicitar redefinição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-32 bg-indigo-600 rounded-b-[50%] scale-150 -translate-y-16 opacity-10 pointer-events-none"></div>
        
        <div className="flex flex-col items-center mb-8 text-center relative z-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black mb-4 shadow-lg shadow-indigo-200">H</div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Kanban HRT</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Gestão de Leitos e Fluxo</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-slate-900"
                  placeholder="Seu nome de usuário"
                  required
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Senha</label>
                <button type="button" onClick={() => setMode('forgot_password')} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                  Esqueceu?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-slate-900"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 disabled:opacity-70"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : (
                <>Entrar <ArrowRight size={20} /></>
              )}
            </button>

            <div className="pt-4 text-center border-t border-slate-100">
              <p className="text-sm text-slate-500 font-medium">
                Ainda não tem senha?{' '}
                <button type="button" onClick={() => setMode('first_access')} className="text-indigo-600 font-bold hover:underline">
                  Primeiro Acesso
                </button>
              </p>
            </div>
          </form>
        )}

        {mode === 'first_access' && (
          <form onSubmit={handleFirstAccess} className="space-y-5 relative z-10">
            <div className="bg-indigo-50 p-4 rounded-xl mb-6 border border-indigo-100 flex gap-3">
              <ShieldCheck className="text-indigo-600 shrink-0" size={24} />
              <p className="text-sm text-indigo-900 font-medium">
                Se este é o seu primeiro acesso ou sua senha foi resetada, crie uma nova senha abaixo.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-slate-900"
                  placeholder="Seu nome de usuário"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Criar Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound size={18} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-slate-900"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200 disabled:opacity-70"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Salvar e Entrar'}
            </button>

            <div className="pt-2 text-center">
              <button type="button" onClick={() => setMode('login')} className="text-sm text-slate-500 font-bold hover:text-slate-800 transition-colors">
                Voltar para Login
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-5 relative z-10">
            <div className="bg-amber-50 p-4 rounded-xl mb-6 border border-amber-100">
              <p className="text-sm text-amber-900 font-medium">
                Informe seu usuário. Uma solicitação será enviada aos administradores para liberar a criação de uma nova senha.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-slate-900"
                  placeholder="Seu nome de usuário"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white font-black py-4 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-900 active:scale-[0.98] transition-all shadow-lg shadow-slate-200 disabled:opacity-70"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Solicitar Redefinição'}
            </button>

            <div className="pt-2 text-center">
              <button type="button" onClick={() => setMode('login')} className="text-sm text-slate-500 font-bold hover:text-slate-800 transition-colors">
                Voltar para Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
