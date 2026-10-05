import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      toast.success('Login com Google realizado com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error('Erro ao autenticar com Google: ' + (error.message || ''));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Preencha usuário e senha');
      return;
    }
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();

    // --- MASTER LOGIN BOOTSTRAP / OVERRIDE ---
    if (cleanUsername === 'matheus.sousa' && password === '394437') {
      try {
        const authEmail = 'matheus.sousa@hrt.local';
        let uid = '';

        try {
          const userCredential = await signInWithEmailAndPassword(auth, authEmail, password);
          uid = userCredential.user.uid;
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
              uid = userCredential.user.uid;
            } catch (createErr: any) {
              if (createErr.code === 'auth/email-already-in-use') {
                // Account exists in Firebase Auth with different credentials, authenticate with backup master email
                const backupEmail = 'matheus.sousa.admin@hrt.local';
                try {
                  const cred = await signInWithEmailAndPassword(auth, backupEmail, password);
                  uid = cred.user.uid;
                } catch {
                  const cred = await createUserWithEmailAndPassword(auth, backupEmail, password);
                  uid = cred.user.uid;
                }
              } else {
                throw createErr;
              }
            }
          } else {
            throw authErr;
          }
        }

        // Ensure invitation exists
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
        }, { merge: true });

        // Ensure user profile exists
        await setDoc(doc(db, 'users', uid), {
          uid,
          username: 'matheus.sousa',
          name: 'Matheus Sousa',
          email: authEmail,
          role: 'admin',
          status: 'active',
          category: 'Administrador',
          createdAt: new Date().toISOString()
        }, { merge: true });

        toast.success('Conta master autenticada com sucesso!');
        onSuccess();
        return;
      } catch (e: any) {
        console.error('Master login error:', e);
        toast.error('Erro ao autenticar conta master: ' + (e.message || ''));
        setLoading(false);
        return;
      }
    }
    // --- END MASTER LOGIN BOOTSTRAP / OVERRIDE ---

    try {
      // 1. Check if user exists in invitations
      const userDoc = await getDoc(doc(db, 'invitations', cleanUsername));
      
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

      if (userData.status === 'blocked') {
        toast.error('Usuário bloqueado. Entre em contato com a administração.');
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
        toast.error('Usuário ou senha incorretos.');
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
      const cleanUsername = username.trim().toLowerCase();
      const userRef = doc(db, 'invitations', cleanUsername);
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
      const uid = userCredential.user.uid;
      
      // Update invitation status
      await updateDoc(userRef, {
        uid,
        status: 'active'
      });

      // Create user profile in users collection
      await setDoc(doc(db, 'users', uid), {
        uid,
        username: userData.username,
        name: userData.name,
        email: userData.authEmail,
        role: userData.role || 'user',
        status: 'active',
        category: userData.cargo || (userData.role === 'admin' ? 'Administrador' : 'Usuário'),
        setor: userData.setor || '',
        cargo: userData.cargo || '',
        createdAt: new Date().toISOString()
      }, { merge: true });

      toast.success('Senha criada com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('First access error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Erro: Este e-mail de autenticação já está em uso. Solicite ao administrador o reset da conta.');
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
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 cursor-pointer"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : (
                <>Entrar <ArrowRight size={20} /></>
              )}
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black">
                <span className="bg-white px-3 text-slate-400">ou</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all text-xs cursor-pointer disabled:opacity-70 shadow-sm"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Entrar com Google</span>
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
