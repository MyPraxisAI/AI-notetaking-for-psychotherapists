'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Checkbox } from '@kit/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Trans } from '@kit/ui/trans';
import { toast } from 'sonner';

// ApproachTag component to avoid hooks errors
const ApproachTag = ({ 
  approach,
  therapeuticApproaches,
  onRemove
}: { 
  approach: string;
  therapeuticApproaches: Array<{ id: string; name: string; title: string }>;
  onRemove: (approach: string) => void;
}) => {
  const { t } = useTranslation();
  // Find the approach by ID instead of name
  const approachData = therapeuticApproaches.find(a => a.id === approach);
  const approachLabel = approachData ? t(`mypraxis:therapeuticApproaches.${approachData.name}`, { 
    defaultValue: approachData.title || approachData.name 
  }) : approach;
  
  return (
    <div 
      key={approach} 
      className="flex items-center bg-muted rounded-full px-3 py-1 text-sm"
    >
      <span>{approachLabel}</span>
      <X 
        className="ml-2 h-4 w-4 cursor-pointer hover:text-destructive" 
        onClick={() => onRemove(approach)}
      />
    </div>
  );
};

// GeoLocalitiesOptions component to avoid hooks errors
const GeoLocalitiesOptions = ({ 
  geoLocalities 
}: { 
  geoLocalities: Array<{ id: string; name: string }>;
}) => {
  const { t } = useTranslation();
  
  // Create a sorted copy of the localities
  const sortedLocalities = [...geoLocalities].sort((a, b) => {
    // Always put 'other' at the end
    if (a.name === 'other') return 1;
    if (b.name === 'other') return -1;
    
    // Sort by translated values
    const aTranslated = t(`mypraxis:geoLocalities.${a.name}`, { defaultValue: a.name });
    const bTranslated = t(`mypraxis:geoLocalities.${b.name}`, { defaultValue: b.name });
    return aTranslated.localeCompare(bTranslated);
  });
  
  return sortedLocalities.map(locality => (
    <SelectItem key={locality.id} value={locality.id}>
      <Trans
        i18nKey={`mypraxis:geoLocalities.${locality.name}`}
        values={{ defaultValue: locality.name }}
      />
    </SelectItem>
  ));
};

// ApproachOptions component to avoid hooks errors
const ApproachOptions = ({ 
  therapeuticApproaches, 
  primaryApproach, 
  secondaryApproaches 
}: { 
  therapeuticApproaches: Array<{ id: string; name: string; title: string }>;
  primaryApproach: string; 
  secondaryApproaches: string[]; 
}) => {
  const { t } = useTranslation();
  
  // Create a sorted copy of the approaches
  const sortedApproaches = [...therapeuticApproaches]
    .filter(approach => 
      approach.id !== primaryApproach && 
      !secondaryApproaches.includes(approach.id)
    )
    .sort((a, b) => {
      // Always put 'other' at the end
      if (a.name === 'other') return 1;
      if (b.name === 'other') return -1;
      
      // Sort by translated values
      const aTranslated = t(`mypraxis:therapeuticApproaches.${a.name}`, { defaultValue: a.title });
      const bTranslated = t(`mypraxis:therapeuticApproaches.${b.name}`, { defaultValue: b.title });
      return aTranslated.localeCompare(bTranslated);
    });
  
  return sortedApproaches.map(approach => (
    <SelectItem key={approach.id} value={approach.id}>
      <Trans
        i18nKey={`mypraxis:therapeuticApproaches.${approach.name}`}
        values={{ defaultValue: approach.title }}
      />
    </SelectItem>
  ));
};

// Import schemas from shared file
import { 
  TherapistProfileSchema, 
  UserPreferencesSchema, 
  TherapistProfileData, 
  UserPreferencesData 
} from '../_lib/schemas';

// Define the form schemas using the imported schemas
const professionalInfoFormSchema = TherapistProfileSchema;
type ProfessionalInfoFormValues = TherapistProfileData;

const preferencesFormSchema = UserPreferencesSchema;
type PreferencesFormValues = UserPreferencesData;

// Custom hooks for fetching reference data
function useTherapeuticApproaches() {
  const [data, setData] = useState<{ id: string; name: string; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTherapeuticApproaches = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/reference/therapeutic-approaches');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch therapeutic approaches: ${response.status}`);
        }
        
        const approaches = await response.json();
        setData(approaches);
      } catch (err) {
        console.error('Error fetching therapeutic approaches:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTherapeuticApproaches();
  }, []);

  return { data, isLoading, error };
}

function useGeoLocalities() {
  const [data, setData] = useState<{ id: string; name: string; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchGeoLocalities = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/reference/geo-localities');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch geo localities: ${response.status}`);
        }
        
        const localities = await response.json();
        setData(localities);
      } catch (err) {
        console.error('Error fetching geo localities:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchGeoLocalities();
  }, []);

  return { data, isLoading, error };
}

// Import hooks for data fetching and mutations
import { useUpdateUserPreferences, useUserPreferences } from '../_lib/hooks/use-user-preferences';
import { useUpdateTherapistProfile, useTherapistProfile } from '../_lib/hooks/use-therapist-profile';

// This function is no longer needed as we're using the hook directly

export function EnhancedSettingsContainer(props: {
  userId: string;
  features: {
    enableAccountDeletion: boolean;
    enablePasswordUpdate: boolean;
  };
  paths: {
    callback: string;
  };
}) {
  const [activeTab, setActiveTab] = useState('account');
  const [isPending, _startTransition] = useTransition();
  const { i18n } = useTranslation();
  
  // Get available languages from i18n
  const [availableLanguages, setAvailableLanguages] = useState<{code: string, name: string}[]>([]);
  
  useEffect(() => {
    // Get languages from i18n
    const languages = (i18n?.options?.supportedLngs as string[]) ?? [];
    
    // Filter out special language codes like 'cimode'
    const supportedLanguages = languages.filter(lang => lang !== 'cimode');
    
    // Map language codes to language names
    const languageOptions = supportedLanguages.map(code => {
      // Map language codes to human-readable names
      const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'ru': 'Русский',
      };
      
      return {
        code,
        name: languageNames[code] || code,
      };
    });
    
    setAvailableLanguages(languageOptions);
  }, [i18n]);
  
  // Use hooks for data fetching
  const { data: professionalInfo, isLoading: isLoadingProfessionalInfo } = useTherapistProfile();
  const { data: userPreferences, isLoading: isLoadingPreferences } = useUserPreferences();
  
  // Fetch reference data
  const { 
    data: therapeuticApproaches, 
    isLoading: _isLoadingApproaches 
  } = useTherapeuticApproaches();
  
  const { 
    data: geoLocalities, 
    isLoading: _isLoadingLocalities 
  } = useGeoLocalities();

  // Update forms when data is loaded
  useEffect(() => {
    // This will be handled by the form reset effects below
  }, [professionalInfo, userPreferences]);

  const professionalInfoForm = useForm<ProfessionalInfoFormValues>({
    resolver: zodResolver(professionalInfoFormSchema),
    defaultValues: {
      fullName: '',
      credentials: '',
      geoLocality: '',
      primaryTherapeuticApproach: '',
      secondaryTherapeuticApproaches: [],
    },
  });

  const preferencesForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      use24HourClock: true,
      useUsDateFormat: false,
      language: 'en',
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (professionalInfo) {
      professionalInfoForm.reset({
        fullName: professionalInfo.fullName || '',
        credentials: professionalInfo.credentials || '',
        geoLocality: professionalInfo.geoLocality || '',
        primaryTherapeuticApproach: professionalInfo.primaryTherapeuticApproach || '',
        secondaryTherapeuticApproaches: professionalInfo.secondaryTherapeuticApproaches || [],
      });
    }
  }, [professionalInfo, professionalInfoForm]);

  useEffect(() => {
    if (userPreferences) {
      preferencesForm.reset({
        use24HourClock: userPreferences.use24HourClock ?? true,
        useUsDateFormat: userPreferences.useUsDateFormat ?? false,
        language: userPreferences.language ?? 'en',
      });
    }
  }, [userPreferences, preferencesForm]);

  // Handle professional info form submission using the client-side mutation hook
  const updateTherapistProfileMutation = useUpdateTherapistProfile();
  
  const onProfessionalInfoSubmit = (data: ProfessionalInfoFormValues) => {
    const promise = updateTherapistProfileMutation.mutateAsync(data);
    
    toast.promise(promise, {
      loading: 'Saving professional information...',
      success: 'Your professional information has been updated successfully.',
      error: (error) => `Failed to update professional information: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  };

  // Handle preferences form submission using the client-side mutation hook
  const updatePreferencesMutation = useUpdateUserPreferences();
  
  const onPreferencesSubmit = (data: PreferencesFormValues) => {
    const promise = updatePreferencesMutation.mutateAsync(data);
    
    toast.promise(promise, {
      loading: 'Saving preferences...',
      success: 'Your preferences have been updated successfully.',
      error: (error) => `Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  };

  return (
    <Tabs defaultValue="account" value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid grid-cols-3 mb-8">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="profile">Professional Information</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
      </TabsList>
      
      <TabsContent value="account">
        <PersonalAccountSettingsContainer 
          userId={props.userId}
          features={{
            enableAccountDeletion: false,
            enablePasswordUpdate: true,
          }}
          paths={{
            callback: '/home/settings',
          }}
        />
      </TabsContent>
      
      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans i18nKey="account:professionalInfo">
                Professional Information
              </Trans>
            </CardTitle>
            <CardDescription>
              <Trans i18nKey="account:professionalInfoDescription">
                Update your professional information
              </Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProfessionalInfo ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Form {...professionalInfoForm}>
                <form onSubmit={professionalInfoForm.handleSubmit(onProfessionalInfoSubmit)} className="space-y-6">
                  <FormField
                    control={professionalInfoForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Dr. Jane Smith" {...field} />
                        </FormControl>
                        <FormDescription>
                          Your full professional name as it will appear to clients
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={professionalInfoForm.control}
                    name="credentials"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Professional Credentials</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. LCSW, LMFT or psychotherapist" {...field} />
                        </FormControl>
                        <FormDescription>
                          The way you&apos;ll be introduced
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={professionalInfoForm.control}
                    name="geoLocality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Geographic Locality</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a country or territory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <GeoLocalitiesOptions geoLocalities={geoLocalities} />
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Your geographic location for regulatory compliance and local service provision
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={professionalInfoForm.control}
                    name="primaryTherapeuticApproach"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Therapeutic Approach</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            // Update primary approach
                            field.onChange(value);
                            
                            // Remove from secondary approaches if it's there
                            const secondaryApproaches = professionalInfoForm.getValues().secondaryTherapeuticApproaches || [];
                            if (secondaryApproaches.includes(value)) {
                              const updatedSecondary = secondaryApproaches.filter(a => a !== value);
                              professionalInfoForm.setValue('secondaryTherapeuticApproaches', updatedSecondary);
                            }
                          }} 
                          defaultValue={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your primary approach" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <ApproachOptions 
                              therapeuticApproaches={therapeuticApproaches} 
                              primaryApproach={field.value || ''} 
                              secondaryApproaches={[]} 
                            />
                          
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Secondary Therapeutic Approaches */}
                  <FormField
                    control={professionalInfoForm.control}
                    name="secondaryTherapeuticApproaches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Therapeutic Approaches</FormLabel>
                        
                        {/* Display selected approaches as tags */}
                        {field.value && field.value.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {field.value.map(approach => (
                              <ApproachTag
                                key={approach}
                                approach={approach}
                                therapeuticApproaches={therapeuticApproaches}
                                onRemove={(approachToRemove) => {
                                  const updatedApproaches = field.value?.filter(a => a !== approachToRemove) || [];
                                  field.onChange(updatedApproaches);
                                }}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* Dropdown for adding more approaches */}
                        <div className={(!field.value || field.value.length < 2) ? '' : 'hidden'}>
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (!value) return;
                              
                              // Don't add if it's the primary approach
                              const primaryApproach = professionalInfoForm.getValues().primaryTherapeuticApproach;
                              if (value === primaryApproach) return;
                              
                              // Don't add if already in secondary approaches
                              const currentApproaches = field.value || [];
                              if (currentApproaches.includes(value)) return;
                              
                              // Add to secondary approaches (up to 2)
                              if (currentApproaches.length < 2) {
                                field.onChange([...currentApproaches, value]);
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Add approach (up to 2)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Extract this to a separate component to avoid hook issues */}
                              <ApproachOptions 
                                therapeuticApproaches={therapeuticApproaches} 
                                primaryApproach={professionalInfoForm.watch('primaryTherapeuticApproach') || ''} 
                                secondaryApproaches={field.value || []} 
                              />
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <FormDescription>
                          Will be used to fine-tune AI reports
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isPending}>
                      {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="preferences">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans i18nKey="account:preferences">
                Preferences
              </Trans>
            </CardTitle>
            <CardDescription>
              <Trans i18nKey="account:preferencesDescription">
                Customize your user experience
              </Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPreferences ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Form {...preferencesForm}>
                <form
                  className="space-y-6"
                  onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)}
                >
                  <FormField
                    control={preferencesForm.control}
                    name="use24HourClock"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Use 24-hour clock
                          </FormLabel>
                          <FormDescription>
                            Display time in 24-hour format (e.g., 14:00) instead of 12-hour format (e.g., 2:00 PM)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={preferencesForm.control}
                    name="useUsDateFormat"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Use US date format
                          </FormLabel>
                          <FormDescription>
                            Display dates in MM/DD/YYYY format instead of DD/MM/YYYY
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={preferencesForm.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableLanguages.length > 0 ? (
                              availableLanguages.map(lang => (
                                <SelectItem key={lang.code} value={lang.code}>
                                  {lang.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="en">English</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Your preferred language for the application interface
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isPending}>
                      {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      

    </Tabs>
  );
}
