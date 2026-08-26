import { downscaleImage } from './image';
import { supabase } from './supabase';
import type { PendingProfile, Profile, ProfileStatus, Role } from './types';

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role | null;
  status: ProfileStatus;
  avatar_path: string | null;
  requested_at: string;
  verified_at: string | null;
};

const profileFields = 'id,full_name,email,phone,role,status,avatar_path,requested_at,verified_at';

function fail(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

async function signedAvatar(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

async function mapProfile(row: ProfileRow): Promise<Profile> {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    avatarPath: row.avatar_path,
    avatarUrl: await signedAvatar(row.avatar_path),
    requestedAt: row.requested_at,
    verifiedAt: row.verified_at,
  };
}

export const accountRepository = {
  async getProfile(id: string) {
    const { data, error } = await supabase.from('profiles').select(profileFields).eq('id', id).single();
    if (error || !data) fail(error, 'Your profile could not be loaded.');
    return mapProfile(data as ProfileRow);
  },

  async updateProfile(id: string, values: { fullName?: string; phone?: string | null; avatarPath?: string | null }) {
    const changes: Record<string, string | null> = {};
    if (values.fullName !== undefined) changes.full_name = values.fullName.trim();
    if (values.phone !== undefined) changes.phone = values.phone?.trim() || null;
    if (values.avatarPath !== undefined) changes.avatar_path = values.avatarPath;
    const { data, error } = await supabase.from('profiles').update(changes).eq('id', id).select(profileFields).single();
    if (error || !data) fail(error, 'Your profile could not be saved.');
    return mapProfile(data as ProfileRow);
  },

  async uploadAvatar(id: string, file: File, oldPath: string | null) {
    const blob = await downscaleImage(file);
    const path = `${id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
    if (uploadError) fail(uploadError, 'Avatar could not be uploaded.');
    try {
      const profile = await this.updateProfile(id, { avatarPath: path });
      if (oldPath && oldPath !== path) void supabase.storage.from('avatars').remove([oldPath]);
      return profile;
    } catch (error) {
      void supabase.storage.from('avatars').remove([path]);
      throw error;
    }
  },

  async getPendingProfiles() {
    const { data, error } = await supabase.from('profiles').select(profileFields).eq('status', 'pending').order('requested_at');
    if (error) fail(error, 'Pending accounts could not be loaded.');
    return Promise.all((data as ProfileRow[]).map(row => mapProfile(row) as Promise<PendingProfile>));
  },

  async approve(id: string, role: Role) {
    const { error } = await supabase.from('profiles').update({ status: 'active', role }).eq('id', id).eq('status', 'pending');
    if (error) fail(error, 'Account approval failed.');
  },

  async reject(id: string) {
    const { error } = await supabase.from('profiles').update({ status: 'rejected', role: null }).eq('id', id).eq('status', 'pending');
    if (error) fail(error, 'Account rejection failed.');
  },
};
