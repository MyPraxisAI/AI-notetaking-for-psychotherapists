import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

// Import schema directly
import { z } from 'zod';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => any;
};

// Define the schema here instead of importing
const AccountSettingsSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const PUT = enhanceRouteHandler(
  async ({ request, user }) => {
    const ctx = {
      name: 'update-account-settings',
      userId: user.id,
    };

    logger.info(ctx, 'Processing account settings update request');

    try {
      const data = await request.json();
      const validatedData = AccountSettingsSchema.parse(data);
      
      logger.info(ctx, 'Updating account settings...');

      const client = getSupabaseServerClient();

      // Update user profile
      const { error } = await client.auth.updateUser({
        email: validatedData.email,
        data: {
          display_name: validatedData.displayName,
          avatar_url: validatedData.avatarUrl,
        },
      });

      if (error) {
        logger.error(ctx, 'Failed to update account settings', { error });
        return NextResponse.json({ error: 'Failed to update account settings' }, { status: 500 });
      }

      logger.info(ctx, 'Account settings updated successfully');
      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error(ctx, 'Failed to update account settings', { error });
      
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      );
    }
  },
  {
    auth: true,
  }
);
