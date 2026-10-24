import { getSupabase } from './supabase';
import { spaceFileType, validateSpaceFile } from './spaces';

export async function spaceRpc(name, params = {}) {
  const { data, error } = await getSupabase().rpc(name, params);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42P01') throw new Error('Spaces are temporarily unavailable. Please try again later.');
    throw new Error(error.message || 'Something went wrong. Please try again.');
  }
  return data;
}

export async function sendSpaceMessage(spaceId, userId, body, file) {
  const storage = getSupabase().storage.from('space-files');
  let attachment = null;
  if (file) {
    const invalid = validateSpaceFile(file);
    if (invalid) throw new Error(invalid);
    attachment = { path: `${spaceId}/${userId}/${crypto.randomUUID()}`, name: file.name, mime: spaceFileType(file), size: file.size };
    const upload = new Blob([file], { type: attachment.mime });
    const { error } = await storage.upload(attachment.path, upload, { contentType: attachment.mime, upsert: false });
    if (error) throw new Error('File upload failed. ' + error.message);
  }
  try {
    return await spaceRpc('send_space_message', { p_space_id: spaceId, p_body: body.trim(), p_attachment: attachment });
  } catch (error) {
    // Published attachments cannot be deleted by this policy. If the response was
    // lost after a successful send, this cannot remove somebody's chat attachment.
    if (attachment) await storage.remove([attachment.path]);
    throw error;
  }
}

export async function downloadSpaceAttachment(attachment) {
  const { data, error } = await getSupabase().storage.from('space-files').download(attachment.path);
  if (error) throw new Error('This file is unavailable. Please try again.');
  return data;
}
