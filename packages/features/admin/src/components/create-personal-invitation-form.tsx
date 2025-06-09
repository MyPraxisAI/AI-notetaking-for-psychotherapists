'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  CreatePersonalInviteSchema,
  createPersonalInviteAction
} from '@kit/personal-invitations/client';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';

type FormData = z.infer<typeof CreatePersonalInviteSchema>;

export function CreatePersonalInvitationForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { t, i18n } = useTranslation(['admin']);

  const form = useForm<FormData>({
    resolver: zodResolver(CreatePersonalInviteSchema),
    defaultValues: {
      email: '',
      expiresInDays: 7,
      language: i18n.language || 'en', // Use current language or fallback to English
    },
  });

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        const result = await createPersonalInviteAction(data);
        
        if (result.success) {
          toast.success(t('admin:personalInvites.form.invitationSent', 'Invitation sent'), {
            description: t('admin:personalInvites.form.invitationSentDescription', 'An invitation has been sent to {{email}}', { email: data.email })
          });
          
          form.reset();
          router.refresh();
          
          // Call onSuccess callback to close the dialog
          if (onSuccess) {
            onSuccess();
          }
        } else {
          toast.error(t('admin:personalInvites.form.error', 'Error'), {
            description: t('admin:personalInvites.form.failedToSend', 'Failed to send invitation')
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : t('admin:personalInvites.form.somethingWentWrong', 'Something went wrong');
          
        toast.error(t('admin:personalInvites.form.error', 'Error'), {
          description: errorMessage
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('admin:personalInvites.form.emailLabel', 'Email')}</FormLabel>
              <FormControl>
                <Input 
                  placeholder={t('admin:personalInvites.form.emailPlaceholder', 'user@example.com')}
                  {...field} 
                  type="email"
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                {t('admin:personalInvites.form.emailDescription', 'The email address of the person you want to invite.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('admin:personalInvites.form.languageLabel', 'Email Language')}</FormLabel>
              <FormControl>
                <Select 
                  value={field.value} 
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin:personalInvites.form.languagePlaceholder', 'Select language')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t('admin:languages.english', 'English')}</SelectItem>
                    <SelectItem value="ru">{t('admin:languages.russian', 'Russian')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                {t('admin:personalInvites.form.languageDescription', 'Language for the invitation email.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expiresInDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('admin:personalInvites.form.expiresLabel', 'Expires In (Days)')}</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min="1" 
                  max="30" 
                  {...field}
                  value={field.value}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                {t('admin:personalInvites.form.expiresDescription', 'Number of days until this invitation expires.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isPending}
          className="w-full"
        >
          {isPending ? t('admin:personalInvites.form.sending', 'Sending...') : t('admin:personalInvites.form.sendInvitation', 'Send Invitation')}
        </Button>
      </form>
    </Form>
  );
}

export function CreatePersonalInvitationDialog({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation(['admin']);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('admin:personalInvites.dialog.title', 'Invite New User')}</DialogTitle>
          <DialogDescription>
            {t('admin:personalInvites.dialog.description', 'Send a personal invitation to allow a new user to create an account.')}
          </DialogDescription>
        </DialogHeader>
        <CreatePersonalInvitationForm onSuccess={() => setOpen(false)} />
        <DialogFooter className="sm:justify-start">
          <DialogDescription>
            {t('admin:personalInvites.dialog.footer', 'The user will receive an email with a link to sign up.')}
          </DialogDescription>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
