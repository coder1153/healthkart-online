import { supabase } from "@/integrations/supabase/client";

export interface AdminSession {
  token: string;
  label: string;
  expiresAt: number;
}

export const getAdminSession = (): AdminSession | null => {
  const token = localStorage.getItem('admin_token');
  const label = localStorage.getItem('admin_label');
  const expiresAt = localStorage.getItem('admin_expires');

  if (!token || !label || !expiresAt) {
    return null;
  }

  const expires = parseInt(expiresAt);
  if (Date.now() >= expires) {
    clearAdminSession();
    return null;
  }

  return { token, label, expiresAt: expires };
};

export const clearAdminSession = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_label');
  localStorage.removeItem('admin_expires');
};

export const verifyAdminSession = async (): Promise<boolean> => {
  const session = getAdminSession();
  
  if (!session) {
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-verify', {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    if (error || !data.valid) {
      clearAdminSession();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying admin session:', error);
    clearAdminSession();
    return false;
  }
};

export const getAdminHeaders = (): HeadersInit => {
  const session = getAdminSession();
  
  if (!session) {
    throw new Error('No admin session found');
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
};
