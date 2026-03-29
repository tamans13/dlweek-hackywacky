import { supabase, type AuthUser } from './supabase';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

/**
 * Sign up a new user and create their initial profile
 */
export async function signUp(input: SignUpInput) {
  const { email, password, fullName } = input;

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (authError) {
    throw new Error(`Sign up failed: ${authError.message}`);
  }

  // Initialize user app state
  if (authData.user) {
    const { error: stateError } = await supabase
      .from('user_app_state')
      .insert({
        user_id: authData.user.id,
        state: {
          fullName,
          email,
          university: '',
          yearOfStudy: '',
          courseOfStudy: '',
          modules: [],
        },
      });

    if (stateError) {
      console.error('Failed to initialize user state:', stateError);
    }
  }

  return authData;
}

/**
 * Sign in with email and password
 */
export async function signIn(input: SignInInput) {
  const { email, password } = input;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Sign in failed: ${error.message}`);
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`Sign out failed: ${error.message}`);
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
  return data.user;
}

/**
 * Reset password for email
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(`Reset password failed: ${error.message}`);
  }
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(`Update password failed: ${error.message}`);
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(
  callback: (user: AuthUser | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });

  return data.subscription.unsubscribe;
}
