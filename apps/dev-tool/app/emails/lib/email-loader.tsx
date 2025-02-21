import {
  renderAccountDeleteEmail,
  renderInviteEmail,
} from '@kit/email-templates';

export async function loadEmailTemplate(id: string) {
  if (id === 'account-delete-email') {
    return renderAccountDeleteEmail({
      productName: 'Makerkit',
      userDisplayName: 'Giancarlo',
    });
  }

  if (id === 'invite-email') {
    return renderInviteEmail({
      teamName: 'Makerkit',
      teamLogo:
        '',
      inviter: 'Giancarlo',
      invitedUserEmail: 'test@makerkit.dev',
      link: 'https://makerkit.dev',
      productName: 'Makerkit',
    });
  }

  if (id === 'magic-link-email') {
    return loadFromFileSystem('magic-link');
  }

  if (id === 'reset-password-email') {
    return loadFromFileSystem('reset-password');
  }

  if (id === 'change-email-address-email') {
    return loadFromFileSystem('change-email-address');
  }

  if (id === 'confirm-email') {
    return loadFromFileSystem('confirm-email');
  }

  throw new Error(`Email template not found: ${id}`);
}

async function loadFromFileSystem(fileName: string) {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');

  const filePath = join(
    process.cwd(),
    `../web/supabase/templates/${fileName}.html`,
  );

  return {
    html: readFileSync(filePath, 'utf8'),
  };
}
