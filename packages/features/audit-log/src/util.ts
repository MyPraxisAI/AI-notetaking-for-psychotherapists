export function extractClientIpFromHeaders(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for') ||
    headers.get('x-real-ip') ||
    undefined
  );
}

export const NULL_UUID = '00000000-0000-0000-0000-000000000000'; 