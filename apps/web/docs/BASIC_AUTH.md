# HTTP Basic Authentication

This document explains how to use the HTTP Basic Authentication feature in the MyPraxis application.

## Overview

HTTP Basic Authentication adds a simple username/password prompt that appears before users can access any page on the site. This is useful for:

- Protecting development or staging environments
- Restricting access to beta versions of the application
- Adding an extra layer of security to production environments

## Configuration

The basic authentication is controlled by environment variables:

```
# Set to 'true' to enable HTTP Basic Authentication for the entire site
ENABLE_BASIC_AUTH=true
BASIC_AUTH_USERNAME=your_username
BASIC_AUTH_PASSWORD=your_password
```

### Environment Files

- `.env`: Default configuration (disabled by default)

## How to Enable/Disable

1. To enable basic authentication:
   - Set `ENABLE_BASIC_AUTH=true` in your environment file
   - Set `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` to your desired credentials

2. To disable basic authentication:
   - Set `ENABLE_BASIC_AUTH=false` in your environment file

## Security Considerations

- Always use strong, unique passwords for basic authentication
- This is not a replacement for proper authentication and authorization within your application
- The credentials are transmitted with base64 encoding, which is not secure without HTTPS
- Always use HTTPS in production environments

## Implementation Details

The basic authentication is implemented as middleware in Next.js, which intercepts all requests before they reach your application. The implementation can be found in:

- `/apps/web/lib/basic-auth.ts`: The basic authentication middleware
- `/apps/web/middleware.ts`: Integration with the Next.js middleware pipeline
