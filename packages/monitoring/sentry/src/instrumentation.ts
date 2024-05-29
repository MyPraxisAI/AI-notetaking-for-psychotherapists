/**
 * @name registerInstrumentation
 * @description This file is used to register Sentry instrumentation for your Next.js application.
 *
 * Please set the MONITORING_PROVIDER environment variable to 'sentry' to register Sentry instrumentation.
 */
export async function registerInstrumentation() {
  const { initializeSentryServerClient } = await import(
    './sentry.server.config'
  );

  // initialize the Sentry client in the server
  void initializeSentryServerClient();

  if (process.env.ENABLE_MONITORING_INSTRUMENTATION !== 'true') {
    return;
  }

  // make sure the instrumentation is only run in a Node.js environment
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const serviceName = process.env.INSTRUMENTATION_SERVICE_NAME;

    if (!serviceName) {
      throw new Error(
        `You have set the Sentry instrumentation provider, but have not set the INSTRUMENTATION_SERVICE_NAME environment variable. Please set the INSTRUMENTATION_SERVICE_NAME environment variable.`,
      );
    }

    const { Resource } = await import('@opentelemetry/resources');
    const { NodeSDK } = await import('@opentelemetry/sdk-node');

    const { SEMRESATTRS_SERVICE_NAME } = await import(
      '@opentelemetry/semantic-conventions'
    );

    const { SentrySpanProcessor, SentryPropagator } = await import(
      '@sentry/opentelemetry-node'
    );

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
      }),
      spanProcessors: [new SentrySpanProcessor()],
      textMapPropagator: new SentryPropagator(),
    });

    sdk.start();
  }
}
