# Supabase Integration Setup Guide

## Quick Start

### 1. Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Create a new project or open an existing one
3. Navigate to **Project Settings > API**
4. Copy your:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Public Key** → `VITE_SUPABASE_ANON_KEY`
   - (Optional) Service Role Key for server operations

### 2. Set Up Environment Variables

Edit `.env.local` in the project root:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Deploy Database Schema

In Supabase:
1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste it into the query editor
5. Click **Run**

This creates all necessary tables and security policies.

### 4. Set Up Storage Bucket

In Supabase:
1. Go to **Storage**
2. Create a new bucket named `topic-documents`
3. Set it to **Private** (RLS will handle access)

## Available Functions

### Authentication (`src/lib/auth.ts`)

```tsx
import { signUp, signIn, signOut, getCurrentUser, resetPassword } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

// In a component
function LoginPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const handleSignUp = async () => {
    await signUp({
      email: 'user@example.com',
      password: 'password123',
      fullName: 'John Doe',
    });
  };

  return <div>{isAuthenticated ? 'Logged in!' : 'Log in above'}</div>;
}
```

### App State (`src/lib/appState.ts`)

```tsx
import { getUserAppState, updateUserAppState, getUserProfile, updateUserProfile } from '@/lib/appState';

// Fetch user profile
const profile = await getUserProfile();

// Update profile
await updateUserProfile({
  university: 'MIT',
  yearOfStudy: '2nd',
  modules: ['SC2001', 'CS1010'],
});
```

### Documents (`src/lib/documents.ts`)

```tsx
import { uploadDocument, getTopicDocuments, deleteDocument, getDocumentSignedUrl } from '@/lib/documents';

// Upload a document
const doc = await uploadDocument(
  file,
  'SC1005',
  'Recursion',
  extractedTextContent
);

// Get all documents for a topic
const docs = await getTopicDocuments('SC1005', 'Recursion');

// Delete a document
await deleteDocument(documentId);

// Get a signed URL to download
const url = await getDocumentSignedUrl(doc.storage_path);
```

### Quizzes (`src/lib/quizzes.ts`)

```tsx
import {
  createQuiz,
  getTopicQuizzes,
  submitQuizAttempt,
  getQuizAttempts,
} from '@/lib/quizzes';

// Create a quiz
const quiz = await createQuiz(
  'SC1005',
  'Recursion',
  'Recursion Fundamentals',
  [
    {
      id: 'q1',
      question: 'What is recursion?',
      options: ['A method', 'A loop', 'A function calling itself', 'None'],
      correctAnswer: 'A function calling itself',
      explanation: 'Recursion is when a function calls itself.',
    },
  ],
  [] // optional document IDs
);

// Submit quiz attempt
await submitQuizAttempt(
  quiz.id,
  'SC1005',
  'Recursion',
  3,
  4,
  { q1: 'A function calling itself' },
  resultBreakdown
);

// Get attempts
const attempts = await getQuizAttempts(quiz.id);
```

## Database Schema Overview

### `user_app_state`
Stores complete user state (profile, modules, etc.) as JSON

### `topic_documents`
Tracks uploaded documents with metadata
- Linked to Supabase Storage for file content

### `topic_quizzes`
Quiz definitions per topic
- Stores questions as JSONB

### `topic_quiz_attempts`
Quiz submission records
- Tracks scores, answers, and results

## Row-Level Security (RLS)

All tables have RLS enabled. Users can only:
- Read/write their own data
- Access via authenticated routes

## Server-Side Usage (Optional)

For server-side operations (Node.js/Express), create a service client:

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key
);
```

## Troubleshooting

**"Supabase URL and anon key must be set"**
- Ensure `.env.local` has both variables filled in
- Restart the dev server after updating env

**"Permission denied" errors**
- Check RLS policies in Supabase dashboard
- Ensure user is authenticated before calling functions

**File upload fails**
- Verify `topic-documents` bucket exists and is private
- Check storage permissions in Supabase

## Next Steps

1. Update your Login page to use `signIn()` from auth.ts
2. Use `useAuth()` hook to protect pages
3. Replace API calls in existing pages with new Supabase functions
4. Test authentication flow end-to-end
