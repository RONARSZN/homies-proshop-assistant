import LogOut from 'lucide-react/dist/esm/icons/log-out.mjs';
import { useAuth } from './AuthProvider';
import './accounts.css';

export function RejectedScreen({ onAccount }: { onAccount: () => void }) {
  const { profile, signOut } = useAuth();
  return <main className="rejected-page"><header className="account-brand"><img src="/homies-logo.png" alt="#HOMIES" width="1654" height="651"/><span>PRO SHOP</span></header><section><span>ACCESS / REJECTED</span><div className="rejected-word">NO<br/>ACCESS</div><h1>Account not approved</h1><p>{profile?.fullName}, an admin did not approve this account. Contact the shop admin if this needs another review.</p><button className="button button-primary" onClick={onAccount}>MY ACCOUNT</button><button className="account-skip" onClick={() => void signOut()}><LogOut size={15}/>SIGN OUT</button></section></main>;
}
