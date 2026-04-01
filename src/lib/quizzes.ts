import { supabase } from './supabase';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  moduleName: string;
  topicName: string;
  score: number;
  total: number;
  answers: Record<string, string>;
  resultBreakdown: any[];
  submittedAt: string;
}

/**
 * Create a new quiz for a topic
 */
export async function createQuiz(
  moduleName: string,
  topicName: string,
  title: string,
  questions: QuizQuestion[],
  sourceDocumentIds: string[] = []
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('topic_quizzes')
    .insert({
      user_id: userData.user.id,
      module_name: moduleName,
      topic_name: topicName,
      title,
      questions,
      source_document_ids: sourceDocumentIds,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create quiz: ${error.message}`);
  }

  return data;
}

/**
 * Get all quizzes for a topic
 */
export async function getTopicQuizzes(moduleName: string, topicName: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('topic_quizzes')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('module_name', moduleName)
    .eq('topic_name', topicName)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch quizzes: ${error.message}`);
  }

  return data;
}

/**
 * Get a specific quiz
 */
export async function getQuiz(quizId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('topic_quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('user_id', userData.user.id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch quiz: ${error.message}`);
  }

  return data;
}

/**
 * Delete a quiz
 */
export async function deleteQuiz(quizId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('topic_quizzes')
    .delete()
    .eq('id', quizId)
    .eq('user_id', userData.user.id);

  if (error) {
    throw new Error(`Failed to delete quiz: ${error.message}`);
  }
}

/**
 * Submit a quiz attempt
 */
export async function submitQuizAttempt(
  quizId: string,
  moduleName: string,
  topicName: string,
  score: number,
  total: number,
  answers: Record<string, string>,
  resultBreakdown: any[] = []
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('topic_quiz_attempts')
    .insert({
      user_id: userData.user.id,
      quiz_id: quizId,
      module_name: moduleName,
      topic_name: topicName,
      score,
      total,
      answers,
      result_breakdown: resultBreakdown,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to submit quiz attempt: ${error.message}`);
  }

  return data;
}

/**
 * Get all quiz attempts for a specific quiz
 */
export async function getQuizAttempts(quizId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('topic_quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('user_id', userData.user.id)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch quiz attempts: ${error.message}`);
  }

  return data;
}

/**
 * Get all quiz attempts for a user in a topic
 */
export async function getTopicQuizAttempts(moduleName: string, topicName: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('topic_quiz_attempts')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('module_name', moduleName)
    .eq('topic_name', topicName)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch quiz attempts: ${error.message}`);
  }

  return data;
}
