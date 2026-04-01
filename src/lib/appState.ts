import { supabase } from './supabase';
import type { ProfileData, TopicState } from './api';

/**
 * Fetch user's app state from Supabase
 */
export async function getUserAppState() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('user_app_state')
    .select('*')
    .eq('user_id', userData.user.id)
    .single();

  if (error) {
    console.error('Failed to fetch app state:', error);
    return null;
  }

  return data?.state;
}

/**
 * Update user's app state in Supabase
 */
export async function updateUserAppState(state: any) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('user_app_state')
    .update({
      state,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userData.user.id);

  if (error) {
    throw new Error(`Failed to update app state: ${error.message}`);
  }
}

/**
 * Update user profile information
 */
export async function updateUserProfile(profile: Partial<ProfileData>) {
  const currentState = await getUserAppState();
  const updatedState = {
    ...currentState,
    ...profile,
  };
  await updateUserAppState(updatedState);
}

/**
 * Get user profile
 */
export async function getUserProfile(): Promise<ProfileData | null> {
  const state = await getUserAppState();
  if (!state) return null;

  return {
    fullName: state.fullName,
    email: state.email,
    university: state.university,
    yearOfStudy: state.yearOfStudy,
    courseOfStudy: state.courseOfStudy,
    modules: state.modules || [],
  };
}
