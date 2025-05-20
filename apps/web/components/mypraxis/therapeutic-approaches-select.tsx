'use client';

import { useMemo } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@kit/ui/select";
import { useTherapeuticApproaches, TherapeuticApproach as _TherapeuticApproach } from '../../app/home/(user)/mypraxis/_lib/hooks/use-therapeutic-approaches';
import { useTranslation } from 'react-i18next';

interface TherapeuticApproachesSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  className?: string;
  placeholder?: string;
  primaryApproach?: string;
  secondaryApproaches?: string[];
  filterPrimary?: boolean;
  filterSecondary?: boolean;
  testId?: string; // Data-test attribute for testing
  disabled?: boolean; // Whether the select is disabled
}

// Completely rewritten component to avoid render loops
export function TherapeuticApproachesSelect({
  value,
  onValueChange,
  onKeyDown,
  className = '',
  placeholder = 'Select a therapeutic approach',
  primaryApproach = '',
  secondaryApproaches = [],
  filterPrimary = false,
  filterSecondary = false,
  testId = 'settings-therapeutic-approach-select',
  disabled = false
}: TherapeuticApproachesSelectProps) {
  
  // Fetch therapeutic approaches
  const { data: therapeuticApproaches = [], isLoading } = useTherapeuticApproaches();
  const { t } = useTranslation();

  // Process approaches with useMemo instead of useState + useEffect
  const processedApproaches = useMemo(() => {
    if (!therapeuticApproaches.length) return [];
    
    // Filter approaches if needed
    let filteredApproaches = [...therapeuticApproaches];
    
    if (filterPrimary && primaryApproach) {
      filteredApproaches = filteredApproaches.filter(approach => 
        approach.id !== primaryApproach
      );
    }
    
    if (filterSecondary && secondaryApproaches.length > 0) {
      filteredApproaches = filteredApproaches.filter(approach => 
        !secondaryApproaches.includes(approach.id)
      );
    }
    
    // Sort the approaches by their localized values
    return filteredApproaches.sort((a, b) => {
      // Always put 'other' at the end
      if (a.name === 'other') return 1;
      if (b.name === 'other') return -1;
      
      // Sort by translated values
      const aTranslated = t(`mypraxis:therapeuticApproaches.${a.name}`, { defaultValue: a.name });
      const bTranslated = t(`mypraxis:therapeuticApproaches.${b.name}`, { defaultValue: b.name });
      return aTranslated.localeCompare(bTranslated);
    });
  }, [therapeuticApproaches, primaryApproach, secondaryApproaches, filterPrimary, filterSecondary, t]);
  
  
  // Render the select component
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger 
        id="primaryTherapeuticApproach"
        className={`w-full max-w-md focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] ${className}`}
        onKeyDown={onKeyDown}
        data-test={testId}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="loading" disabled>Loading...</SelectItem>
        ) : processedApproaches.length === 0 ? (
          <SelectItem value="none" disabled>No approaches found</SelectItem>
        ) : (
          processedApproaches.map((approach) => (
            <SelectItem key={approach.id} value={approach.id}>
              {t(`mypraxis:therapeuticApproaches.${approach.name}`, { defaultValue: approach.name })}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
