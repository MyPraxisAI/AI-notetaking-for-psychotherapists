import { Database } from '@kit/supabase/database';

export type Schemas = keyof Database;
export type TablesForSchema<S extends Schemas> = Database[S]['Tables'];

// Only keys with a Row property
export type TableWithRow<S extends Schemas> = {
  [K in keyof TablesForSchema<S>]: TablesForSchema<S>[K] extends { Row: any } ? K : never
}[keyof TablesForSchema<S>];

// Add this for compatibility with existing code
export type Tables = Database['public']['Tables'];

export type TableChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RecordChange<
  Schema extends Schemas = 'public',
  Table extends TableWithRow<Schema> = TableWithRow<Schema>,
  Row = TablesForSchema<Schema>[Table] extends { Row: infer R } ? R : never
> {
  type: TableChangeType;
  table: Table;
  record: Row;
  schema: Schema;
  old_record: null | Row;
}
