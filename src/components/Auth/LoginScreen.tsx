import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setSending(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <div className="auth-wrap">
      <div className="card">
        <h2>Meal Composer</h2>
        {sent ? (
          <p className="hint">Check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={sendLink}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="note warn">{error}</p>}
            <button className="btn" type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
