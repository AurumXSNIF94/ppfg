import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../config/firebase';
import { Package, ShieldCheck } from 'lucide-react';

export default function Login() {
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
      alert("Failed to sign in with Google: " + error.message);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-bgBody justify-center items-center font-sans p-4">
      <div className="bg-surface border border-borderLight w-full max-w-md p-8 rounded-3xl shadow-float text-center">
        <div className="w-16 h-16 bg-indigo-50 text-primary rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-soft">
          <Package size={32} />
        </div>
        
        <h1 className="text-2xl font-extrabold text-textMain tracking-tight mb-2">WMS Inbound System</h1>
        <p className="text-xs font-semibold text-textMuted mb-8">Sign in with your authorized corporate Google account to access the warehouse dashboard.</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all shadow-glow flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] font-bold text-textMuted">
          <ShieldCheck size={14} className="text-emerald-600" />
          Secure Firebase Authentication
        </div>
      </div>
    </div>
  );
}
