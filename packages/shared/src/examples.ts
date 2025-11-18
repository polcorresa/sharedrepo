/**
 * Example usage of shared utilities
 * 
 * This file demonstrates common patterns for using slug, password,
 * and expiry utilities in both frontend and backend code.
 */

import {
  normalizeSlug,
  isSlugValid,
  validateSlug,
  validateSlugDetailed,
  validateAndNormalize,
  sanitizeSlug,
  suggestSlug,
  MAX_SLUG_LENGTH,
  MIN_SLUG_LENGTH,
  type SlugValidationResult,
} from './index.js';

import {
  isExpired,
  getDaysUntilExpiry,
  getExpiryCutoffDate,
  formatTimeUntilExpiry,
  isExpiringSoon,
} from './utils/expiry.js';

// ============================================================================
// Example 1: Frontend Form Validation
// ============================================================================

function handleRepoCreation(userInput: string, password: string) {
  // Validate and normalize user input
  const result = validateAndNormalize(userInput);

  if (!result.valid) {
    console.error(`Invalid slug: ${result.message}`);
    return;
  }

  // Use normalized slug for API call
  console.log(`Creating repo with slug: ${result.normalized}`);
  // createRepoAPI(result.normalized, password);
}

// Test various inputs
handleRepoCreation('MyRepo', 'password');        // ✓ Valid: 'myrepo'
handleRepoCreation('  TEST123  ', 'password');   // ✓ Valid: 'test123'
handleRepoCreation('my-repo', 'password');       // ✗ Invalid: hyphens not allowed
handleRepoCreation('a'.repeat(25), 'password');  // ✗ Invalid: too long

// ============================================================================
// Example 2: Auto-suggest Slug from Project Name
// ============================================================================

function suggestSlugFromName(projectName: string): string {
  // Generate valid slug from arbitrary text
  const suggested = suggestSlug(projectName);

  console.log(`Project: "${projectName}" → Slug: "${suggested}"`);

  return suggested;
}

// Test suggestions
suggestSlugFromName('My Awesome Project');      // 'myawesomeproject'
suggestSlugFromName('Test-Project_2024');       // 'testproject2024'
suggestSlugFromName('!!!');                     // 'repo' (fallback)
suggestSlugFromName('Backend API v2.0');        // 'backendapiv20'

// ============================================================================
// Example 3: Backend URL Parameter Validation
// ============================================================================

function getRepoBySlug(urlSlug: string) {
  // Normalize slug from URL parameter
  const normalized = normalizeSlug(urlSlug);

  // Quick validation check
  if (!isSlugValid(normalized)) {
    console.error('Invalid slug format');
    return null;
  }

  console.log(`Looking up repo: ${normalized}`);
  // return db.selectFrom('repos').where('slug', '=', normalized)...
}

// Test URL parameters
getRepoBySlug('MyRepo');      // ✓ Normalized to 'myrepo'
getRepoBySlug('test123');     // ✓ Valid as-is
getRepoBySlug('invalid!');    // ✗ Invalid characters

// ============================================================================
// Example 4: Detailed Validation Feedback
// ============================================================================

function validateWithFeedback(input: string): void {
  const result = validateSlugDetailed(input);

  if (result.valid) {
    console.log(`✓ Valid slug: "${result.normalized}"`);
  } else {
    console.log(`✗ Invalid slug: ${result.error}`);
    console.log(`  Message: ${result.message}`);
  }
}

// Test various error cases
validateWithFeedback('myrepo');              // ✓ Valid
validateWithFeedback('');                    // ✗ empty
validateWithFeedback('a'.repeat(21));        // ✗ too_long
validateWithFeedback('My-Repo');             // ✗ invalid_characters

// ============================================================================
// Example 5: Sanitize User Input
// ============================================================================

function cleanupSlug(dirtyInput: string): string {
  // Remove invalid characters and truncate
  const cleaned = sanitizeSlug(dirtyInput);

  if (cleaned.length === 0) {
    console.log('Input had no valid characters, using fallback');
    return 'repo';
  }

  console.log(`Cleaned "${dirtyInput}" → "${cleaned}"`);
  return cleaned;
}

// Test sanitization
cleanupSlug('My-Awesome_Repo!');     // 'myawesomerepo'
cleanupSlug('test@#$%repo');         // 'testrepo'
cleanupSlug('!!!');                  // '' (empty)
cleanupSlug('a'.repeat(30));         // 'aaaaa...' (20 chars)

// ============================================================================
// Example 6: Validate with Zod (throws on error)
// ============================================================================

function strictValidation(input: string): string {
  try {
    // This throws ZodError if validation fails
    const validSlug = validateSlug(input);
    console.log(`✓ Strict validation passed: ${validSlug}`);
    return validSlug;
  } catch (error) {
    console.error('✗ Strict validation failed:', error);
    throw error;
  }
}

// Test strict validation
strictValidation('myrepo');      // ✓ Pass
// strictValidation('INVALID');  // ✗ Throws ZodError

// ============================================================================
// Example 7: Real-world API Handler Pattern
// ============================================================================

interface CreateRepoRequest {
  slug: string;
  password: string;
}

interface APIResponse {
  success: boolean;
  data?: { slug: string };
  error?: string;
}

function createRepoHandler(request: CreateRepoRequest): APIResponse {
  // 1. Validate and normalize slug
  const slugResult = validateAndNormalize(request.slug);

  if (!slugResult.valid) {
    return {
      success: false,
      error: slugResult.message,
    };
  }

  // 2. Check password length (simplified)
  if (request.password.length < 4) {
    return {
      success: false,
      error: 'Password must be at least 4 characters',
    };
  }

  // 3. Use normalized slug for DB operations
  const normalizedSlug = slugResult.normalized!;

  console.log(`Creating repo with slug: ${normalizedSlug}`);
  // const repo = await db.insertInto('repos')...

  return {
    success: true,
    data: { slug: normalizedSlug },
  };
}

// Test API handler
console.log(createRepoHandler({ slug: 'MyRepo', password: 'secret' }));
// { success: true, data: { slug: 'myrepo' } }

console.log(createRepoHandler({ slug: 'invalid!', password: 'secret' }));
// { success: false, error: '...' }

// ============================================================================
// Example 8: Constants Usage
// ============================================================================

console.log(`Slug constraints:`);
console.log(`- Min length: ${MIN_SLUG_LENGTH}`);
console.log(`- Max length: ${MAX_SLUG_LENGTH}`);
console.log(`- Allowed chars: a-z, 0-9`);

// Use constants for validation
function checkSlugLength(slug: string): boolean {
  return (
    slug.length >= MIN_SLUG_LENGTH &&
    slug.length <= MAX_SLUG_LENGTH
  );
}

console.log(checkSlugLength('a'));            // true
console.log(checkSlugLength('a'.repeat(20))); // true
console.log(checkSlugLength('a'.repeat(21))); // false

// ============================================================================
// Example 9: Type-safe Validation Result Handling
// ============================================================================

function handleValidationResult(result: SlugValidationResult): void {
  // TypeScript knows the shape of the result
  if (result.valid) {
    // In valid branch, normalized is guaranteed to exist
    const slug: string = result.normalized!;
    console.log(`Using slug: ${slug}`);
  } else {
    // In invalid branch, error and message exist
    console.log(`Error type: ${result.error}`);
    console.log(`Message: ${result.message}`);
  }
}

// ============================================================================
// Example 10: Batch Validation
// ============================================================================

function validateManySlugs(slugs: string[]): void {
  console.log('\nBatch validation:');

  const results = slugs.map((slug) => ({
    input: slug,
    ...validateAndNormalize(slug),
  }));

  const valid = results.filter((r) => r.valid);
  const invalid = results.filter((r) => !r.valid);

  console.log(`Valid slugs (${valid.length}):`);
  valid.forEach((r) => console.log(`  - ${r.input} → ${r.normalized}`));

  console.log(`Invalid slugs (${invalid.length}):`);
  invalid.forEach((r) => console.log(`  - ${r.input}: ${r.message}`));
}

validateManySlugs([
  'myrepo',
  'test123',
  'INVALID',
  'my-repo',
  'ok',
  'a'.repeat(25),
]);

// ============================================================================
// Run all examples
// ============================================================================

console.log('\n=== All slug and password validation examples completed ===\n');

// ============================================================================
// Expiry Calculation Examples
// ============================================================================

console.log('\n=== Expiry Calculation Examples ===\n');

// Example 11: Check if repo is expired
function checkRepoExpiry(lastAccessedAt: Date) {
  const now = new Date();
  
  if (isExpired(lastAccessedAt, now)) {
    console.log('Repo has expired and should be deleted');
    return false;
  }
  
  const daysLeft = getDaysUntilExpiry(lastAccessedAt, now);
  console.log(`Repo expires in ${daysLeft} days`);
  
  if (isExpiringSoon(lastAccessedAt, now)) {
    console.log('⚠️ Repo expires within 24 hours!');
  }
  
  return true;
}

// Example 12: Database cleanup job
function cleanupExpiredRepos() {
  const now = new Date();
  const cutoffDate = getExpiryCutoffDate(now);
  
  console.log(`Deleting repos last accessed before: ${cutoffDate.toISOString()}`);
  
  // In real code:
  // await db
  //   .deleteFrom('repos')
  //   .where('last_accessed_at', '<', cutoffDate)
  //   .execute();
}

// Example 13: Display expiry warning to user
function getRepoExpiryMessage(lastAccessedAt: Date): string {
  const timeLeft = formatTimeUntilExpiry(lastAccessedAt);
  
  if (timeLeft === 'Expired') {
    return '🔴 This repo has expired';
  }
  
  if (isExpiringSoon(lastAccessedAt)) {
    return `⚠️ This repo expires in ${timeLeft}`;
  }
  
  return `✓ This repo expires in ${timeLeft}`;
}

// Test expiry examples
const recentAccess = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
const oldAccess = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

console.log('Recent repo:', getRepoExpiryMessage(recentAccess));
console.log('Old repo:', getRepoExpiryMessage(oldAccess));

checkRepoExpiry(recentAccess);
cleanupExpiredRepos();

console.log('\n=== All examples completed ===\n');

// ============================================================================
// Tree Validation Examples
// ============================================================================

import {
  validateNameUnique,
  validateNoCycle,
  validateVersion,
  isDescendant,
  getDescendants,
  getAncestors,
  getFolderDepth,
  type TreeNode,
  type FolderNode,
} from './utils/tree.js';

console.log('\n=== Tree Validation Examples ===\n');

// Example 14: Create file with name validation
function createFile(
  name: string,
  parentFolderId: number | null,
  siblings: TreeNode[]
) {
  try {
    validateNameUnique(name, parentFolderId, siblings);
    console.log(`✓ Creating file: ${name}`);
    // In real code: await db.insertInto('files')...
  } catch (error) {
    console.error(`✗ Cannot create file "${name}":`, (error as Error).message);
  }
}

const existingFiles: TreeNode[] = [
  { id: 1, name: 'index.ts', parent_folder_id: 5, version: 1 },
  { id: 2, name: 'utils.ts', parent_folder_id: 5, version: 1 },
];

createFile('app.ts', 5, existingFiles);      // ✓ Success
createFile('index.ts', 5, existingFiles);    // ✗ Duplicate
createFile('INDEX.TS', 5, existingFiles);    // ✗ Duplicate (case-insensitive)

// Example 15: Move folder with cycle detection
function moveFolder(
  folderId: number,
  newParentId: number | null,
  folders: FolderNode[]
) {
  try {
    validateNoCycle(folderId, newParentId, folders);
    console.log(`✓ Moving folder ${folderId} to ${newParentId || 'root'}`);
    // In real code: await db.updateTable('folders')...
  } catch (error) {
    console.error(`✗ Cannot move folder:`, (error as Error).message);
  }
}

const folderStructure: FolderNode[] = [
  { id: 1, parent_folder_id: null },     // root
  { id: 2, parent_folder_id: 1 },        // child of 1
  { id: 3, parent_folder_id: 2 },        // child of 2
];

moveFolder(3, 1, folderStructure);       // ✓ Moving up is ok
moveFolder(1, 3, folderStructure);       // ✗ Would create cycle
moveFolder(2, 2, folderStructure);       // ✗ Cannot move into itself

// Example 16: Rename with version check (optimistic concurrency)
function renameNode(
  nodeId: number,
  newName: string,
  expectedVersion: number,
  currentVersion: number,
  siblings: TreeNode[],
  parentFolderId: number | null
) {
  try {
    // Check version first
    validateVersion(expectedVersion, currentVersion, 'file', nodeId);

    // Then check name uniqueness (excluding current node)
    validateNameUnique(newName, parentFolderId, siblings, nodeId);

    console.log(`✓ Renaming node ${nodeId} to "${newName}"`);
    // In real code: await db.updateTable('files').set({ name: newName, version: version + 1 })...
  } catch (error) {
    console.error(`✗ Cannot rename:`, (error as Error).message);
  }
}

const files: TreeNode[] = [
  { id: 10, name: 'old-name.ts', parent_folder_id: 5, version: 3 },
  { id: 11, name: 'other.ts', parent_folder_id: 5, version: 1 },
];

renameNode(10, 'new-name.ts', 3, 3, files, 5);  // ✓ Version matches
renameNode(10, 'new-name.ts', 3, 4, files, 5);  // ✗ Version mismatch (concurrent edit)
renameNode(10, 'other.ts', 3, 3, files, 5);     // ✗ Duplicate name

// Example 17: Delete folder and all descendants
function deleteFolderRecursive(folderId: number, folders: FolderNode[]) {
  const descendants = getDescendants(folderId, folders);

  console.log(
    `Deleting folder ${folderId} and ${descendants.length} descendants`
  );

  // In real transaction:
  // 1. Delete all files in descendant folders
  // 2. Delete descendant folders (deepest first)
  // 3. Delete the folder itself

  if (descendants.length > 0) {
    console.log(`  Descendants: [${descendants.join(', ')}]`);
  }

  // In real code: await db.transaction()...
}

const largeStructure: FolderNode[] = [
  { id: 1, parent_folder_id: null },
  { id: 2, parent_folder_id: 1 },
  { id: 3, parent_folder_id: 2 },
  { id: 4, parent_folder_id: 2 },
  { id: 5, parent_folder_id: 3 },
];

deleteFolderRecursive(2, largeStructure);  // Deletes 2, 3, 4, 5

// Example 18: Check folder relationships
function analyzeFolderRelationship(
  folderId: number,
  otherId: number,
  folders: FolderNode[]
) {
  if (isDescendant(folderId, otherId, folders)) {
    console.log(`Folder ${folderId} is a descendant of ${otherId}`);
  } else if (isDescendant(otherId, folderId, folders)) {
    console.log(`Folder ${otherId} is a descendant of ${folderId}`);
  } else {
    console.log(`Folders ${folderId} and ${otherId} are not related`);
  }
}

analyzeFolderRelationship(3, 1, largeStructure);  // 3 is descendant of 1
analyzeFolderRelationship(2, 4, largeStructure);  // 4 is descendant of 2

// Example 19: Display folder depth for UI indentation
function displayFolderTree(folders: FolderNode[]) {
  console.log('\nFolder tree:');

  folders.forEach((folder) => {
    const depth = getFolderDepth(folder.id, folders);
    const indent = '  '.repeat(depth);
    const ancestors = getAncestors(folder.id, folders);

    console.log(
      `${indent}├─ Folder ${folder.id} (depth: ${depth}, ancestors: [${ancestors.join(', ')}])`
    );
  });
}

displayFolderTree(largeStructure);

console.log('\n=== All tree validation examples completed ===\n');

// ============================================================================
// Language Detection Examples
// ============================================================================

import {
  detectLanguage,
  getFileExtension,
  getLanguageName,
  getSupportedLanguages,
  getExtensionsForLanguage,
  suggestExtension,
  isExtensionRecognized,
} from './utils/language.js';

console.log('\n=== Language Detection Examples ===\n');

// Example 20: Detect language for Monaco Editor
function setupMonacoEditor(filename: string) {
  const language = detectLanguage(filename);
  const displayName = getLanguageName(language);

  console.log(`File: ${filename}`);
  console.log(`  Language ID: ${language}`);
  console.log(`  Display Name: ${displayName}`);

  // In real Monaco setup:
  // monaco.editor.create(element, {
  //   value: fileContent,
  //   language: language,
  //   theme: 'vs-dark'
  // });
}

setupMonacoEditor('index.ts');          // TypeScript
setupMonacoEditor('App.jsx');           // JavaScript
setupMonacoEditor('Dockerfile');        // Dockerfile
setupMonacoEditor('main.py');           // Python
setupMonacoEditor('unknown.xyz');       // Plain Text

// Example 21: File upload validation
function validateUploadedFile(filename: string): boolean {
  const extension = getFileExtension(filename);

  if (!extension) {
    console.log(`${filename}: No extension, treating as text file`);
    return true;
  }

  if (isExtensionRecognized(extension)) {
    const language = detectLanguage(filename);
    console.log(`${filename}: Recognized as ${language}`);
    return true;
  }

  console.log(`${filename}: Unknown extension .${extension}`);
  return true; // Still allow, but warn
}

validateUploadedFile('script.ts');      // ✓ Recognized
validateUploadedFile('README');          // ✓ No extension
validateUploadedFile('data.xyz');        // ⚠️ Unknown

// Example 22: Create file with default extension
function createNewFile(baseName: string, language: string) {
  const extension = suggestExtension(language);

  if (!extension) {
    console.log(`Unknown language: ${language}`);
    return null;
  }

  const filename = `${baseName}.${extension}`;
  console.log(`Creating ${filename} as ${language}`);

  return filename;
}

createNewFile('component', 'typescript');  // component.ts
createNewFile('utils', 'javascript');      // utils.js
createNewFile('script', 'python');         // script.py

// Example 23: Language selector for UI
function buildLanguageDropdown() {
  const languages = getSupportedLanguages();

  console.log('\nAvailable languages for dropdown:');
  languages.slice(0, 10).forEach((lang) => {
    const displayName = getLanguageName(lang);
    const extensions = getExtensionsForLanguage(lang);
    console.log(`  - ${displayName} (${lang}): .${extensions.join(', .')}`);
  });
  console.log(`  ... and ${languages.length - 10} more`);
}

buildLanguageDropdown();

// Example 24: Smart file icon selection
function getFileIcon(filename: string): string {
  const language = detectLanguage(filename);

  const iconMap: Record<string, string> = {
    typescript: '📘',
    javascript: '📙',
    python: '🐍',
    java: '☕',
    rust: '🦀',
    go: '🐹',
    markdown: '📝',
    json: '📋',
    html: '🌐',
    css: '🎨',
    dockerfile: '🐳',
    plaintext: '📄',
  };

  return iconMap[language] || '📄';
}

console.log('\nFile icons:');
console.log(`${getFileIcon('index.ts')} index.ts`);
console.log(`${getFileIcon('app.py')} app.py`);
console.log(`${getFileIcon('Dockerfile')} Dockerfile`);
console.log(`${getFileIcon('README.md')} README.md`);

// Example 25: Batch language detection for file tree
function analyzeFileTree(files: string[]) {
  const languageCounts: Record<string, number> = {};

  files.forEach((file) => {
    const language = detectLanguage(file);
    languageCounts[language] = (languageCounts[language] || 0) + 1;
  });

  console.log('\nProject language breakdown:');
  Object.entries(languageCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([lang, count]) => {
      const name = getLanguageName(lang);
      console.log(`  ${name}: ${count} files`);
    });
}

analyzeFileTree([
  'index.ts',
  'app.ts',
  'utils.ts',
  'component.tsx',
  'styles.css',
  'README.md',
  'package.json',
  'Dockerfile',
]);

console.log('\n=== All language detection examples completed ===\n');
