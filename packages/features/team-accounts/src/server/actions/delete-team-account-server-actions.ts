'use server';

import { redirect } from 'next/navigation';

import type { SupabaseClient } from '@supabase/supabase-js';

import { enhanceAction } from '@kit/next/actions';
import type { Database } from '@kit/supabase/database';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DeleteTeamAccountSchema } from '../../schema/delete-team-account.schema';
import { createDeleteTeamAccountService } from '../services/delete-team-account.service';

export const deleteTeamAccountAction = enhanceAction(
  async (formData: FormData, user) => {
    const params = DeleteTeamAccountSchema.parse(
      Object.fromEntries(formData.entries()),
    );

    await deleteTeamAccount({
      accountId: params.accountId,
      userId: user.id,
    });

    return redirect('/home');
  },
  {},
);

async function deleteTeamAccount(params: {
  accountId: string;
  userId: string;
}) {
  const client = getSupabaseServerClient();
  const service = createDeleteTeamAccountService();

  // verify that the user has the necessary permissions to delete the team account
  await assertUserPermissionsToDeleteTeamAccount(client, params);

  // delete the team account
  await service.deleteTeamAccount(client, params);
}

async function assertUserPermissionsToDeleteTeamAccount(
  client: SupabaseClient<Database>,
  params: {
    accountId: string;
    userId: string;
  },
) {
  const { data, error } = await client
    .from('accounts')
    .select('id')
    .eq('primary_owner_user_id', params.userId)
    .eq('is_personal_account', false)
    .eq('id', params.accountId)
    .single();

  if (error ?? !data) {
    throw new Error('Account not found');
  }
}
