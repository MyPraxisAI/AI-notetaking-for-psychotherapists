'use client';

import { useState } from 'react';
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

// Define the form schema for the therapist profile
const therapistProfileSchema = z.object({
  credentials: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  primaryTherapeuticApproach: z.string().min(1, 'Primary therapeutic approach is required'),
  secondaryTherapeuticApproaches: z.array(z.string()).optional(),
  language: z.string().min(1, 'Language is required'),
});

// Define the form schema for the preferences
const preferencesSchema = z.object({
  use24HourClock: z.boolean(),
  useInternationalDateFormat: z.boolean(),
});

type TherapistProfileFormValues = z.infer<typeof therapistProfileSchema>;
type PreferencesFormValues = z.infer<typeof preferencesSchema>;

// Mock data for development - will be replaced with actual API calls
const mockTherapeuticApproaches = [
  { id: '1', name: 'cbt', title: 'Cognitive Behavioral Therapy (CBT)' },
  { id: '2', name: 'act', title: 'Acceptance and Commitment Therapy (ACT)' },
  { id: '3', name: 'dbt', title: 'Dialectical Behavior Therapy (DBT)' },
  { id: '4', name: 'eft', title: 'Emotion-Focused Therapy (EFT)' },
  { id: '5', name: 'psychodynamic', title: 'Psychodynamic Therapy' },
];

const mockGeoLocalities = [
  { id: '1', name: 'european_union', title: 'European Union' },
  { id: '2', name: 'united_states', title: 'United States' },
  { id: '3', name: 'canada', title: 'Canada' },
  { id: '4', name: 'united_kingdom', title: 'United Kingdom' },
  { id: '5', name: 'australia', title: 'Australia' },
  { id: '6', name: 'new_zealand', title: 'New Zealand' },
  { id: '7', name: 'russian_federation', title: 'Russian Federation' },
  { id: '8', name: 'other', title: 'Other' },
];

export function TherapistSettingsForm() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isPending, startTransition] = useTransition();
  
  // Initialize profile form with mock data
  const profileForm = useForm<TherapistProfileFormValues>({
    resolver: zodResolver(therapistProfileSchema),
    defaultValues: {
      credentials: '',
      country: 'united_states',
      primaryTherapeuticApproach: 'cbt',
      secondaryTherapeuticApproaches: [],
      language: 'en',
    },
  });

  // Initialize preferences form with mock data
  const preferencesForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      use24HourClock: true,
      useInternationalDateFormat: true,
    },
  });

  // Handle profile form submission
  const onProfileSubmit = (data: TherapistProfileFormValues) => {
    startTransition(async () => {
      // This will be replaced with actual API call
      console.log('Profile data submitted:', data);
      // Show success message
      alert('Profile updated successfully');
    });
  };

  // Handle preferences form submission
  const onPreferencesSubmit = (data: PreferencesFormValues) => {
    startTransition(async () => {
      // This will be replaced with actual API call
      console.log('Preferences data submitted:', data);
      // Show success message
      alert('Preferences updated successfully');
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-8">
        <TabsTrigger value="profile">
          <Trans i18nKey="settings:tabs.profile">Therapist Profile</Trans>
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
                {/* Credentials */}
                <FormField
                  control={profileForm.control}
                  name="credentials"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.credentials">Credentials</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country */}
                <FormField
                  control={profileForm.control}
                  name="country"
                  render={({ field }) => (
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
                          {mockGeoLocalities.map((locality) => (
                            <SelectItem key={locality.id} value={locality.name}>
                              <Trans i18nKey={`geo:${locality.name}`}>{locality.title}</Trans>
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
                  render={({ field }) => (
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
                          {mockTherapeuticApproaches.map((approach) => (
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

                {/* Secondary Therapeutic Approaches */}
                <FormField
                  control={profileForm.control}
                  name="secondaryTherapeuticApproaches"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey="settings:profile.secondaryApproaches">Secondary Therapeutic Approaches</Trans>
                      </FormLabel>
                      <div className="space-y-2">
                        {mockTherapeuticApproaches.map((approach) => {
                          // Skip if it's the primary approach
                          if (approach.name === profileForm.getValues().primaryTherapeuticApproach) {
                            return null;
                          }
                          
                          return (
                            <div key={approach.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`approach-${approach.name}`}
                                checked={field.value?.includes(approach.name)}
                                onCheckedChange={(checked) => {
                                  const currentValues = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValues, approach.name]);
                                  } else {
                                    field.onChange(
                                      currentValues.filter((value) => value !== approach.name)
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
                  render={({ field }) => (
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
