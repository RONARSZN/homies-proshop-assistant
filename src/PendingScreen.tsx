import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import LogOut from 'lucide-react/dist/esm/icons/log-out.mjs';
import './pending-screen.css';

export function PendingScreen({ fullName, onAccount, onSignOut }: { fullName: string; onAccount: () => void; onSignOut: () => void }) {
  return <main className="pending-page">
    <header className="pending-brand">
      <img src="/homies-logo.png" alt="#HOMIES" width="1654" height="651"/>
      <span>PRO SHOP</span>
    </header>

    <section className="pending-pass" aria-labelledby="pending-title">
      <div className="pending-stamp">
        <span className="pending-stamp-index" aria-hidden="true">00 / WAIT</span>
        <strong aria-hidden="true">PENDING</strong>
        <span className="pending-stamp-name">{fullName}</span>
      </div>
      <div className="pending-copy">
        <div className="pending-status"><i/>Account pending</div>
        <h1 id="pending-title">Waiting for an admin</h1>
        <p>Your account is real. Nothing is broken. An admin has to approve it before you can use the shop workspace.</p>
        <div className="pending-rule"/>
        <p className="pending-next">Finish your profile while you wait.</p>
        <button type="button" className="button button-primary pending-account" onClick={onAccount}>My Account<ArrowRight size={17}/></button>
      </div>
    </section>

    <button type="button" className="pending-sign-out" onClick={onSignOut}><LogOut size={16}/>Sign out</button>
  </main>;
}
