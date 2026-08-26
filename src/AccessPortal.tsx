import { useState, type FormEvent } from 'react';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import { useAuth } from './AuthProvider';
import './accounts.css';

type Mode = 'signin' | 'register';

export function AccessPortal({ onRegistered }: { onRegistered: () => void }) {
  const { signIn, signUp, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  function changeMode(next: Mode) {
    clearError();
    setMessage('');
    setMode(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const result = await signUp(fullName.trim(), email.trim(), password);
        if (result.needsEmailConfirmation) setMessage('Check your email to confirm the account, then sign in.');
        else onRegistered();
      }
    } catch {
      // The provider supplies the exact authentication error below the fields.
    }
  }

  return <main className="access-page">
    <section className="access-poster" aria-hidden="true">
      <div className="access-poster-mark">#HOMIES</div>
      <div className="access-poster-lines"/>
      <strong>{mode === 'signin' ? <>ANO<br/>HANAP<br/>MO?</> : <>JOIN<br/>THE<br/>CREW.</>}</strong>
      <span>CLARK · PAMPANGA</span>
    </section>
    <section className="access-panel">
      <header className="account-brand"><img src="/homies-logo.png" alt="#HOMIES" width="1654" height="651"/><span>PRO SHOP</span></header>
      <div className="access-form-wrap">
        <div className="access-index">{mode === 'signin' ? '01 / ACCESS' : '02 / REGISTER'}</div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create an account'}</h1>
        <p>{mode === 'signin' ? 'Use your approved team account.' : 'Register first. An admin approves access after your profile is complete.'}</p>
        <div className="access-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => changeMode('signin')}>SIGN IN</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')}>REGISTER</button>
        </div>
        <form className="account-form" onSubmit={submit}>
          {mode === 'register' && <label>Full name<input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} required minLength={2}/></label>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required/></label>
          <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={6}/></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="form-message" role="status">{message}</div>}
          <button className="button button-primary account-submit" disabled={loading}>{loading ? 'PLEASE WAIT…' : mode === 'signin' ? 'GET IN' : 'REGISTER'}<ArrowRight size={18}/></button>
        </form>
      </div>
      <footer className="access-footer">PRIVATE TEAM WORKSPACE · LIVE STOCK</footer>
    </section>
  </main>;
}
