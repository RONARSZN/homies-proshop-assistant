import { useRef, useState } from 'react';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import Camera from 'lucide-react/dist/esm/icons/camera.mjs';
import { useAuth } from './AuthProvider';
import './accounts.css';

export function Onboarding({ step, onNext, onSkip }: { step: 'phone' | 'avatar'; onNext: () => void; onSkip: () => void }) {
  const { profile, updateProfile, uploadAvatar } = useAuth();
  const [phone, setPhone] = useState(profile?.phone || '');
  const [preview, setPreview] = useState(profile?.avatarUrl || '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  async function savePhone() {
    setBusy(true); setError('');
    try { await updateProfile({ phone }); onNext(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Phone could not be saved.'); }
    finally { setBusy(false); }
  }

  async function saveAvatar() {
    if (!file) { onNext(); return; }
    setBusy(true); setError('');
    try { await uploadAvatar(file); onNext(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Avatar could not be saved.'); }
    finally { setBusy(false); }
  }

  function pick(next: File | undefined) {
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  const number = step === 'phone' ? 1 : 2;
  return <main className="onboarding-page">
    <header className="account-brand onboarding-brand"><img src="/homies-logo.png" alt="#HOMIES" width="1654" height="651"/><span>PRO SHOP</span></header>
    <section className="onboarding-card">
      <div className="onboarding-progress"><span>PROFILE SETUP</span><b>{number} / 2</b></div>
      <div className="onboarding-bars"><i className="done"/><i className={step === 'avatar' ? 'done' : ''}/></div>
      {step === 'phone' ? <>
        <div className="onboarding-number">01</div>
        <h1>Add your phone</h1>
        <p>This helps the team identify and contact the right account holder.</p>
        <label className="onboarding-field">Phone number<input type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" value={phone} onChange={event => setPhone(event.target.value)}/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary account-submit" disabled={busy} onClick={() => void savePhone()}>{busy ? 'SAVING…' : 'CONTINUE'}<ArrowRight size={18}/></button>
      </> : <>
        <div className="onboarding-number">02</div>
        <h1>Add your photo</h1>
        <p>Your avatar is private and only visible inside the team workspace.</p>
        <button type="button" className={`avatar-picker ${preview ? 'has-photo' : ''}`} onClick={() => input.current?.click()}>
          {preview ? <img src={preview} alt="Selected avatar preview"/> : <><Camera size={28}/><strong>CHOOSE PHOTO</strong><span>JPG, PNG, or WEBP</span></>}
        </button>
        <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => pick(event.target.files?.[0])}/>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary account-submit" disabled={busy} onClick={() => void saveAvatar()}>{busy ? 'UPLOADING…' : file ? 'SAVE PHOTO' : 'CONTINUE'}<ArrowRight size={18}/></button>
      </>}
      <button type="button" className="account-skip" onClick={onSkip}>SKIP FOR NOW</button>
    </section>
  </main>;
}
