'use client';

import { useEffect, useState } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@kit/ui/select";
import { useGeoLocalities, GeoLocality } from '../../app/home/(user)/mypraxis/_lib/hooks/use-geo-localities';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';

interface GeoLocalitiesSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  className?: string;
  placeholder?: string;
}

export function GeoLocalitiesSelect({
  value,
  onValueChange,
  onKeyDown,
  className = '',
  placeholder = 'Select a country or territory'
}: GeoLocalitiesSelectProps) {
  const { data: geoLocalities, isLoading } = useGeoLocalities();
  const [localities, setLocalities] = useState<GeoLocality[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (geoLocalities) {
      // Sort the localities by their localized values
      const sortedLocalities = [...geoLocalities].sort((a, b) => {
        // Always put 'other' at the end
        if (a.name === 'other') return 1;
        if (b.name === 'other') return -1;
        
        // Sort by translated values
        const aTranslated = t(`mypraxis:geoLocalities.${a.name}`, { defaultValue: a.name });
        const bTranslated = t(`mypraxis:geoLocalities.${b.name}`, { defaultValue: b.name });
        return aTranslated.localeCompare(bTranslated);
      });
      
      setLocalities(sortedLocalities);
    }
  }, [geoLocalities, t]);

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
    >
      <SelectTrigger 
        id="country"
        className={`w-full max-w-md focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] ${className}`}
        onKeyDown={onKeyDown}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="loading" disabled>Loading...</SelectItem>
        ) : localities.length === 0 ? (
          <SelectItem value="none" disabled>No localities found</SelectItem>
        ) : (
          localities.map((locality) => (
            <SelectItem key={locality.id} value={locality.id}>
              <Trans
                i18nKey={`mypraxis:geoLocalities.${locality.name}`}
                values={{ defaultValue: locality.name }}
              />
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
