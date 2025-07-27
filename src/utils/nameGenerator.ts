import crypto from 'crypto';

/**
 * Generate investigation name based on title
 * Uses the same logic as channel name generation for consistency
 */
export function generateInvestigationName(title: string): string {
  return generateChannelName(title);
}

/**
 * Generate unique name with existence check
 */
export async function generateUniqueName(
  title: string,
  checkExists: (name: string) => Promise<boolean>
): Promise<string> {
  // First try the standard name
  const baseName = generateInvestigationName(title);
  const exists = await checkExists(baseName);
  
  if (!exists) {
    return baseName;
  }

  // If it exists, try with different random suffixes
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Generate a new random suffix
    const randomSuffix = crypto.randomBytes(2).toString('hex').substring(0, 3);
    
    // Extract the base part without the original suffix
    const parts = baseName.split('-');
    parts[parts.length - 1] = randomSuffix; // Replace the last part (the suffix)
    
    const name = parts.join('-');
    const nameExists = await checkExists(name);

    if (!nameExists) {
      return name;
    }

    attempts++;
  }

  // Fallback with longer hash if we can't find a unique name
  const longHash = crypto
    .createHash('sha256')
    .update(title + Date.now().toString() + Math.random())
    .digest('hex')
    .substring(0, 8);

  return `case-inv-${longHash}`;
}

/**
 * Generate a Slack channel name from a title
 * Channel names must be 21 characters or less, lowercase, and contain only letters, numbers, hyphens, and underscores
 */
export function generateChannelName(title: string): string {
  // Convert to lowercase and replace non-allowed characters with hyphens
  let channelName = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens

  // If empty after sanitization, use a default
  if (!channelName) {
    channelName = 'investigation';
  }

  // Add case prefix
  const prefix = 'case-';
  
  // Generate random suffix (3 characters)
  const randomSuffix = crypto.randomBytes(2).toString('hex').substring(0, 3);
  
  // Calculate available length for the title part
  // Max 21 chars - 5 for "case-" - 4 for "-xxx" suffix = 12 chars for title
  const maxTitleLength = 21 - prefix.length - randomSuffix.length - 1;
  
  // Truncate channel name if needed
  if (channelName.length > maxTitleLength) {
    channelName = channelName.substring(0, maxTitleLength);
    // Remove trailing hyphen if any
    channelName = channelName.replace(/-$/, '');
  }
  
  return `${prefix}${channelName}-${randomSuffix}`;
}
