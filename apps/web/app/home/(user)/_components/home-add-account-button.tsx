'use client';

import { useState } from 'react';

import { CreateTeamAccountDialog } from '@kit/team-accounts/components';
import { Button } from '@kit/ui/button';

export function HomeAddAccountButton() {
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setIsAddingAccount(true)}>
        Create a new team
      </Button>

      <CreateTeamAccountDialog
        isOpen={isAddingAccount}
        setIsOpen={setIsAddingAccount}
      />
    </>
  );
}
