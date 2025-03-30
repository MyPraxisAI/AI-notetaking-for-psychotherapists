'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

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
import { Textarea } from '@kit/ui/textarea';
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

// Define schemas (these should be imported from your schema files)
const ProfessionalInfoSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  credentials: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  primaryTherapeuticApproach: z.string().min(1, "Primary approach is required"),
  secondaryTherapeuticApproaches: z.array(z.string()).optional(),
});

const UserPreferencesSchema = z.object({
  use24HourClock: z.boolean(),
  useUsDateFormat: z.boolean(),
  language: z.string().min(1, "Language is required"),
});

// Define the form schemas
const professionalInfoFormSchema = ProfessionalInfoSchema;
type ProfessionalInfoFormValues = z.infer<typeof professionalInfoFormSchema>;

const preferencesFormSchema = UserPreferencesSchema;
type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

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

// Mock server actions (these should be imported from your action files)
async function updateProfessionalInfo(data: ProfessionalInfoFormValues) {
  const response = await fetch('/api/therapist/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update professional information');
  }
  
  return await response.json();
}

async function updateUserPreferences(data: PreferencesFormValues) {
  const response = await fetch('/api/user/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update user preferences');
  }
  
  return await response.json();
}

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
  const [isPending, startTransition] = useTransition();
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
  
  // Fetch professional information data
  const [professionalInfo, setProfessionalInfo] = useState<any>(null);
  const [isLoadingProfessionalInfo, setIsLoadingProfessionalInfo] = useState(true);
  
  // Fetch user preferences data
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  
  // Fetch reference data
  const { 
    data: therapeuticApproaches, 
    isLoading: isLoadingApproaches 
  } = useTherapeuticApproaches();
  
  const { 
    data: geoLocalities, 
    isLoading: isLoadingLocalities 
  } = useGeoLocalities();

  // Fetch professional information
  useEffect(() => {
    const fetchProfessionalInfo = async () => {
      try {
        const response = await fetch('/api/professional/info');
        if (response.ok) {
          const data = await response.json();
          setProfessionalInfo(data);
        }
      } catch (error) {
        console.error('Error fetching professional information:', error);
      } finally {
        setIsLoadingProfessionalInfo(false);
      }
    };

    fetchProfessionalInfo();
  }, []);

  // Fetch user preferences
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          setUserPreferences(data);
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
      } finally {
        setIsLoadingPreferences(false);
      }
    };

    fetchUserPreferences();
  }, []);

  const professionalInfoForm = useForm<ProfessionalInfoFormValues>({
    resolver: zodResolver(professionalInfoFormSchema),
    defaultValues: {
      fullName: '',
      credentials: '',
      country: '',
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
        country: professionalInfo.country || '',
        primaryTherapeuticApproach: professionalInfo.primaryTherapeuticApproach || '',
        secondaryTherapeuticApproaches: professionalInfo.secondaryTherapeuticApproaches || [],
      });
    }
  }, [professionalInfo, professionalInfoForm]);

  useEffect(() => {
    if (userPreferences) {
      preferencesForm.reset({
        use24HourClock: userPreferences.use24HourClock ?? true,
        useUsDateFormat: userPreferences.use_us_date_format ?? false,
        language: userPreferences.language ?? 'en',
      });
    }
  }, [userPreferences, preferencesForm]);

  const onProfessionalInfoSubmit = (data: ProfessionalInfoFormValues) => {
    startTransition(async () => {
      try {
        await updateProfessionalInfo(data);
        toast.success('Your professional information has been updated successfully.');
      } catch (error) {
        console.error('Error updating professional information:', error);
        toast.error(`Failed to update professional information: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  };

  const onPreferencesSubmit = (data: PreferencesFormValues) => {
    startTransition(async () => {
      try {
        await updateUserPreferences(data);
        toast.success('Your preferences have been updated successfully.');
      } catch (error) {
        console.error('Error updating preferences:', error);
        toast.error(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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
                        <FormLabel>Credentials</FormLabel>
                        <FormControl>
                          <Input placeholder="Ph.D., LMFT" {...field} />
                        </FormControl>
                        <FormDescription>
                          Your professional credentials and certifications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={professionalInfoForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(() => {
                              const { t } = useTranslation();
                              
                              // Create a sorted copy of the localities
                              const sortedLocalities = [...geoLocalities].sort((a, b) => {
                                // Always put 'other' at the end
                                if (a.name === 'other') return 1;
                                if (b.name === 'other') return -1;
                                
                                // Sort by translated values
                                const aTranslated = t(`mypraxis:geoLocalities.${a.name}`, { defaultValue: a.title });
                                const bTranslated = t(`mypraxis:geoLocalities.${b.name}`, { defaultValue: b.title });
                                return aTranslated.localeCompare(bTranslated);
                              });
                              
                              return sortedLocalities.map(country => (
                                <SelectItem key={country.id} value={country.name}>
                                  <Trans i18nKey={`mypraxis:geoLocalities.${country.name}`}>
                                    {country.title}
                                  </Trans>
                                </SelectItem>
                              ));
                            })()} 
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The country where you practice
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
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your primary approach" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(() => {
                              const { t } = useTranslation();
                              
                              // Create a sorted copy of the approaches
                              const sortedApproaches = [...therapeuticApproaches].sort((a, b) => {
                                // Always put 'other' at the end
                                if (a.name === 'other') return 1;
                                if (b.name === 'other') return -1;
                                
                                // Sort by translated values
                                const aTranslated = t(`mypraxis:therapeuticApproaches.${a.name}`, { defaultValue: a.title });
                                const bTranslated = t(`mypraxis:therapeuticApproaches.${b.name}`, { defaultValue: b.title });
                                return aTranslated.localeCompare(bTranslated);
                              });
                              
                              return sortedApproaches.map(approach => (
                                <SelectItem key={approach.id} value={approach.name}>
                                  <Trans i18nKey={`mypraxis:therapeuticApproaches.${approach.name}`}>
                                    {approach.title}
                                  </Trans>
                                </SelectItem>
                              ));
                            })()} 
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Your main therapeutic approach
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
                <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-6">
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
                          defaultValue={field.value}
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
