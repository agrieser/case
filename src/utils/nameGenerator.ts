import crypto from 'crypto';

// Keywords mapped to relevant descriptors
const keywordMap: Record<string, string[]> = {
  // Technical issues
  'api': ['swift', 'responsive', 'connected', 'networked'],
  'database': ['persistent', 'indexed', 'stored', 'cached'],
  'db': ['persistent', 'indexed', 'stored', 'cached'],
  'css': ['styled', 'visual', 'designed', 'formatted'],
  'style': ['styled', 'visual', 'designed', 'formatted'],
  'performance': ['swift', 'rapid', 'optimized', 'efficient'],
  'slow': ['sluggish', 'delayed', 'lagging', 'crawling'],
  'error': ['broken', 'failed', 'crashed', 'glitched'],
  'bug': ['broken', 'failed', 'crashed', 'glitched'],
  'security': ['secured', 'protected', 'guarded', 'shielded'],
  'auth': ['secured', 'protected', 'locked', 'gated'],
  'payment': ['financial', 'monetary', 'transacted', 'charged'],
  'network': ['connected', 'linked', 'routed', 'transmitted'],
  'memory': ['cached', 'stored', 'allocated', 'buffered'],
  'cpu': ['processed', 'computed', 'calculated', 'executed'],

  // General descriptors
  'issue': ['troubled', 'problematic', 'affected', 'impacted'],
  'problem': ['troubled', 'problematic', 'affected', 'impacted'],
  'investigation': ['curious', 'searching', 'hunting', 'tracking'],
  'incident': ['urgent', 'critical', 'alerted', 'escalated'],

  // Default fallbacks
  'default': ['mysterious', 'unknown', 'general', 'standard'],
};

// Animals/nouns grouped by characteristics
const nounGroups: Record<string, string[]> = {
  // Fast/performance related
  'swift': ['falcon', 'cheetah', 'hawk', 'eagle', 'gazelle'],
  'rapid': ['falcon', 'cheetah', 'hawk', 'eagle', 'gazelle'],

  // Strong/reliable
  'persistent': ['elephant', 'tortoise', 'oak', 'mountain', 'boulder'],
  'stored': ['squirrel', 'bear', 'vault', 'archive', 'cache'],

  // Network/connected
  'connected': ['spider', 'web', 'network', 'mesh', 'grid'],
  'linked': ['chain', 'bridge', 'connector', 'junction', 'hub'],

  // Visual/design
  'styled': ['peacock', 'butterfly', 'rainbow', 'prism', 'palette'],
  'visual': ['eagle', 'hawk', 'observer', 'watcher', 'viewer'],

  // Security related
  'secured': ['fortress', 'guardian', 'sentinel', 'shield', 'vault'],
  'protected': ['guardian', 'defender', 'armor', 'barrier', 'wall'],

  // Problem/issue related
  'broken': ['puzzle', 'fracture', 'glitch', 'anomaly', 'defect'],
  'troubled': ['storm', 'tempest', 'chaos', 'turbulence', 'vortex'],

  // Default animals
  'default': ['wolf', 'bear', 'fox', 'raven', 'owl', 'tiger', 'lion', 'dragon'],
};

/**
 * Extract keywords from investigation title
 */
function extractKeywords(title: string): string[] {
  const words = title.toLowerCase().split(/\s+/);
  const keywords: string[] = [];

  for (const word of words) {
    // Check if word or its stem matches any keyword
    for (const keyword of Object.keys(keywordMap)) {
      if (word.includes(keyword) || keyword.includes(word)) {
        keywords.push(keyword);
      }
    }
  }

  return keywords.length > 0 ? keywords : ['default'];
}

/**
 * Get descriptor based on keywords
 */
function getDescriptor(keywords: string[]): string {
  const descriptors: string[] = [];

  for (const keyword of keywords) {
    const mapped = keywordMap[keyword] || keywordMap['default'];
    descriptors.push(...mapped);
  }

  // Remove duplicates and pick random
  const unique = [...new Set(descriptors)];
  return unique[Math.floor(Math.random() * unique.length)];
}

/**
 * Get noun based on descriptor
 */
function getNoun(descriptor: string): string {
  // Find noun groups that match the descriptor
  const matchingGroups: string[] = [];

  for (const [key, nouns] of Object.entries(nounGroups)) {
    if (descriptor.includes(key) || key.includes(descriptor)) {
      matchingGroups.push(...nouns);
    }
  }

  // If no matches, use default
  if (matchingGroups.length === 0) {
    matchingGroups.push(...nounGroups['default']);
  }

  // Remove duplicates and pick random
  const unique = [...new Set(matchingGroups)];
  return unique[Math.floor(Math.random() * unique.length)];
}

/**
 * Generate a short hash for uniqueness
 */
function generateHash(input: string): string {
  return crypto
    .createHash('sha256')
    .update(input + Date.now().toString())
    .digest('hex')
    .substring(0, 4);
}

/**
 * Generate investigation name based on title
 */
export function generateInvestigationName(title: string): string {
  // Extract keywords from title
  const keywords = extractKeywords(title);

  // Get descriptor based on keywords
  const descriptor = getDescriptor(keywords);

  // Get noun based on descriptor
  const noun = getNoun(descriptor);

  // Add short hash for uniqueness
  const hash = generateHash(title);

  return `trace-${descriptor}-${noun}-${hash}`;
}

/**
 * Generate unique name with existence check
 */
export async function generateUniqueName(
  title: string,
  checkExists: (name: string) => Promise<boolean>
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const name = generateInvestigationName(title);
    const exists = await checkExists(name);

    if (!exists) {
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

  return `trace-investigation-${longHash}`;
}
