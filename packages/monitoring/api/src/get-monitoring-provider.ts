import { z } from 'zod';

export const MONITORING_PROVIDER = z.enum(['baselime', 'sentry']).optional();

export type MonitoringProvider = z.infer<typeof MONITORING_PROVIDER>;

export function getMonitoringProvider() {
  return MONITORING_PROVIDER.parse(process.env.NEXT_PUBLIC_MONITORING_PROVIDER);
}
