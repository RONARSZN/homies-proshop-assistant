import { useEffect, useState } from 'react';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import { accountRepository } from './accountRepository';
import type { PendingProfile, Role } from './types';
import './accounts.css';

type Decision = { profile: PendingProfile; action: 'approve' | 'reject'; role?: Role };

export function VerifyAccounts() {
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setProfiles(await accountRepository.getPendingProfiles()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Queue could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function confirmDecision() {
    if (!decision) return;
    setBusy(true); setError('');
    try {
      if (decision.action === 'approve' && decision.role) await accountRepository.approve(decision.profile.id, decision.role);
      else await accountRepository.reject(decision.profile.id);
      setProfiles(current => current.filter(profile => profile.id !== decision.profile.id));
      setDecision(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Account could not be updated.'); }
    finally { setBusy(false); }
  }

  return <div className="content verify-content">
    <header className="verify-head"><span>ADMIN / ACCESS CONTROL</span><h1>Verify Accounts</h1><p>Review new team accounts before they enter the workspace.</p><b>{profiles.length.toString().padStart(2, '0')} PENDING</b></header>
    {loading && <div className="verify-empty">LOADING ACCOUNT QUEUE…</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && profiles.length === 0 && <div className="verify-empty"><UserCheck size={28}/><strong>QUEUE CLEAR</strong><span>No accounts are waiting for approval.</span></div>}
    <div className="verify-list">{profiles.map((profile, index) => <article className="verify-card" key={profile.id}>
      <span className="verify-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="verify-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt=""/> : profile.fullName.slice(0, 1).toUpperCase()}</div>
      <div className="verify-person"><h2>{profile.fullName}</h2><span>{profile.email}</span><span>{profile.phone || 'Phone not added'}</span><small>REQUESTED {new Date(profile.requestedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
      <div className="verify-actions">
        <button onClick={() => setDecision({ profile, action: 'approve', role: 'staff' })}><Check size={16}/>APPROVE AS STAFF</button>
        <button onClick={() => setDecision({ profile, action: 'approve', role: 'admin' })}><Check size={16}/>APPROVE AS ADMIN</button>
        <button className="reject" onClick={() => setDecision({ profile, action: 'reject' })}><X size={16}/>REJECT</button>
      </div>
    </article>)}</div>
    {decision && <div className="decision-backdrop" onClick={() => !busy && setDecision(null)}><div className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title" onClick={event => event.stopPropagation()}><span>CONFIRM ACCESS CHANGE</span><h2 id="decision-title">{decision.action === 'reject' ? `Reject ${decision.profile.fullName}?` : `Approve ${decision.profile.fullName} as ${decision.role?.toUpperCase()}?`}</h2><p>{decision.action === 'reject' ? 'They will remain signed out of the workspace.' : 'This grants live workspace access under the selected role.'}</p><div><button disabled={busy} onClick={() => setDecision(null)}>CANCEL</button><button className={decision.action === 'reject' ? 'reject' : ''} disabled={busy} onClick={() => void confirmDecision()}>{busy ? 'UPDATING…' : 'CONFIRM'}</button></div></div></div>}
  </div>;
}
