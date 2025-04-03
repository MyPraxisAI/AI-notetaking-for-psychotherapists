'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useTranslation } from 'react-i18next';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const AVATARS_BUCKET = 'account_image';

export function useUpdateAvatar() {
  const { t } = useTranslation();
  const client = useSupabase();
  const { user } = useUserWorkspace();
  const queryClient = useQueryClient();

  const updateAvatarMutation = useMutation({
    mutationFn: async ({ file, currentPictureUrl }: { file: File | null; currentPictureUrl: string | null }) => {
      if (!user) {
        throw new Error('User not found');
      }

      const removeExistingStorageFile = async () => {
        if (currentPictureUrl) {
          return deleteProfilePhoto(client, currentPictureUrl) ?? Promise.resolve();
        }
        return Promise.resolve();
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
      // Invalidate user data queries
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const updateAvatar = useCallback(
    (file: File | null, currentPictureUrl: string | null) => {
      toast.promise(
        () => updateAvatarMutation.mutateAsync({ file, currentPictureUrl }),
        {
          loading: t('Updating profile picture...'),
          success: t('Profile picture updated successfully'),
          error: (err) => `${t('Failed to update profile picture')}: ${err.message}`,
        }
      );
    },
    [updateAvatarMutation, t]
  );

  return {
    updateAvatar,
    isLoading: updateAvatarMutation.isPending,
  };
}

function deleteProfilePhoto(client: any, url: string) {
  const bucket = client.storage.from(AVATARS_BUCKET);
  const fileName = url.split('/').pop()?.split('?')[0];

  if (!fileName) {
    return;
  }

  return bucket.remove([fileName]);
}

async function uploadUserProfilePhoto(
  client: any,
  photoFile: File,
  userId: string,
) {
  const bytes = await photoFile.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const extension = photoFile.name.split('.').pop();
  const fileName = await getAvatarFileName(userId, extension);

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
  // Generate a random string for the version parameter
  const uniqueId = Math.random().toString(36).substring(2, 18);

  // we add a version to the URL to ensure
  // the browser always fetches the latest image
  return `${userId}.${extension}?v=${uniqueId}`;
}
