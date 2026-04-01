import { supabase } from './supabase';

/**
 * Upload a document to Supabase Storage and create a record
 */
export async function uploadDocument(
  file: File,
  moduleName: string,
  topicName: string,
  extractedText?: string
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const storagePath = `${userData.user.id}/${moduleName}/${topicName}/${fileName}`;

  // Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from('topic-documents')
    .upload(storagePath, file);

  if (uploadError) {
    throw new Error(`File upload failed: ${uploadError.message}`);
  }

  // Create database record
  const { data, error: dbError } = await supabase
    .from('topic_documents')
    .insert({
      user_id: userData.user.id,
      module_name: moduleName,
      topic_name: topicName,
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      storage_path: storagePath,
      extracted_text: extractedText,
    })
    .select()
    .single();

  if (dbError) {
    throw new Error(`Database record creation failed: ${dbError.message}`);
  }

  return data;
}

/**
 * Get documents for a specific topic
 */
export async function getTopicDocuments(moduleName: string, topicName: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('topic_documents')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('module_name', moduleName)
    .eq('topic_name', topicName)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data;
}

/**
 * Delete a document from Supabase
 */
export async function deleteDocument(documentId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  // Get the document to find storage path
  const { data: doc, error: fetchError } = await supabase
    .from('topic_documents')
    .select('storage_path')
    .eq('id', documentId)
    .eq('user_id', userData.user.id)
    .single();

  if (fetchError) {
    throw new Error(`Failed to find document: ${fetchError.message}`);
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('topic-documents')
    .remove([doc.storage_path]);

  if (storageError) {
    console.error('Failed to delete from storage:', storageError);
  }

  // Delete database record
  const { error: dbError } = await supabase
    .from('topic_documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', userData.user.id);

  if (dbError) {
    throw new Error(`Failed to delete document: ${dbError.message}`);
  }
}

/**
 * Get a signed URL for a document (expires in 1 hour by default)
 */
export async function getDocumentSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
) {
  const { data, error } = await supabase.storage
    .from('topic-documents')
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}
