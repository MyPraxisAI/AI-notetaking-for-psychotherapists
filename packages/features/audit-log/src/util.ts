export function extractClientIp(request: Request): string | undefined {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    undefined
  );
} 