import { useRef, useState, type FormEvent } from 'react';
import Camera from 'lucide-react/dist/esm/icons/camera.mjs';
import LogOut from 'lucide-react/dist/esm/icons/log-out.mjs';
import { useAuth } from './AuthProvider';
import './accounts.css';

export function MyAccount({ standalone = false, onBack }: { standalone?: boolean; onBack?: () => void }) {
  const { profile, updateProfile, uploadAvatar, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [preview, setPreview] = useState(profile?.avatarUrl || '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  if (!profile) return null;

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await updateProfile({ fullName, phone });
      if (file) await uploadAvatar(file);
      setFile(null); setMessage('Profile saved.');
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Profile could not be saved.'); }
    finally { setBusy(false); }
  }

  function pick(next: File | undefined) {
    if (!next) return;
    setFile(next); setPreview(URL.createObjectURL(next));
  }

  const body = <section className="account-editor">
    <div className="account-editor-head"><span>ACCOUNT / {profile.status.toUpperCase()}</span><h1>My Account</h1><p>Keep your name, phone, and team photo up to date.</p></div>
    <form onSubmit={save}>
      <div className="account-avatar-row">
        <button type="button" className="account-avatar" onClick={() => input.current?.click()}>{preview ? <img src={preview} alt="Your avatar"/> : <span>{profile.fullName.slice(0, 1).toUpperCase()}</span>}<i><Camera size={15}/></i></button>
        <div><strong>Profile photo</strong><button type="button" onClick={() => input.current?.click()}>CHANGE PHOTO</button></div>
        <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => pick(event.target.files?.[0])}/>
      </div>
      <label>Full name<input value={fullName} onChange={event => setFullName(event.target.value)} required/></label>
      <label>Email<input value={profile.email} disabled/></label>
      <label>Phone number<input type="tel" value={phone} onChange={event => setPhone(event.target.value)}/></label>
      <div className="account-locked-grid"><div><span>ROLE</span><strong>{profile.role?.toUpperCase() || 'NOT ASSIGNED'}</strong></div><div><span>STATUS</span><strong>{profile.status.toUpperCase()}</strong></div></div>
      <p className="account-admin-note">Only an admin can change your role or account status.</p>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="button button-primary account-submit" disabled={busy}>{busy ? 'SAVING…' : 'SAVE PROFILE'}</button>
    </form>
    {standalone && <div className="standalone-actions">{onBack && <button type="button" onClick={onBack}>BACK</button>}<button type="button" onClick={() => void signOut()}><LogOut size={15}/>SIGN OUT</button></div>}
  </section>;

  if (!standalone) return <div className="content account-content">{body}</div>;
  return <main className="standalone-account"><header className="account-brand"><img src="/homies-logo.png" alt="#HOMIES" width="1654" height="651"/><span>PRO SHOP</span></header>{body}</main>;
}
