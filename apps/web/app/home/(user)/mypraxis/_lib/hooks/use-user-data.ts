'use client';

import { useEffect, useState } from 'react';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

// Define custom event names for profile updates
export const AVATAR_UPDATED_EVENT = 'mypraxis:avatar-updated';
export const NAME_UPDATED_EVENT = 'mypraxis:name-updated';

/**
 * Custom hook to fetch and manage user data with real-time updates
 * This ensures the user data is updated when the profile picture changes
 */
export function useUserData() {
  const { user: initialUser, workspace } = useUserWorkspace();
  
  // Keep a local state for the user data that can be updated immediately
  const [user, setUser] = useState(initialUser);
  
  // Track if we've fully loaded the user data
  const [isDataReady, setIsDataReady] = useState(false);
  
  // Track if we're still waiting for the initial user data
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Handle initial user data loading
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      setIsInitialLoading(false);
      
      // Set a small delay before considering the data fully ready
      // This prevents the flash of default values
      const timer = setTimeout(() => {
        setIsDataReady(true);
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [initialUser]);

  // Listen for profile update events (avatar and name)
  useEffect(() => {
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
    
    // Handler for name update events
    const handleNameUpdated = (event: CustomEvent) => {
      const { fullName } = event.detail;
      
      // Update the user data with the new name
      setUser(currentUser => {
        if (!currentUser) return currentUser;
        
        return {
          ...currentUser,
          user_metadata: {
            ...currentUser.user_metadata,
            name: fullName,
            full_name: fullName
          }
        };
      });
    };

    // Add event listeners
    window.addEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated as EventListener);
    window.addEventListener(NAME_UPDATED_EVENT, handleNameUpdated as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated as EventListener);
      window.removeEventListener(NAME_UPDATED_EVENT, handleNameUpdated as EventListener);
    };
  }, []);

  // Function to manually refresh user data
  const refreshUserData = () => {
    // This would typically fetch fresh data, but we're using events instead
    // We keep this for API compatibility
  };

  return {
    user,
    workspace,
    isLoading: isInitialLoading,
    isDataReady,
    refreshUserData,
  };
}
