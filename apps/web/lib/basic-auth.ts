import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware function to implement HTTP Basic Authentication
 * @param request The incoming request
 * @returns NextResponse with either 401 Unauthorized or the original response
 */
export function withBasicAuth(request: NextRequest): NextResponse | null {
  // Check if basic auth is enabled via environment variable
  const basicAuthEnabled = process.env.ENABLE_BASIC_AUTH === 'true';
  
  if (!basicAuthEnabled) {
    return null; // Skip basic auth if not enabled
  }

  // Get the required username and password from environment variables
  const requiredUsername = process.env.BASIC_AUTH_USERNAME;
  const requiredPassword = process.env.BASIC_AUTH_PASSWORD;

  // If credentials are not configured, skip basic auth
  if (!requiredUsername || !requiredPassword) {
    console.warn('Basic auth is enabled but credentials are not configured');
    return null;
  }

  // Get the authorization header from the request
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    // No auth header or not Basic auth, return 401 Unauthorized
    console.error(`[BasicAuth] Authentication failed: Missing or invalid auth header for ${request.url}`);
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // Extract and decode the credentials
  const credentials = authHeader.split(' ')[1];
  // Make sure credentials is not undefined before using Buffer.from
  if (!credentials) {
    console.error(`[BasicAuth] Authentication failed: Empty credentials in auth header for ${request.url}`);
    return new NextResponse('Invalid authorization header', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }
  
  const decodedCredentials = Buffer.from(credentials, 'base64').toString('utf-8');
  const [username, password] = decodedCredentials.split(':');

  // Check if the credentials match
  if (username !== requiredUsername || password !== requiredPassword) {
    // Invalid credentials, return 401 Unauthorized
    console.error(`[BasicAuth] Authentication failed: Invalid credentials (username: ${username}) for ${request.url}`);
    return new NextResponse('Authentication failed', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // Authentication successful, continue with the request
  return null;
}
