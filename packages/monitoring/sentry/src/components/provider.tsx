import { useRef } from 'react';

import { MonitoringContext } from '@kit/monitoring-core';

import { SentryMonitoringService } from '../services/sentry-monitoring.service';

export function SentryProvider({ children }: React.PropsWithChildren) {
  return <MonitoringProvider>{children}</MonitoringProvider>;
}

function MonitoringProvider(props: React.PropsWithChildren) {
  const service = useRef(new SentryMonitoringService());

  return (
    <MonitoringContext.Provider value={service.current}>
      {props.children}
    </MonitoringContext.Provider>
  );
}
