'use client';

import { useEffect, useState } from 'react';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

// Define a custom event name for avatar updates
export const AVATAR_UPDATED_EVENT = 'mypraxis:avatar-updated';

/**
 * Custom hook to fetch and manage user data with real-time updates
 * This ensures the user data is updated when the profile picture changes
 */
export function useUserData() {
  const { user: initialUser, workspace } = useUserWorkspace();
  
  // Keep a local state for the user data that can be updated immediately
  const [user, setUser] = useState(initialUser);

  // Listen for avatar update events
  useEffect(() => {
    // Update local state when the initial user changes
    if (initialUser) {
      setUser(initialUser);
    }

    // Handler for avatar update events
    const handleAvatarUpdated = (event: CustomEvent) => {
      const { avatarUrl } = event.detail;
      
      // Update the user data with the new avatar URL
      setUser(currentUser => {
        if (!currentUser) return currentUser;
        
        return {
          ...currentUser,
          user_metadata: {
            ...currentUser.user_metadata,
            avatar_url: avatarUrl
          }
        };
      });
    };

    // Add event listener
    window.addEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated as EventListener);
    };
  }, [initialUser]);

  // Function to manually refresh user data
  const refreshUserData = () => {
    // This would typically fetch fresh data, but we're using events instead
    // We keep this for API compatibility
  };

  return {
    user,
    workspace,
    isLoading: !user,
    refreshUserData,
  };
}
