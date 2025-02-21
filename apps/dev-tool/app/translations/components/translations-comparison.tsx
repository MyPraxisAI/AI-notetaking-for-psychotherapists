'use client';

import { useState } from 'react';

import { ChevronDownIcon } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { cn } from '@kit/ui/utils';

import { defaultI18nNamespaces } from '../../../../web/lib/i18n/i18n.settings';
import type { TranslationData, Translations } from '../lib/translations-loader';

function flattenTranslations(
  obj: TranslationData,
  prefix = '',
  result: Record<string, string> = {},
) {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[newKey] = value;
    } else {
      flattenTranslations(value, newKey, result);
    }
  }

  return result;
}

type FlattenedTranslations = Record<string, Record<string, string>>;

export function TranslationsComparison({
  translations,
}: {
  translations: Translations;
}) {
  const [search, setSearch] = useState('');
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>();

  const [selectedNamespace, setSelectedNamespace] = useState(
    defaultI18nNamespaces[0] as string,
  );

  const locales = Object.keys(translations);

  if (locales.length === 0) {
    return <div>No translations found</div>;
  }

  const baseLocale = locales[0]!;

  // Initialize selected locales if not set
  if (!selectedLocales) {
    setSelectedLocales(new Set(locales));
    return null;
  }

  // Flatten translations for the selected namespace
  const flattenedTranslations: FlattenedTranslations = {};

  for (const locale of locales) {
    const namespaceData = translations[locale]?.[selectedNamespace];
    if (namespaceData) {
      flattenedTranslations[locale] = flattenTranslations(namespaceData);
    } else {
      flattenedTranslations[locale] = {};
    }
  }

  // Get all unique keys across all translations
  const allKeys = Array.from(
    new Set(
      Object.values(flattenedTranslations).flatMap((data) => Object.keys(data)),
    ),
  ).sort();

  const filteredKeys = allKeys.filter((key) =>
    key.toLowerCase().includes(search.toLowerCase()),
  );

  const visibleLocales = locales.filter((locale) =>
    selectedLocales.has(locale),
  );

  const copyTranslation = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const toggleLocale = (locale: string) => {
    const newSelectedLocales = new Set(selectedLocales);

    if (newSelectedLocales.has(locale)) {
      if (newSelectedLocales.size > 1) {
        newSelectedLocales.delete(locale);
      }
    } else {
      newSelectedLocales.add(locale);
    }

    setSelectedLocales(newSelectedLocales);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Input
            type="search"
            placeholder="Search translations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Select Languages
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[200px]">
              {locales.map((locale) => (
                <DropdownMenuCheckboxItem
                  key={locale}
                  checked={selectedLocales.has(locale)}
                  onCheckedChange={() => toggleLocale(locale)}
                  disabled={
                    selectedLocales.size === 1 && selectedLocales.has(locale)
                  }
                >
                  {locale}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select
            value={selectedNamespace}
            onValueChange={setSelectedNamespace}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select namespace" />
            </SelectTrigger>

            <SelectContent>
              {defaultI18nNamespaces.map((namespace: string) => (
                <SelectItem key={namespace} value={namespace}>
                  {namespace}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              {visibleLocales.map((locale) => (
                <TableHead key={locale}>{locale}</TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredKeys.map((key) => (
              <TableRow key={key}>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span>{key}</span>
                  </div>
                </TableCell>

                {visibleLocales.map((locale) => {
                  const translations = flattenedTranslations[locale] ?? {};

                  const baseTranslations =
                    flattenedTranslations[baseLocale] ?? {};

                  const value = translations[key];
                  const baseValue = baseTranslations[key];
                  const isMissing = !value;
                  const isDifferent = value !== baseValue;

                  return (
                    <TableCell
                      key={locale}
                      className={cn({
                        'bg-destructive/10': isMissing,
                        'bg-warning/10': !isMissing && isDifferent,
                      })}
                    >
                      <div className="flex items-center justify-between">
                        <span>
                          {value || (
                            <span className="text-destructive">Missing</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
