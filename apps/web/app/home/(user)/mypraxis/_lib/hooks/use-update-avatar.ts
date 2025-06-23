'use client';

import { useCallback, useState } from 'react';
import { AVATAR_UPDATED_EVENT } from './use-user-data';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useTranslation } from 'react-i18next';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppEvents } from '@kit/shared/events';
import type { AppEvents } from '~/lib/app-events';
import { useUser } from '@kit/supabase/hooks/use-user';

const AVATARS_BUCKET = 'account_image';

export function useUpdateAvatar() {
  const { t } = useTranslation();
  const client = useSupabase();
  const { user } = useUserWorkspace();
  const queryClient = useQueryClient();
  const { emit } = useAppEvents<AppEvents>();
  
  // Track the current picture URL in client state
  const [currentPictureUrl, setCurrentPictureUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);

  const updateAvatarMutation = useMutation({
    mutationFn: async ({ file, currentPictureUrl }: { file: File | null; currentPictureUrl: string | null }) => {
      if (!user) {
        throw new Error('User not found');
      }

      const removeExistingStorageFile = async () => {
        // If we have a currentPictureUrl, use it to delete the file
        if (currentPictureUrl) {
          try {
            await deleteProfilePhoto(client, currentPictureUrl);
          } catch {
            return Promise.resolve();
          }
        } else {
          // If currentPictureUrl is null, try to delete by user ID
          // This handles the case where a file exists but currentPictureUrl is null
          try {
            // We don't know the extension, so try to list files and delete any that match the user ID
            const bucket = client.storage.from(AVATARS_BUCKET);
            const { data: files } = await bucket.list();
            
            if (files) {
              const userFiles = files.filter(file => file.name.startsWith(user.id));
              
              for (const file of userFiles) {
                await bucket.remove([file.name]);
              }
            }
          } catch {
            return Promise.resolve();
          }
        }
      };

      if (file) {
        // Upload new file
        await removeExistingStorageFile();
        const pictureUrl = await uploadUserProfilePhoto(client, file, user.id);
        
        // Update user metadata
        await client.auth.updateUser({
          data: {
            avatar_url: pictureUrl,
          },
        });

        return pictureUrl;
      } else {
        // Remove existing file
        await removeExistingStorageFile();
        
        // Update user metadata
        await client.auth.updateUser({
          data: {
            avatar_url: null,
          },
        });

        return null;
      }
    },
    onSuccess: () => {
      // Invalidate both user data queries
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['mypraxis-user'] });

      emit({
        type: 'SettingsUpdated',
        payload: {
          field: 'avatar',
        },
      });
    },
  });

  const updateAvatar = useCallback(
    (file: File | null) => {
      toast.promise(
        async () => {
          const result = await updateAvatarMutation.mutateAsync({ file, currentPictureUrl });
          // Update our local state with the new URL
          setCurrentPictureUrl(result);
          
          // Dispatch a custom event to notify other components about the avatar update
          window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, {
            detail: { avatarUrl: result }
          }));
          
          return result;
        },
        {
          loading: t('hooks.avatar.updating'),
          success: t('hooks.avatar.success'),
          error: (err) => `${t('hooks.avatar.error')}: ${err.message}`,
        }
      );
    },
    [updateAvatarMutation, t, currentPictureUrl, emit]
  );

  return {
    updateAvatar,
    isLoading: updateAvatarMutation.isPending,
  };
}

async function deleteProfilePhoto(client: { storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<{ data: unknown; error: unknown }> } } }, url: string) {
  const bucket = client.storage.from(AVATARS_BUCKET);
  const fileName = url.split('/').pop()?.split('?')[0];

  if (!fileName) {
    return Promise.resolve();
  }
  
  try {
    return await bucket.remove([fileName]);
  } catch {
    return Promise.resolve();
  }
}

async function uploadUserProfilePhoto(
  client: { storage: { from: (bucket: string) => { upload: (path: string, data: ArrayBuffer) => Promise<{ data: unknown; error: unknown }>; getPublicUrl: (path: string) => { data: { publicUrl: string } } } } },
  photoFile: File,
  userId: string,
) {
  const bytes = await photoFile.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const extension = photoFile.name.split('.').pop();
  const fileName = await getAvatarFileName(userId, extension);

  // Exactly match the accounts package implementation - no upsert option
  const result = await bucket.upload(fileName, bytes);

  if (!result.error) {
    return bucket.getPublicUrl(fileName).data.publicUrl;
  }

  throw result.error;
}

async function getAvatarFileName(
  userId: string,
  extension: string | undefined,
) {
  // Generate a random string to use as a unique ID
  // This is similar to nanoid in the accounts package
  const uniqueId = Math.random().toString(36).substring(2, 18);
  
  return `${userId}.${extension}?v=${uniqueId}`;
}
