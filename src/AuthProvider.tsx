import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { accountRepository } from './accountRepository';
import type { Profile } from './types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (values: { fullName?: string; phone?: string | null }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  clearError: () => void;
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
    try {
      const nextProfile = await accountRepository.getProfile(nextSession.user.id);
      setProfile(nextProfile);
      setError(null);
    } catch {
      setProfile(null);
      setError('Your account is signed in, but its profile could not be loaded. Try again.');
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
      throw signInError;
    }
    await loadProfile(data.session);
  }

  async function signUp(fullName: string, email: string, password: string) {
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      throw signUpError;
    }
    if (data.session) await loadProfile(data.session);
    else setLoading(false);
    return { needsEmailConfirmation: !data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function refreshProfile() {
    if (session) setProfile(await accountRepository.getProfile(session.user.id));
  }

  async function updateProfile(values: { fullName?: string; phone?: string | null }) {
    if (!profile) return;
    setProfile(await accountRepository.updateProfile(profile.id, values));
  }

  async function uploadAvatar(file: File) {
    if (!profile) return;
    setProfile(await accountRepository.uploadAvatar(profile.id, file, profile.avatarPath));
  }

  return <AuthContext.Provider value={{ session, profile, loading, error, signIn, signUp, signOut, refreshProfile, updateProfile, uploadAvatar, clearError: () => setError(null) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth must be used inside AuthProvider.');
  return state;
}
