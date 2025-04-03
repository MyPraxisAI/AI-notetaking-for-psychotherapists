"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@kit/ui/input"
import { Label } from "@kit/ui/label"
import { Check } from "lucide-react"
import { Textarea } from "@kit/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@kit/ui/select"
import { Checkbox } from "@kit/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@kit/ui/avatar"
import { Button } from "@kit/ui/button"
import { toast } from "sonner"

// Import our custom hooks for user preferences and therapist profile
import { useMyPraxisUserPreferences, useUpdatePreferenceField } from "../../app/home/(user)/mypraxis/_lib/hooks/use-user-preferences"
import { useMyPraxisTherapistProfile, useUpdateTherapistField } from "../../app/home/(user)/mypraxis/_lib/hooks/use-therapist-profile"
import { GeoLocalitiesSelect } from "./geo-localities-select"
import { TherapeuticApproachesSelect } from "./therapeutic-approaches-select"
import { useTranslation } from "react-i18next"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kit/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { X } from "lucide-react"
import { Menu } from "lucide-react"

// Define the settings interface
interface TherapistSettings {
  fullName: string;
  email: string;
  avatar: string;
  credentials: string;
  country: string;
  primaryTherapeuticApproach: string;
  secondaryTherapeuticApproaches: string[];
  language: string;
  use24HourClock: boolean;
  useUSDateFormat: boolean;
  password?: string;
}

// Define the component props
interface SettingsFormProps {
  therapistSettings?: TherapistSettings;
  onSettingsChange?: (settings: TherapistSettings) => void;
  setIsNavVisible?: (isVisible: boolean) => void;
}

// Define the countries list
const countries = [
  { value: "eu", label: "European Union" },
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "uk", label: "United Kingdom" },
  { value: "nz", label: "New Zealand" },
  { value: "au", label: "Australia" },
  { value: "ru", label: "Russian Federation" },
  { value: "other", label: "Other" },
];

// Define the therapeutic approaches
const therapeuticApproaches = [
  { value: "act", label: "Acceptance and Commitment Therapy (ACT)" },
  { value: "cbt", label: "Cognitive Behavioral Therapy (CBT)" },
  { value: "dbt", label: "Dialectical Behavior Therapy (DBT)" },
  { value: "emdr", label: "Eye Movement Desensitization and Reprocessing (EMDR)" },
  { value: "eft", label: "Emotionally Focused Therapy (EFT)" },
  { value: "fst", label: "Family Systems Therapy" },
  { value: "gt", label: "Gestalt Therapy" },
  { value: "ifs", label: "Internal Family Systems (IFS)" },
  { value: "ipt", label: "Interpersonal Therapy (IPT)" },
  { value: "ja", label: "Jungian Analysis" },
  { value: "mbct", label: "Mindfulness-Based Cognitive Therapy (MBCT)" },
  { value: "mi", label: "Motivational Interviewing" },
  { value: "nt", label: "Narrative Therapy" },
  { value: "pct", label: "Person-Centered (Rogerian) Therapy" },
  { value: "pa", label: "Psychoanalysis" },
  { value: "pdt", label: "Psychodynamic Therapy" },
  { value: "sfbt", label: "Solution-Focused Brief Therapy (SFBT)" },
];

// Define the languages
const languages = [
  { value: "en", label: "English" },
  { value: "ru", label: "Russian" },
];

export function SettingsForm({ therapistSettings, onSettingsChange, setIsNavVisible }: SettingsFormProps) {
  const { t } = useTranslation();
  
  // Fetch user preferences from Supabase
  const userPreferencesQuery = useMyPraxisUserPreferences();
  const updatePreferenceField = useUpdatePreferenceField();
  
  // Fetch therapist profile from Supabase
  const therapistProfileQuery = useMyPraxisTherapistProfile();
  const updateTherapistFieldMutation = useUpdateTherapistField();
  
  // Extract data and loading state from the queries
  const preferences = userPreferencesQuery.data;
  const isLoadingPreferences = userPreferencesQuery.isLoading;
  
  const therapistProfile = therapistProfileQuery.data;
  const isLoadingTherapistProfile = therapistProfileQuery.isLoading;
  
  // State for settings
  const [settings, setSettings] = useState<TherapistSettings>(() => {
    // Try to load from localStorage first for non-preference fields
    const savedSettings = localStorage.getItem("therapistSettings");
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    
    // If props are provided, use them
    if (therapistSettings) {
      return therapistSettings;
    }
    
    // Default settings
    return {
      fullName: "",
      email: "",
      avatar: "",
      credentials: "",
      country: "",
      primaryTherapeuticApproach: "",
      secondaryTherapeuticApproaches: [],
      language: "en",
      use24HourClock: false,
      useUSDateFormat: false,
    };
  });

  // State for validation
  const [validation, setValidation] = useState({
    email: true,
    passwordMatch: true,
  });

  // State for saved fields
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  
  // State for saved values
  const [savedValues, setSavedValues] = useState<TherapistSettings>({
    fullName: "",
    email: "",
    avatar: "",
    credentials: "",
    country: "",
    primaryTherapeuticApproach: "",
    secondaryTherapeuticApproaches: [],
    language: "en",
    use24HourClock: false,
    useUSDateFormat: false,
    password: "",
  });

  // State for password confirmation
  const [confirmPassword, setConfirmPassword] = useState("");

  // Refs for input fields
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const credentialsRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Timeout refs for saved fields
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings from localStorage for non-preference fields
  useEffect(() => {
    const savedSettings = localStorage.getItem("therapistSettings");
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      // Don't overwrite preference fields that will come from Supabase
      const { language, use24HourClock, useUSDateFormat, ...nonPreferenceFields } = parsedSettings;
      setSettings(prevSettings => ({
        ...prevSettings,
        ...nonPreferenceFields
      }));
      setSavedValues(prevValues => ({
        ...prevValues,
        ...nonPreferenceFields
      }));
    }
  }, []);
  
  // Update settings when preferences are loaded from Supabase
  useEffect(() => {
    if (preferences) {
      setSettings(prevSettings => ({
        ...prevSettings,
        language: preferences.language,
        use24HourClock: preferences.use24HourClock,
        useUSDateFormat: preferences.useUSDateFormat
      }));
      setSavedValues(prevValues => ({
        ...prevValues,
        language: preferences.language,
        use24HourClock: preferences.use24HourClock,
        useUSDateFormat: preferences.useUSDateFormat
      }));
    }
  }, [preferences]);
  
  // Update settings when therapist profile is loaded from Supabase
  useEffect(() => {
    if (therapistProfile) {
      setSettings(prevSettings => ({
        ...prevSettings,
        fullName: therapistProfile.fullName,
        credentials: therapistProfile.credentials || '',
        country: therapistProfile.country,
        primaryTherapeuticApproach: therapistProfile.primaryTherapeuticApproach,
        secondaryTherapeuticApproaches: therapistProfile.secondaryTherapeuticApproaches || []
      }));
      setSavedValues(prevValues => ({
        ...prevValues,
        fullName: therapistProfile.fullName,
        credentials: therapistProfile.credentials || '',
        country: therapistProfile.country,
        primaryTherapeuticApproach: therapistProfile.primaryTherapeuticApproach,
        secondaryTherapeuticApproaches: therapistProfile.secondaryTherapeuticApproaches || []
      }));
    }
  }, [therapistProfile]);

  // Validate email
  const isValidEmail = (email: string) => {
    // Allow empty email
    if (!email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const field = name || e.target.id; // Use name or id as the field name
    
    const updatedSettings = {
      ...settings,
      [field]: value,
    };
    
    setSettings(updatedSettings);
    
    // Call the onSettingsChange prop if provided
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  // Handle input blur
  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: string,
    isEmail = false,
  ) => {
    const value = e.target.value;
    
    // Validate email
    if (isEmail && value && !isValidEmail(value)) {
      setValidation((prev) => ({ ...prev, email: false }));
      return;
    }
    
    if (isEmail) {
      setValidation((prev) => ({ ...prev, email: true }));
    }
    
    // For therapist profile fields, use Supabase
    if (field === 'fullName' || field === 'credentials') {
      // Save to Supabase
      const promise = updateTherapistFieldMutation.updateField(field, value);
      
      toast.promise(promise, {
        loading: `Saving ${field === 'fullName' ? 'name' : 'credentials'}...`,
        success: `${field === 'fullName' ? 'Name' : 'Credentials'} saved successfully`,
        error: (error) => `Failed to save ${field}: ${error.message}`
      });
      
      promise.then(() => {
        // Show checkmark
        setSavedFields((prev) => new Set(prev).add(field));
        
        // Clear checkmark after 1 second
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }
        saveTimeout.current = setTimeout(() => {
          setSavedFields((prev) => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
          });
        }, 1000);
        
        // Update saved values
        setSavedValues((prev) => ({
          ...prev,
          [field]: value,
        }));
      });
    } else {
      // For other fields, use localStorage
      saveField(field, value);
    }
  };

  // Save field
  const saveField = (field: string, value: string | boolean) => {
    // Don't save if value hasn't changed
    if (savedValues[field as keyof TherapistSettings] === value) {
      return; // Don't save or show checkmark if no change
    }
    
    const updatedSettings = {
      ...settings,
      [field]: value,
    };
    
    setSettings(updatedSettings);
    
    // Save to localStorage
    localStorage.setItem("therapistSettings", JSON.stringify(updatedSettings));
    
    // Update saved values
    setSavedValues((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // Show checkmark
    setSavedFields((prev) => new Set(prev).add(field));
    
    // Clear checkmark after 1 second
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = setTimeout(() => {
      setSavedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(field);
        return newSet;
      });
    }, 1000);
    
    // Call the onSettingsChange prop if provided
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  // Handle password confirm blur
  const handlePasswordConfirmBlur = () => {
    const isMatch = settings.password === confirmPassword;
    setValidation((prev) => ({ ...prev, passwordMatch: isMatch }));
    
    if (isMatch && settings.password) {
      saveField("password", settings.password);
    }
  };

  // Handle key down event for Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, currentField: string) => {
    if (e.key === "Enter") {
      e.preventDefault();

      // Save the current field value
      const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
      
      // For email field, validate first
      if (currentField === "email") {
        setValidation((prev) => ({ ...prev, email: isValidEmail(value) }));
        if (!isValidEmail(value)) return;
      }
      
      // For password confirmation field, validate match
      if (currentField === "confirmPassword") {
        const isMatch = settings.password === confirmPassword;
        setValidation((prev) => ({ ...prev, passwordMatch: isMatch }));
        if (!isMatch) return;
      }
      
      // Save the field
      saveField(currentField, value);

      // Define the focus order
      const focusOrder: Record<string, () => void> = {
        fullName: () => emailRef.current?.focus(),
        email: () => document.getElementById('country')?.focus(), // Move to country dropdown
        credentials: () => document.getElementById('primaryTherapeuticApproach')?.focus(), // Move to primary therapeutic approach
      };

      // Focus the next field
      const focusFunction = focusOrder[currentField];
      if (focusFunction) focusFunction();
    }
  };

  // Handle select keydown for dropdowns
  const handleSelectKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentField: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      
      // Define the focus order for dropdowns
      const dropdownFocusOrder: Record<string, () => void> = {
        country: () => credentialsRef.current?.focus(), // Move to credentials field
        primaryTherapeuticApproach: () => document.getElementById('secondaryTherapeuticApproachesTrigger')?.focus(), // Move to secondary therapeutic approaches
        secondaryTherapeuticApproaches: () => document.getElementById('language')?.focus(), // Move to language dropdown
        language: () => document.getElementById('use24HourClock')?.focus(), // Move to the checkboxes
      };
      
      // Execute the focus function
      const focusFunction = dropdownFocusOrder[currentField];
      if (focusFunction) focusFunction();
    }
  };

  // Handle select change
  const handleSelectChange = (value: string, field: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // For language preference, use Supabase
    if (field === 'language') {
      // Save to Supabase
      const promise = updatePreferenceField.updatePreference(field, value);
      
      toast.promise(promise, {
        loading: 'Saving language preference...',
        success: 'Language preference saved',
        error: (error) => `Failed to save language preference: ${error.message}`
      });
      
      promise.then(() => {
        // Show checkmark
        setSavedFields((prev) => new Set(prev).add(field));
        
        // Clear checkmark after 1 second
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }
        saveTimeout.current = setTimeout(() => {
          setSavedFields((prev) => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
          });
        }, 1000);
        
        // Update saved values
        setSavedValues((prev) => ({
          ...prev,
          [field]: value,
        }));
      });
    }
    // For country field, use Supabase
    else if (field === 'country') {
      // Save to Supabase
      const promise = updateTherapistFieldMutation.updateField(field, value);
      
      toast.promise(promise, {
        loading: 'Saving country...',
        success: 'Country saved successfully',
        error: (error) => `Failed to save country: ${error.message}`
      });
      
      promise.then(() => {
        // Show checkmark
        setSavedFields((prev) => new Set(prev).add(field));
        
        // Clear checkmark after 1 second
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }
        saveTimeout.current = setTimeout(() => {
          setSavedFields((prev) => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
          });
        }, 1000);
        
        // Update saved values
        setSavedValues((prev) => ({
          ...prev,
          [field]: value,
        }));
      });
    } else {
      // For other fields, use localStorage
      saveField(field, value);
    }
  };

  // Handle primary therapeutic approach change
  const handlePrimaryApproachChange = (value: string) => {
    // Don't save if value hasn't changed
    if (savedValues.primaryTherapeuticApproach === value) {
      return;
    }
    
    const updatedSettings = {
      ...settings,
      primaryTherapeuticApproach: value,
      // Remove from secondary approaches if it was there
      secondaryTherapeuticApproaches: settings.secondaryTherapeuticApproaches.filter(a => a !== value)
    };
    
    setSettings(updatedSettings);
    
    // Save to Supabase
    const promise = updateTherapistFieldMutation.updateField('primaryTherapeuticApproach', value);
    
    toast.promise(promise, {
      loading: 'Saving primary therapeutic approach...',
      success: 'Primary therapeutic approach saved successfully',
      error: (error) => `Failed to save primary therapeutic approach: ${error.message}`
    });
    
    promise.then(() => {
      // Show checkmark
      setSavedFields((prev) => new Set(prev).add("primaryTherapeuticApproach"));
      
      // Clear checkmark after 1 second
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = setTimeout(() => {
        setSavedFields((prev) => {
          const newSet = new Set(prev);
          newSet.delete("primaryTherapeuticApproach");
          return newSet;
        });
      }, 1000);
      
      // Update saved values
      setSavedValues((prev) => ({
        ...prev,
        primaryTherapeuticApproach: value,
        secondaryTherapeuticApproaches: updatedSettings.secondaryTherapeuticApproaches
      }));
      
      // Call the onSettingsChange prop if provided
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
    });
  };

  // Handle secondary therapeutic approach addition
  const handleSecondaryApproachAdd = (approach: string) => {
    // Don't add if already at max (2)
    if (settings.secondaryTherapeuticApproaches.length >= 2) {
      return;
    }
    
    // Don't add if it's the primary approach
    if (approach === settings.primaryTherapeuticApproach) {
      return;
    }
    
    // Don't add if already in secondary approaches
    if (settings.secondaryTherapeuticApproaches.includes(approach)) {
      return;
    }
    
    const updatedApproaches = [...settings.secondaryTherapeuticApproaches, approach];
    
    const updatedSettings = {
      ...settings,
      secondaryTherapeuticApproaches: updatedApproaches,
    };
    
    setSettings(updatedSettings);
    
    // Save to Supabase
    const promise = updateTherapistFieldMutation.updateField('secondaryTherapeuticApproaches', updatedApproaches);
    
    toast.promise(promise, {
      loading: 'Saving therapeutic approaches...',
      success: 'Therapeutic approaches saved successfully',
      error: (error) => `Failed to save therapeutic approaches: ${error.message}`
    });
    
    promise.then(() => {
      // Update saved values
      setSavedValues((prev) => ({
        ...prev,
        secondaryTherapeuticApproaches: updatedApproaches,
      }));
  
      // Show checkmark
      setSavedFields((prev) => new Set(prev).add("secondaryTherapeuticApproaches"));
  
      // Clear checkmark after 1 second
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = setTimeout(() => {
        setSavedFields((prev) => {
          const newSet = new Set(prev);
          newSet.delete("secondaryTherapeuticApproaches");
          return newSet;
        });
      }, 1000);
    });
    
    // Call the onSettingsChange prop if provided
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };
  
  // Handle secondary therapeutic approach removal
  const handleSecondaryApproachRemove = (approach: string) => {
    const updatedApproaches = settings.secondaryTherapeuticApproaches.filter(a => a !== approach);
    
    const updatedSettings = {
      ...settings,
      secondaryTherapeuticApproaches: updatedApproaches,
    };
    
    setSettings(updatedSettings);
    
    // Save to Supabase
    const promise = updateTherapistFieldMutation.updateField('secondaryTherapeuticApproaches', updatedApproaches);
    
    toast.promise(promise, {
      loading: 'Updating therapeutic approaches...',
      success: 'Therapeutic approaches updated successfully',
      error: (error) => `Failed to update therapeutic approaches: ${error.message}`
    });
    
    promise.then(() => {
      // Update saved values
      setSavedValues((prev) => ({
        ...prev,
        secondaryTherapeuticApproaches: updatedApproaches,
      }));
      
      // Show checkmark
      setSavedFields((prev) => new Set(prev).add("secondaryTherapeuticApproaches"));
      
      // Clear checkmark after 1 second
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = setTimeout(() => {
        setSavedFields((prev) => {
          const newSet = new Set(prev);
          newSet.delete("secondaryTherapeuticApproaches");
          return newSet;
        });
      }, 1000);
    });
    
    // Call the onSettingsChange prop if provided
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (field: string, checked: boolean) => {
    // Don't save if value hasn't changed
    if (savedValues[field as keyof TherapistSettings] === checked) {
      return;
    }
    
    const updatedSettings = {
      ...settings,
      [field]: checked,
    };
    
    setSettings(updatedSettings);
    
    // For preference fields (use24HourClock and useUSDateFormat), use Supabase
    if (field === 'use24HourClock' || field === 'useUSDateFormat') {
      // Save to Supabase
      const promise = updatePreferenceField.updatePreference(field, checked);
      
      toast.promise(promise, {
        loading: `Saving ${field === 'use24HourClock' ? 'time format' : 'date format'} preference...`,
        success: `${field === 'use24HourClock' ? 'Time format' : 'Date format'} preference saved`,
        error: (error) => `Failed to save preference: ${error.message}`
      });
      
      promise.then(() => {
        // Show checkmark
        setSavedFields((prev) => new Set(prev).add(field));
        
        // Clear checkmark after 1 second
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }
        saveTimeout.current = setTimeout(() => {
          setSavedFields((prev) => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
          });
        }, 1000);
        
        // Update saved values
        setSavedValues((prev) => ({
          ...prev,
          [field]: checked,
        }));
      });
    } else {
      // For other fields, use localStorage
      // Save to localStorage
      localStorage.setItem("therapistSettings", JSON.stringify(updatedSettings));
      
      // Update saved values
      setSavedValues((prev) => ({
        ...prev,
        [field]: checked,
      }));
      
      // Show checkmark with appropriate color
      setSavedFields((prev) => new Set(prev).add(field));

      // Clear checkmark after 1 second
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = setTimeout(() => {
        setSavedFields((prev) => {
          const newSet = new Set(prev);
          newSet.delete(field);
          return newSet;
        });
      }, 1000);
    }
    
    // Call the onSettingsChange prop if provided
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  // Handle checkbox keydown
  const handleCheckboxKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentField: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      
      // Define the focus order for checkboxes
      const checkboxFocusOrder: Record<string, () => void> = {
        use24HourClock: () => document.getElementById('useUSDateFormat')?.focus(),
        useUSDateFormat: () => fullNameRef.current?.focus(), // Cycle back to the top
      };
      
      // Execute the focus function
      const focusFunction = checkboxFocusOrder[currentField];
      if (focusFunction) focusFunction();
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const avatarDataUrl = event.target?.result as string;
      setSettings((prev) => ({
        ...prev,
        avatar: avatarDataUrl,
      }));
      
      saveField("avatar", avatarDataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full px-6 pt-6 border-r border-[#E5E7EB] bg-white">
      {/* Burger menu icon above header */}
      <div className="mb-4">
        <Menu 
          className="h-5 w-5 text-gray-500 cursor-pointer hover:text-gray-700 transition-colors" 
          onClick={() => setIsNavVisible && setIsNavVisible(true)}
        />
      </div>
      
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em]">Settings</h2>
        </div>
      </div>
      
      {/* Profile Section */}
      <div className="mt-5 space-y-6 pb-6 border-b border-[#E5E7EB]">
        <h3 className="text-[18px] font-medium text-[#111827]">Profile</h3>
        
        {/* Avatar Upload */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="avatar" className="text-right">
              Photo
            </Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("avatar") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={settings.avatar} alt={settings.fullName} />
                <AvatarFallback className="bg-[#22C55E] text-white">{settings.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <Button 
              variant="secondary" 
              className="bg-[#22C55E] hover:bg-[#22C55E]/90 text-white"
              onClick={() => document.getElementById('avatar')?.click()}
            >
              Choose an image
            </Button>
            <Input 
              id="avatar" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarUpload} 
            />
          </div>
        </div>
        
        {/* Full Name */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="fullName" className="text-right">
              Full Name
            </Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("fullName") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <Input
            ref={fullNameRef}
            id="fullName"
            name="fullName"
            value={settings.fullName}
            onChange={handleInputChange}
            onBlur={(e) => handleBlur(e, "fullName")}
            onKeyDown={(e) => handleKeyDown(e, "fullName")}
            placeholder="Enter your full name"
            className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] w-full max-w-md"
          />
        </div>
        
        {/* Email */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("email") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            value={settings.email}
            onChange={handleInputChange}
            onBlur={(e) => handleBlur(e, "email", true)}
            onKeyDown={(e) => handleKeyDown(e, "email")}
            placeholder="Enter your email address"
            className={`focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] w-full max-w-md ${
              !validation.email ? "border-red-500" : ""
            }`}
          />
          {!validation.email && (
            <p className="text-sm text-red-500 mt-1">Please enter a valid email address</p>
          )}
        </div>
        
        {/* Professional Credentials */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="credentials" className="text-right">
              Professional Credentials
            </Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("credentials") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <Input
            ref={credentialsRef}
            id="credentials"
            name="credentials"
            value={settings.credentials}
            onChange={handleInputChange}
            onBlur={(e) => handleBlur(e, "credentials")}
            onKeyDown={(e) => handleKeyDown(e, "credentials")}
            placeholder="e.g. LCSW, LMFT or psychotherapist"
            className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] w-full max-w-md"
          />
          <p className="text-sm text-muted-foreground">The way you'll be introduced</p>
        </div>
      </div>
      
      {/* Professional Information */}
      <div className="mt-6 space-y-6 pb-6 border-b border-[#E5E7EB]">
        <h3 className="text-[18px] font-medium text-[#111827]">Professional Information</h3>
        
        {/* Country or Territory */}
        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="country" className="text-right">
              Country or Territory
            </Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("country") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <GeoLocalitiesSelect
            value={settings.country}
            onValueChange={(value) => handleSelectChange(value, "country")}
            onKeyDown={(e) => handleSelectKeyDown(e, "country")}
            placeholder="Select a country or territory"
          />
          <p className="text-sm text-muted-foreground">Needed to ensure adherence to local privacy regulations</p>
        </div>
        
        {/* Primary Therapeutic Approach */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label>Primary Therapeutic Approach</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("primaryTherapeuticApproach") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <TherapeuticApproachesSelect
            value={settings.primaryTherapeuticApproach}
            onValueChange={handlePrimaryApproachChange}
            onKeyDown={(e) => handleSelectKeyDown(e, "primaryTherapeuticApproach")}
            placeholder="Select primary approach"
            secondaryApproaches={settings.secondaryTherapeuticApproaches}
            filterSecondary={true}
          />
        </div>
        
        {/* Secondary Therapeutic Approaches */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label>Secondary Therapeutic Approaches</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("secondaryTherapeuticApproaches") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          
          {/* Display selected approaches as tags */}
          <div className="flex flex-wrap gap-2 mb-2">
            {settings.secondaryTherapeuticApproaches.map((approach, index) => {
              // Get the approach name from therapistProfile if available
              const approachName = therapistProfile?.secondaryApproachNames?.[index] || '';
              return (
                <div 
                  key={approach} 
                  className="flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm"
                >
                      {t(`mypraxis:therapeuticApproaches.${approachName}`, { defaultValue: approachName })}
                  <X 
                    className="ml-2 h-4 w-4 cursor-pointer hover:text-red-500" 
                    onClick={() => handleSecondaryApproachRemove(approach)}
                  />
                </div>
              );
            })}
          </div>
          
          {/* Dropdown for adding more approaches */}
          {settings.secondaryTherapeuticApproaches.length < 2 && (
            <TherapeuticApproachesSelect
              value=""
              onValueChange={handleSecondaryApproachAdd}
              onKeyDown={(e) => handleSelectKeyDown(e, "secondaryTherapeuticApproaches")}
              placeholder={settings.secondaryTherapeuticApproaches.length === 0 
                ? "Add approach (up to 2)" 
                : "Add approach (final one)"}
              primaryApproach={settings.primaryTherapeuticApproach}
              secondaryApproaches={settings.secondaryTherapeuticApproaches}
              filterPrimary={true}
              filterSecondary={true}
            />
          )}
          
          <p className="text-sm text-muted-foreground">Will be used to fine-tune AI reports</p>
        </div>
      </div>
      
      {/* Preferences */}
      <div className="mt-6 space-y-6 pb-6 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-medium text-[#111827]">Preferences</h3>
          {isLoadingPreferences && (
            <div className="text-sm text-muted-foreground flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading preferences...
            </div>
          )}
        </div>
        
        {/* UI Language */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label>UI Language</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("language") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <Select
            value={settings.language}
            onValueChange={(value) => handleSelectChange(value, "language")}
            defaultValue="en"
          >
            <SelectTrigger 
              id="language"
              className="w-full max-w-md focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
              onKeyDown={(e) => handleSelectKeyDown(e, "language")}
            >
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ru">Russian</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Time Format */}
        <div className="space-y-3">
          <div className="flex items-center">
            <Label>Time Format</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("use24HourClock") 
                    ? "opacity-100" 
                    : "opacity-0"
                } ${settings.use24HourClock ? "text-green-500" : "text-gray-500"}`} 
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 max-w-md">
            <Checkbox 
              id="use24HourClock" 
              checked={settings.use24HourClock}
              onCheckedChange={(checked) => handleCheckboxChange("use24HourClock", checked as boolean)}
              className="text-gray-500 border-gray-300"
              onKeyDown={(e) => handleCheckboxKeyDown(e, "use24HourClock")}
            />
            <label 
              htmlFor="use24HourClock" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Use 24-hour clock
            </label>
          </div>
        </div>
        
        {/* Date Format */}
        <div className="space-y-3">
          <div className="flex items-center">
            <Label>Date Format</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("useUSDateFormat") 
                    ? "opacity-100" 
                    : "opacity-0"
                } ${settings.useUSDateFormat ? "text-green-500" : "text-gray-500"}`} 
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 max-w-md">
            <Checkbox 
              id="useUSDateFormat" 
              checked={settings.useUSDateFormat}
              onCheckedChange={(checked) => handleCheckboxChange("useUSDateFormat", checked as boolean)}
              className="text-gray-500 border-gray-300"
              onKeyDown={(e) => handleCheckboxKeyDown(e, "useUSDateFormat")}
            />
            <label 
              htmlFor="useUSDateFormat" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Use US date format (MM/DD/YYYY)
            </label>
          </div>
        </div>
      </div>
      
      {/* Security */}
      <div className="mt-6 space-y-6 pb-6 mb-12">
        <h3 className="text-[18px] font-medium text-[#111827]">Security</h3>
        
        {/* Password Change */}
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label>Change Password</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("password") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
              />
            </div>
          </div>
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            value={settings.password || ""}
            onChange={handleInputChange}
            onBlur={(e) => handleBlur(e, "password")}
            onKeyDown={(e) => handleKeyDown(e, "password")}
            placeholder="Enter new password"
            className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] w-full max-w-md"
          />
          <Input
            ref={confirmPasswordRef}
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={handlePasswordConfirmBlur}
            onKeyDown={(e) => handleKeyDown(e, "confirmPassword")}
            placeholder="Confirm new password"
            className={`focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] w-full max-w-md ${
              !validation.passwordMatch ? "border-red-500" : ""
            }`}
          />
          {!validation.passwordMatch && (
            <p className="text-sm text-red-500 mt-1">Passwords do not match</p>
          )}
          <Button 
            variant="outline" 
            className="mt-2 max-w-md"
            onClick={() => {
              // This would typically open a password change dialog
              // For now, we'll just clear the field
              setSettings(prev => ({ ...prev, password: "" }));
            }}
          >
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}
