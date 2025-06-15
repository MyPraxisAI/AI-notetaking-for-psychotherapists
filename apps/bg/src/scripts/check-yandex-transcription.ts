#!/usr/bin/env node

import { config } from 'dotenv';
import { getBackgroundLogger } from '../lib/logger';
import { writeFile } from 'node:fs/promises';

// Load environment variables
config();

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const V3_API_ENDPOINT = 'stt.api.cloud.yandex.net';

if (!YANDEX_API_KEY) {
  console.error('Error: YANDEX_API_KEY environment variable is not set');
  process.exit(1);
}

async function checkTranscriptionStatus(operationId: string) {
  const logger = await getBackgroundLogger();
  const ctx = { name: 'check-yandex-transcription', operationId };
  let rawBody: string | undefined = undefined;

  try {
    logger.info(ctx, 'Checking transcription status');

    const apiUrl = `https://${V3_API_ENDPOINT}/stt/v3/getRecognition?operationId=${operationId}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    rawBody = await response.text();

    // Sanitize operationId for filename (alphanumeric, dash, underscore only)
    const safeOperationId = operationId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `/tmp/yandex-transcription-${safeOperationId}.txt`;
    await writeFile(fileName, rawBody, 'utf8');
    // Print in yellow for visibility
    console.log(`\x1b[33mRaw response body written to: ${fileName}\x1b[0m`);

    if (!response.ok) {
      logger.error({ ...ctx, errorText: rawBody }, 'Yandex API returned error response body');
      throw new Error(`HTTP error! status: ${response.status}, body: ${rawBody}`);
    }

    let data: unknown[] = [];
    try {
      data = rawBody
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line));
    } catch (jsonError) {
      logger.error({ ...ctx }, 'Failed to parse NDJSON from Yandex response');
      throw new Error(`Failed to parse NDJSON: ${jsonError}`);
    }

    logger.info({ ...ctx, status: Array.isArray(data) && data.length > 0 ? (data[0] as any).status : undefined }, 'Received transcription status');

    // Pretty print the response
    console.log('\nTranscription Status:');
    console.log('-------------------');
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    logger.error({ ...ctx, error }, 'Failed to check transcription status');
    throw error;
  }
}

// Get operation ID from command line arguments
const operationId = process.argv[2];

if (!operationId) {
  console.error('Error: Please provide an operation ID as a command line argument');
  console.error('Usage: pnpm check-yandex-transcription <operationId>');
  process.exit(1);
}

// Run the check
checkTranscriptionStatus(operationId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  }); 