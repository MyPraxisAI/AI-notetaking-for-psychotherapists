// NextResponse is used implicitly by the enhanceRouteHandler
import type { NextResponse as _NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserPersonalAccount } from '../../../_lib/get-user-account';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient['from']>;
};

// POST /api/recordings/[recordingId]/chunk - Upload a chunk of recorded audio
export const POST = enhanceRouteHandler(
  async ({ params, request, user }) => {
    const recordingId = params.recordingId as string;
    
    const ctx = {
      name: 'upload-recording-chunk',
      userId: user?.id || 'anonymous',
      recordingId,
    };

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Get the user's personal account using the utility function
      const accountId = await getUserPersonalAccount(user.id);
      
      if (!accountId) {
        logger.error({ ...ctx, userId: user.id }, 'Personal account not found for user');
        return Response.json({ error: 'Personal account not found' }, { status: 404 });
      }
      
      // Check if the recording exists and belongs to the user
      const { data: recording, error: fetchError } = await client
        .from('recordings')
        .select('id, status')
        .eq('id', recordingId)
        .eq('account_id', accountId)
        .single();
      
      if (fetchError) {
        logger.error({ ...ctx, error: fetchError }, 'Error fetching recording for chunk upload');
        return Response.json({ error: 'Recording not found' }, { status: 404 });
      }
      
      if (!['recording', 'paused'].includes(recording.status)) {
        logger.warn({ ...ctx, currentStatus: recording.status }, 'Chunk upload attempted for recording in invalid state');
        return Response.json(
          { error: 'Recording is not in an active state' },
          { status: 400 }
        );
      }
      
      // 1. Parse the multipart form data to get the audio file and metadata
      const { chunkNumber, startTime, endTime, mimeType, audioFile } = await parseFormData(request);
      
      // Format chunk number with leading zeros (e.g., 0001, 0002, etc.)
      const paddedChunkNumber = chunkNumber.toString().padStart(4, '0');
      
      // Define the storage path: {account_id}/{recording_id}/chunk-{0-padded chunk number}.webm
      const storagePath = `${accountId}/${recordingId}/chunk-${paddedChunkNumber}.webm`;
      const storageBucket = 'recordings';
      
      logger.info({ 
        ...ctx, 
        accountId, 
        chunkNumber, 
        startTime, 
        endTime, 
        storagePath 
      }, 'Processing chunk upload');
      
      // 2. Upload the audio file to Supabase Storage
      const { data: uploadData, error: uploadError } = await client.storage
        .from(storageBucket)
        .upload(storagePath, audioFile, {
          contentType: mimeType || 'audio/webm',
          upsert: true // Overwrite if exists
        });
      
      if (uploadError) {
        logger.error({ ...ctx, error: uploadError }, 'Error uploading chunk to storage');
        return Response.json({ error: 'Failed to upload audio chunk' }, { status: 500 });
      }
      
      // 3. Create a record in the recordings_chunks table
      const { data: chunkData, error: insertError } = await client
        .from('recordings_chunks')
        .insert({
          recording_id: recordingId,
          account_id: accountId,
          chunk_number: chunkNumber,
          start_time: startTime,
          end_time: endTime,
          storage_bucket: storageBucket,
          storage_path: storagePath
        })
        .select('id')
        .single();
      
      if (insertError) {
        logger.error({ ...ctx, error: insertError }, 'Error inserting chunk record');
        return Response.json({ error: 'Failed to record chunk metadata' }, { status: 500 });
      }
      
      // Return success response with chunk ID
      return Response.json({
        chunkId: chunkData.id,
        status: 'success',
        message: 'Chunk uploaded successfully'
      });
    } catch (error) {
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message === 'Missing required chunk data') {
          logger.warn({ ...ctx, error: error.message }, 'Invalid chunk data received');
          return Response.json(
            { error: 'Invalid chunk data', details: error.message },
            { status: 400 }
          );
        }
      }
      
      // Log the full error for debugging
      logger.error({ 
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error, 
        ...ctx 
      }, 'Unexpected error processing chunk upload');
      
      // Return a user-friendly error message
      return Response.json(
        { 
          error: 'Failed to process audio chunk', 
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  },
  {
    auth: true
  }
);

// Helper function to parse multipart form data
async function parseFormData(request: Request) {
  const formData = await request.formData();
  
  // Extract metadata
  const chunkNumber = parseInt(formData.get('chunkNumber') as string, 10);
  const startTime = parseFloat(formData.get('startTime') as string);
  const endTime = parseFloat(formData.get('endTime') as string);
  const mimeType = formData.get('mimeType') as string;
  
  // Get the audio file
  const audioFile = formData.get('audio') as File;
  
  if (!audioFile || !chunkNumber || isNaN(startTime) || isNaN(endTime)) {
    throw new Error('Missing required chunk data');
  }
  
  return {
    chunkNumber,
    startTime,
    endTime,
    mimeType,
    audioFile
  };
}
