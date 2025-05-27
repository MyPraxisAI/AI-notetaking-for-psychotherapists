#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
// Keep using CommonJS require for Node.js script compatibility
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');

/**
 * Generate a deterministic UUID based on a seed string
 * @param {string} seed - The seed string to generate UUID from
 * @returns {string} - A deterministic UUID v4
 */
function generateUuid(seed) {
  // Use the first 16 bytes of the seed's SHA-256 hash
  const hash = crypto.createHash('sha256').update(seed).digest().slice(0, 16);
  
  // Set version 4 (random) and variant bits
  hash[6] = (hash[6] & 0x0f) | 0x40;  // version 4
  hash[8] = (hash[8] & 0x3f) | 0x80;  // variant 1
  
  // Convert to UUID string
  return hash.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

/**
 * Load and parse the YAML file
 * @param {string} yamlPath - Path to the YAML file
 * @returns {Object} - Parsed YAML data
 */
function loadYamlData(yamlPath) {
  const fileContents = fs.readFileSync(yamlPath, 'utf8');
  return yaml.load(fileContents);
}

/**
 * Check if a file exists and is not empty
 * @param {string} filePath - Path to the file to check
 * @returns {boolean} - True if the file exists and is not empty, false otherwise
 */
function fileExistsAndNotEmpty(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const stats = fs.statSync(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    // Error parameter removed - just return false for any file system error
    return false;
  }
}

/**
 * Load and parse the JSON transcript file
 * @param {string} transcriptPath - Path to the transcript JSON file
 * @returns {string} - JSON content as a string, properly escaped for SQL, or null if file doesn't exist or is empty
 */
function loadTranscriptJson(transcriptPath) {
  if (!fileExistsAndNotEmpty(transcriptPath)) {
    console.warn(`Warning: Transcript file ${transcriptPath} does not exist or is empty.`);
    return '{}'; // Return empty valid JSON object instead of null
  }
  
  try {
    const fileContents = fs.readFileSync(transcriptPath, 'utf8');
    // Validate that it's valid JSON
    JSON.parse(fileContents); // This will throw if invalid JSON
    // Escape single quotes for SQL
    return fileContents.replace(/'/g, "''");
  } catch (error) {
    // Handle error properly with type checking
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? error.message 
      : 'Unknown error';
    console.warn(`Warning: Error loading transcript file ${transcriptPath}: ${errorMessage}`);
    return '{}'; // Return empty valid JSON object
  }
}

/**
 * Safely escape a string for SQL, handling undefined/null values
 * @param {string|undefined|null} str - The string to escape
 * @returns {string} - The escaped string or empty string if input is undefined/null
 */
function escapeSqlString(str) {
  if (str === undefined || str === null) {
    return '';
  }
  return String(str).replace(/'/g, "''");
}

/**
 * Generate SQL migration content from YAML data
 * @param {Object} yamlData - The parsed YAML data
 * @param {string} clientName - Name of the client
 * @param {string} yamlPath - Path to the source YAML file
 * @returns {[string, string]} - Tuple of [timestamp, sqlContent]
 */
function generateMigrationSql(yamlData, clientName, yamlPath) {
  // Validate required fields
  const requiredFields = ['name', 'email', 'phone', 'client_bio', 'client_conceptualiation', 'client_prep_note'];
  const missingFields = requiredFields.filter(field => !yamlData[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields in YAML data: ${missingFields.join(', ')}`);
  }

  // Get client ID from YAML or generate one
  const clientId = yamlData.id || generateUuid(`client_${clientName}`);
  
  // Get current timestamp for migration filename
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .replace(/\..+/, '');
  
  // Start building SQL content
  let sqlContent = `-- Client: ${clientName}
-- Source: ${path.basename(yamlPath)}
${yamlData.id ? `-- Using provided client ID: ${yamlData.id}` : `-- Using generated client ID: ${clientId}`}

-- Update ${clientName} demo client
DO $$
DECLARE
  demo_account_id UUID;
  demo_therapist_id UUID;
  ${clientName.toLowerCase()}_id UUID := '${clientId}'::UUID;
  current_session_id UUID;
BEGIN
  -- Get the account ID and therapist ID for the demo user
  SELECT a.id, t.id INTO demo_account_id, demo_therapist_id
  FROM public.accounts a
  JOIN public.therapists t ON t.account_id = a.id
  WHERE a.primary_owner_user_id = 'dddddddd-dddd-4ddd-addd-dddddddddddd' AND a.is_personal_account = true;
  
  -- Delete existing client with the same ID if it exists
  DELETE FROM public.clients WHERE id = ${clientName.toLowerCase()}_id;
  
  -- Create ${clientName} demo client
  INSERT INTO public.clients (
    id,
    account_id,
    therapist_id,
    full_name,
    email,
    phone,
    demo
  ) VALUES (
    ${clientName.toLowerCase()}_id,
    demo_account_id,
    demo_therapist_id,
    '${escapeSqlString(yamlData.name)}',
    '${escapeSqlString(yamlData.email)}',
    '${escapeSqlString(yamlData.phone)}',
    true
  );
  
  -- Create client bio artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    ${clientName.toLowerCase()}_id,
    'client_bio',
    '${escapeSqlString(yamlData.client_bio)}',
    'en'
  );
  
  -- Create client conceptualization artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    ${clientName.toLowerCase()}_id,
    'client_conceptualization',
    '${escapeSqlString(yamlData.client_conceptualiation)}',
    'en'
  );
  
  -- Create client prep note artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    ${clientName.toLowerCase()}_id,
    'client_prep_note',
    '${escapeSqlString(yamlData.client_prep_note)}',
    'en'
  );
`;

  // Add sessions
  ['session_1', 'session_2'].forEach((sessionKey, index) => {
    const session = yamlData[sessionKey];
    if (session && session.title && session.notes && session.therapist_summary && session.client_summary) {
      const sessionNum = index + 1;
      // sessionId variable removed - not used in this function
      
      // Load transcript JSON if specified
      let transcriptJson = 'NULL';
      if (session.transcript_file) {
        try {
          // Try to load transcript JSON from file
          const transcriptPath = path.join(path.dirname(yamlPath), session.transcript_file);
          
          // Check if the transcript file exists and is not empty
          if (fileExistsAndNotEmpty(transcriptPath)) {
            const jsonContent = loadTranscriptJson(transcriptPath);
            // Only use the transcript if it's not an empty object
            if (jsonContent && jsonContent !== '{}') {
              transcriptJson = `'${jsonContent}'::jsonb`;
            } else {
              console.warn(`Warning: Transcript file for session ${sessionNum} is empty or invalid JSON.`);
            }
          } else {
            console.warn(`Warning: Transcript file for session ${sessionNum} not found: ${transcriptPath}`);
          }
        } catch (error) {
          // Handle error properly with type checking
          const errorMessage = error && typeof error === 'object' && 'message' in error 
            ? error.message 
            : 'Unknown error';
          console.warn(`Warning: Could not load transcript for session ${sessionNum}: ${errorMessage}`);
        }
      }
      
      sqlContent += `
  -- Session ${sessionNum}: ${escapeSqlString(session.title)}
  INSERT INTO public.sessions (
    account_id,
    client_id,
    title,
    note
  ) VALUES (
    demo_account_id,
    ${clientName.toLowerCase()}_id,
    '${escapeSqlString(session.title)}',
    '${escapeSqlString(session.notes)}'
  ) RETURNING id INTO current_session_id;
  
  -- Create transcript for session ${sessionNum}
  INSERT INTO public.transcripts (
    account_id,
    session_id,
    transcription_model,
    content,
    content_json
  ) VALUES (
    demo_account_id,
    current_session_id,
    'demo',
    NULL,
    ${transcriptJson}
  );
  
  -- Create session artifacts
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    current_session_id,
    'session_therapist_summary',
    '${escapeSqlString(session.therapist_summary)}',
    'en'
  );
  
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    current_session_id,
    'session_client_summary',
    '${escapeSqlString(session.client_summary)}',
    'en'
  );
`;
    }
  });

  sqlContent += `
END $$;
`;
  
  return [timestamp, sqlContent];
}

/**
 * Extract client name from the path
 * @param {string} yamlPath - Path to the YAML file
 * @returns {string} - Client name (directory name under demo-client-data)
 */
function extractClientName(yamlPath) {
  const parts = path.normalize(yamlPath).split(path.sep);
  const demoClientDataIndex = parts.indexOf('demo-client-data');
  
  if (demoClientDataIndex === -1 || demoClientDataIndex === parts.length - 1) {
    throw new Error('YAML file must be under a directory within demo-client-data/');
  }
  
  return parts[demoClientDataIndex + 1].toLowerCase();
}

/**
 * Recursively finds all client.yml files under a given directory.
 * @param {string} dir – The directory to search.
 * @returns {string[]} – An array of full paths (strings) of client.yml files.
 */
function findClientYamlFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
       files = files.concat(findClientYamlFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'client.yml') {
       files.push(fullPath);
    }
  }
  return files;
}

// Usage:
//   node generate_demo_client_migration.js /path/to/client.yml
//   node generate_demo_client_migration.js /path/to/top-level-client-directory (e.g. pnpm generate-demo-client-migration demo-client-data/Eugenia)

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node generate_demo_client_migration.js [<client.yml path> | <top-level-dir>]");
    process.exit(1);
  }
  const arg = args[0];
  let clientYamlPaths;
  if (fs.statSync(arg).isDirectory()) {
    // If a single top-level directory is provided, recursively find all client.yml files under it.
    clientYamlPaths = findClientYamlFiles(arg);
  } else {
    // Assume it's a single client.yml file (or a comma-separated list of files).
    clientYamlPaths = arg.split(',').map(p => p.trim());
  }
  
  // For migration file naming, extract the client name from the path
  let clientName = 'unknown';
  
  try {
    if (arg && fs.statSync(arg).isDirectory()) {
      // For directories, use the basename (last part of the path)
      clientName = path.basename(arg);
    } else if (clientYamlPaths && clientYamlPaths.length > 0 && clientYamlPaths[0]) {
      // If we have valid YAML paths, extract from the first one
      clientName = extractClientName(clientYamlPaths[0]);
    }
  } catch (error) {
    console.warn("Warning: Could not determine client name properly: ", 
      error && typeof error === 'object' && 'message' in error ? error.message : 'Unknown error');
    // Keep the default 'unknown' value
  }
  if (clientYamlPaths.length === 0) {
    console.error("No client.yml files found.");
    process.exit(1);
  }
  // Create the migration header only once at the beginning
  let migrationSql = `-- Migration generated by generate_demo_client_migration.js
-- Generated at: ${new Date().toISOString()}
-- Client(s): ${clientName}
-- DO NOT EDIT MANUALLY - Regenerate using the script if changes are needed

`;
  
  // Process each client
  for (const yamlPath of clientYamlPaths) {
    const clientData = loadYamlData(yamlPath);
    const clientName = extractClientName(yamlPath);
    const migration = generateMigrationSql(clientData, clientName, yamlPath);
    migrationSql += migration[1] + "\n";
  }
  // Generate a timestamp in the format YYYYMMDDHHMMSS
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .replace(/\..+/, '')
    .substring(0, 14);
  
  const migrationFileName = timestamp + "_update_demo_client_" + clientName.toLowerCase() + ".sql";
  const migrationFilePath = path.join(__dirname, "..", "migrations", migrationFileName);
  fs.writeFileSync(migrationFilePath, migrationSql, 'utf8');
  console.log("Generated migration file: " + migrationFilePath);
} 