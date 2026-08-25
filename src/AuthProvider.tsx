import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile(nextSession: Session | null) {
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error: profileError } = await supabase.from('profiles').select('id,full_name,role').eq('id', nextSession.user.id).single();
    if (profileError) {
      setProfile(null);
      setError('Your account is authenticated but has no shop role. Ask the owner to add your profile.');
    } else {
      setProfile({ id: data.id, fullName: data.full_name, role: data.role });
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => loadProfile(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { void loadProfile(nextSession); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }
    await loadProfile(data.session);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return <AuthContext.Provider value={{ session, profile, loading, error, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth must be used inside AuthProvider.');
  return state;
}
