import { z } from 'zod';

/**
 * @name RESERVED_NAMES_ARRAY
 * @description Array of reserved names for team accounts
 * This is a list of names that cannot be used for team accounts as they are reserved for other purposes.
 */
const RESERVED_NAMES_ARRAY = [
    'settings',
    'billing',
    // please add more reserved names here
];

const ReservedTeamNameSchema = z
  .string()
  .min(3)
  .max(50)
  .refine(
    (name) => {
      return !RESERVED_NAMES_ARRAY.includes(name);
    },
    {
      message: 'This name is reserved and cannot be used for a team account',
    },
  );

export const CreateTeamSchema = z.object({
  name: ReservedTeamNameSchema,
});
