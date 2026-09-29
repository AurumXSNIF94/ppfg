import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../config/firebase';
import { Warehouse, ShieldCheck, Activity } from 'lucide-react';

export default function Login() {
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
      const message = error?.code === 'auth/unauthorized-domain'
        ? 'Domain belum diizinkan Firebase Authentication. Tambahkan ppfgwh.pages.dev di Firebase Console → Authentication → Settings → Authorized domains.'
        : error?.message || 'Unknown authentication error.';
      alert('Failed to sign in with Google: ' + message);
    }
  };

  return (
    <div className="relative flex h-screen w-screen bg-slate-50 justify-center items-center font-sans p-4 overflow-hidden">
      
      {/* Efek Latar Belakang (Decorative Blobs) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-rose-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-emerald-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '4s' }}></div>

      {/* Kartu Login Utama (Glassmorphism) */}
      <div className="relative z-10 bg-white/80 backdrop-blur-xl border border-white/60 w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl text-center">
        
        {/* Ikon Logo Bertingkat */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-500 to-indigo-600 rounded-[1.2rem] rotate-6 opacity-20 transition-transform duration-300 hover:rotate-12"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-600 to-indigo-700 rounded-[1.2rem] flex items-center justify-center text-white shadow-lg transform -rotate-3 transition-transform hover:rotate-0 duration-300">
            <Warehouse size={36} strokeWidth={1.5} />
            <Activity size={18} className="absolute bottom-2 right-2 text-emerald-300" strokeWidth={3} />
          </div>
        </div>
        
        {/* Tipografi */}
        <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-3">
          FGWH Monitoring
        </h1>
        <p className="text-[13px] font-medium text-slate-500 mb-10 leading-relaxed px-2">
          Finished Goods Warehouse control center. Secure your session to access real-time analytics.
        </p>
        
        {/* Tombol Login Google */}
        <button 
          onClick={handleGoogleLogin}
          className="w-full py-3.5 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-extrabold text-[14px] transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md group"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Sign in with Google
        </button>

        {/* Catatan Keamanan */}
        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <ShieldCheck size={16} className="text-emerald-500" />
          Enterprise-Grade Security
        </div>
      </div>
    </div>
  );
}
