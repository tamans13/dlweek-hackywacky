// Quick reference for Supabase functions

// AUTHENTICATION
import { signUp, signIn, signOut, getCurrentUser } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext'; // Hook for components

// PROFILE & APP STATE
import { 
  getUserProfile, 
  updateUserProfile, 
  getUserAppState, 
  updateUserAppState 
} from '@/lib/appState';

// DOCUMENTS
import { 
  uploadDocument, 
  getTopicDocuments, 
  deleteDocument, 
  getDocumentSignedUrl 
} from '@/lib/documents';

// QUIZZES
import { 
  createQuiz, 
  getTopicQuizzes, 
  deleteQuiz, 
  getQuiz,
  submitQuizAttempt, 
  getQuizAttempts, 
  getTopicQuizAttempts 
} from '@/lib/quizzes';

// SUPABASE CLIENT (if you need direct access)
import { supabase } from '@/lib/supabase';

/* EXAMPLE USAGE PATTERNS */

// Component with auth
function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) return <div>Please log in</div>;
  
  return <div>Welcome, {user?.email}</div>;
}

// Fetch and update profile
async function loadAndUpdateProfile() {
  const profile = await getUserProfile();
  await updateUserProfile({ 
    university: 'MIT',
    modules: [...profile.modules, 'SC1005'] 
  });
}

// Document workflow
async function handleUploadAndList(file: File, module: string, topic: string) {
  // Upload
  const doc = await uploadDocument(file, module, topic);
  
  // List all docs in topic
  const docs = await getTopicDocuments(module, topic);
  
  // Get download link
  const url = await getDocumentSignedUrl(doc.storage_path);
}

// Quiz workflow
async function quizFlow() {
  // Create quiz
  const quiz = await createQuiz(
    'SC1005',
    'Topic',
    'Quiz Title',
    questions,
    sourceDocIds
  );
  
  // Submit attempt
  await submitQuizAttempt(
    quiz.id,
    'SC1005',
    'Topic',
    score,
    total,
    answers
  );
  
  // View all attempts
  const attempts = await getQuizAttempts(quiz.id);
}
