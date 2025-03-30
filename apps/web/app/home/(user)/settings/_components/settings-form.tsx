'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Checkbox } from '@kit/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Trans } from '@kit/ui/trans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
// Local toast implementation to fix TypeScript errors
interface ToastProps {
  title: string;
  description: string;
  variant?: 'default' | 'success' | 'error';
}

function useToast() {
  const toast = (props: ToastProps) => {
    console.log(`Toast: ${props.title} - ${props.description}`);
    // In a real implementation, this would show a toast notification
  };
  
  return { toast };
}

// Define types for user session and workspace
interface User {
  id: string;
  email?: string;
  user_metadata?: {
    avatar_url?: string;
  };
}

interface Workspace {
  id: string;
}

// Mock implementation of useUserSession hook
function useUserSession() {
  const [session, setSession] = useState<{ user: User } | null>(null);

  useEffect(() => {
    // In a real implementation, this would fetch the user from the server
    setSession({
      user: {
        id: 'user-id',
        email: 'user@example.com',
        user_metadata: {
          avatar_url: ''
        }
      }
    });
  }, []);

  return { data: session };
}

import { TherapistProfileSchema, updateTherapistProfileAction } from '../_lib/server/server-actions';
import { UserPreferencesSchema, updateUserPreferencesAction } from '../_lib/server/server-actions';
import { useTherapistProfile, TherapistProfileData } from '../_lib/hooks/use-therapist-profile';
import { useUserPreferences, UserPreferencesData } from '../_lib/hooks/use-user-preferences';
// Create custom hooks for fetching reference data
const useTherapeuticApproaches = () => {
  const [approaches, setApproaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchApproaches = async () => {
      try {
        const response = await fetch('/api/reference/therapeutic-approaches');
        const data = await response.json();
        setApproaches(data);
      } catch (error) {
        console.error('Error fetching therapeutic approaches:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchApproaches();
  }, []);
  
  return { data: approaches, isLoading: loading };
};

const useGeoLocalities = () => {
  const [localities, setLocalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchLocalities = async () => {
      try {
        const response = await fetch('/api/reference/geo-localities');
        const data = await response.json();
        setLocalities(data);
      } catch (error) {
        console.error('Error fetching geographic localities:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLocalities();
  }, []);
  
  return { data: localities, isLoading: loading };
};

// Define the form schema for the profile tab
const profileFormSchema = TherapistProfileSchema;
type ProfileFormValues = z.infer<typeof profileFormSchema>;

// Define the form schema for the preferences tab
const preferencesFormSchema = UserPreferencesSchema;
type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

export function SettingsForm() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isPending, startTransition] = useTransition();
  const { data: session } = useUserSession();
  const { toast } = useToast();
  
  // Fetch therapist profile data
  const { 
    data: therapistProfile, 
    isLoading: isLoadingProfile 
  } = useTherapistProfile();
  
  // Fetch user preferences data
  const { 
    data: userPreferences, 
    isLoading: isLoadingPreferences 
  } = useUserPreferences();
  
  // Fetch reference data
  const { 
    data: therapeuticApproaches, 
    isLoading: isLoadingApproaches 
  } = useTherapeuticApproaches();
  
  const { 
    data: geoLocalities, 
    isLoading: isLoadingLocalities 
  } = useGeoLocalities();

  // Initialize profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: '',
      credentials: '',
      country: '',
      primaryTherapeuticApproach: '',
      secondaryTherapeuticApproaches: [],
      language: 'en',
    },
  });

  // Initialize preferences form
  const preferencesForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      use24HourClock: true,
      useInternationalDateFormat: true,
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (therapistProfile) {
      profileForm.reset({
        fullName: therapistProfile.fullName,
        credentials: therapistProfile.credentials || '',
        country: therapistProfile.country,
        primaryTherapeuticApproach: therapistProfile.primaryTherapeuticApproach,
        secondaryTherapeuticApproaches: therapistProfile.secondaryTherapeuticApproaches || [],
        language: therapistProfile.language,
      });
    }
  }, [therapistProfile, profileForm]);

  useEffect(() => {
    if (userPreferences) {
      preferencesForm.reset({
        use24HourClock: userPreferences.use24HourClock,
        useInternationalDateFormat: userPreferences.useInternationalDateFormat,
      });
    }
  }, [userPreferences, preferencesForm]);

  // Handle profile form submission
  const onProfileSubmit = (data: ProfileFormValues) => {
    startTransition(async () => {
      try {
        await updateTherapistProfileAction(data);
        toast({
          title: 'Profile updated',
          description: 'Your therapist profile has been updated successfully.',
          variant: 'success',
        });
      } catch (error) {
        console.error('Error updating profile:', error);
        toast({
          title: 'Update failed',
          description: `Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'error',
        });
      }
    });
  };

  // Handle preferences form submission
  const onPreferencesSubmit = (data: PreferencesFormValues) => {
    startTransition(async () => {
      try {
        await updateUserPreferencesAction(data);
        toast({
          title: 'Preferences updated',
          description: 'Your preferences have been updated successfully.',
          variant: 'success',
        });
      } catch (error) {
        console.error('Error updating preferences:', error);
        toast({
          title: 'Update failed',
          description: `Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'error',
        });
      }
    });
  };

  // Loading state
  if (isLoadingProfile || isLoadingPreferences || isLoadingApproaches || isLoadingLocalities) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-8">
        <TabsTrigger value="profile">
          <Trans i18nKey="settings:tabs.profile">Profile</Trans>
        </TabsTrigger>
        <TabsTrigger value="preferences">
          <Trans i18nKey="settings:tabs.preferences">Preferences</Trans>
        </TabsTrigger>
      </TabsList>

      {/* Profile Tab */}
      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans i18nKey="settings:profile.title">Therapist Profile</Trans>
            </CardTitle>
            <CardDescription>
              <Trans i18nKey="settings:profile.description">
                Manage your therapist profile information
              </Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center space-x-4 mb-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={session?.user?.user_metadata?.avatar_url || ''} alt={session?.user?.email || ''} />
                    <AvatarFallback>{session?.user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-medium">{session?.user?.email}</h3>
                    <p className="text-sm text-muted-foreground">
                      <Trans i18nKey="settings:profile.avatarNote">
                        Your avatar is managed through your authentication provider
                      </Trans>
                    </p>
                  </div>
                </div>

                {/* Full Name */}
                <FormField
                  control={profileForm.control}
                  name="fullName"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.fullName">Full Name</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Credentials */}
                <FormField
                  control={profileForm.control}
                  name="credentials"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.credentials">Credentials</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country */}
                <FormField
                  control={profileForm.control}
                  name="country"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.country">Country</Trans>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {geoLocalities?.map((locality) => (
                            <SelectItem key={locality.id} value={locality.name}>
                              <Trans i18nKey={`geo:${locality.name}`}>{locality.name}</Trans>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Primary Therapeutic Approach */}
                <FormField
                  control={profileForm.control}
                  name="primaryTherapeuticApproach"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.primaryApproach">Primary Therapeutic Approach</Trans>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an approach" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {therapeuticApproaches?.map((approach) => (
                            <SelectItem key={approach.id} value={approach.name}>
                              <Trans i18nKey={`approaches:${approach.name}`}>{approach.title}</Trans>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Secondary Therapeutic Approaches - TODO: Implement multi-select */}
                <FormField
                  control={profileForm.control}
                  name="secondaryTherapeuticApproaches"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.secondaryApproaches">Secondary Therapeutic Approaches</Trans>
                      </FormLabel>
                      <div className="space-y-2">
                        {therapeuticApproaches?.map((approach) => {
                          // Skip if it's the primary approach
                          if (approach.name === profileForm.getValues().primaryTherapeuticApproach) {
                            return null;
                          }
                          
                          return (
                            <div key={approach.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`approach-${approach.name}`}
                                checked={field.value?.includes(approach.name)}
                                onCheckedChange={(checked: boolean) => {
                                  const currentValues = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValues, approach.name]);
                                  } else {
                                    field.onChange(
                                      currentValues.filter((value: string) => value !== approach.name)
                                    );
                                  }
                                }}
                              />
                              <label
                                htmlFor={`approach-${approach.name}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                <Trans i18nKey={`approaches:${approach.name}`}>{approach.title}</Trans>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Language */}
                <FormField
                  control={profileForm.control}
                  name="language"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.language">Language</Trans>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="ru">Russian</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      <Trans i18nKey="common:saving">Saving...</Trans>
                    </>
                  ) : (
                    <Trans i18nKey="common:saveChanges">Save Changes</Trans>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Preferences Tab */}
      <TabsContent value="preferences">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans i18nKey="settings:preferences.title">User Preferences</Trans>
            </CardTitle>
            <CardDescription>
              <Trans i18nKey="settings:preferences.description">
                Customize your application experience
              </Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...preferencesForm}>
              <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-6">
                {/* Time Format */}
                <FormField
                  control={preferencesForm.control}
                  name="use24HourClock"
                  render={({ field }: { field: any }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          <Trans i18nKey="settings:preferences.use24HourClock">Use 24-hour clock</Trans>
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          <Trans i18nKey="settings:preferences.use24HourClockDescription">
                            Display time in 24-hour format (e.g., 14:30) instead of 12-hour format (e.g., 2:30 PM)
                          </Trans>
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Date Format */}
                <FormField
                  control={preferencesForm.control}
                  name="useInternationalDateFormat"
                  render={({ field }: { field: any }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          <Trans i18nKey="settings:preferences.useInternationalDateFormat">Use international date format</Trans>
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          <Trans i18nKey="settings:preferences.useInternationalDateFormatDescription">
                            Display dates in DD/MM/YYYY format instead of MM/DD/YYYY
                          </Trans>
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      <Trans i18nKey="common:saving">Saving...</Trans>
                    </>
                  ) : (
                    <Trans i18nKey="common:saveChanges">Save Changes</Trans>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
