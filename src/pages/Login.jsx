import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  if (user) return <Navigate to="/" replace />;

  // Helper: extract a readable message from any Supabase error shape
  const getErrorMsg = (err) => {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.message && err.message.trim()) return err.message;
    if (err.error_description) return err.error_description;
    if (err.msg) return err.msg;
    // last resort: show the raw JSON so we can debug
    return JSON.stringify(err);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSignUpSuccess(false);

    if (isSignUp) {
      // --- SIGN UP ---
      if (!displayName.trim()) {
        setError('Display name zaruri hai bhai!');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password kam az kam 6 characters ka hona chahiye.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });

      if (signUpError) {
        setError(getErrorMsg(signUpError));
        setLoading(false);
        return;
      }

      if (!data?.user) {
        setError('Sign up fail ho gaya. Dobara try karo.');
        setLoading(false);
        return;
      }

      // If the email was already registered, Supabase returns an empty identities array
      if (data.user.identities && data.user.identities.length === 0) {
        setError('Yeh email pehle se registered hai. Log in karo!');
        setLoading(false);
        return;
      }

      // Manually upsert the profile as a safety net (trigger handles it normally)
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          display_name: displayName,
          role: 'member'
        }, { onConflict: 'id' });
      } catch (_) {
        // Trigger already handled it — safe to ignore
      }

      if (data.session) {
        // Auto-confirmed (email confirm is OFF) — AuthContext will pick up the session
        // and redirect automatically. Nothing to do here.
      } else {
        // Email confirmation is still ON — show success message
        setSignUpSuccess(true);
        setEmail('');
        setPassword('');
        setDisplayName('');
      }

    } else {
      // --- LOGIN ---
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        const msg = getErrorMsg(loginError);
        if (msg.toLowerCase().includes('invalid login credentials')) {
          setError('Ghalat email ya password. Dobara try karo!');
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          setError('Email confirm nahi ki. Inbox check karo ya admin se kaho Supabase mein email confirm OFF kare.');
        } else {
          setError(msg);
        }
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md premium-card p-8 rounded-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-[var(--color-accent)] mb-1 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            PARH BHI LO!
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] font-medium">
            {isSignUp ? 'Crew mein shamil ho jao 🤝' : 'Wapas aa gaye? Log in karo ✌️'}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {signUpSuccess && (
          <div className="mb-5 p-4 bg-green-50 text-green-700 rounded-xl text-sm font-bold border border-green-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>Account ban gaya! 🎉</p>
              <p className="font-medium mt-0.5">Ab "Log In" button dabao.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name — only for Sign Up */}
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-widest">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-shadow"
                placeholder="e.g. Ali Bhai"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-shadow"
              placeholder="tumhari@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-shadow"
              placeholder="min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-[var(--color-accent)] text-white font-bold rounded-xl hover:bg-[var(--color-accent-hover)] transition-colors flex items-center justify-center gap-2 btn-squish"
          >
            {loading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : isSignUp ? '🚀 Create Account' : '🔑 Log In'}
          </button>
        </form>

        <div className="mt-5 text-center border-t border-[var(--color-border)] pt-5">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setSignUpSuccess(false); }}
            className="text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            {isSignUp ? '← Pehle se account hai? Log In' : 'Naya banda? Sign Up →'}
          </button>
        </div>
      </div>
    </div>
  );
}
