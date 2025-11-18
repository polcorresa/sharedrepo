/**
 * Tree validation utilities for folder/file operations
 * 
 * These utilities help enforce constraints and detect conflicts
 * in the hierarchical tree structure.
 */

/**
 * Error thrown when a tree operation would create a cycle
 */
export class CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CycleError';
  }
}

/**
 * Error thrown when a duplicate name is detected among siblings
 */
export class DuplicateNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateNameError';
  }
}

/**
 * Error thrown when optimistic concurrency check fails (version mismatch)
 */
export class VersionMismatchError extends Error {
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(message: string, expectedVersion: number, actualVersion: number) {
    super(message);
    this.name = 'VersionMismatchError';
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Represents a tree node (folder or file) with minimal required fields
 */
export interface TreeNode {
  id: number;
  name: string;
  parent_folder_id: number | null;
  version?: number;
  updated_at?: Date | string;
}

/**
 * Represents a folder node with parent relationship
 */
export interface FolderNode {
  id: number;
  parent_folder_id: number | null;
}

/**
 * Checks if a name is unique among sibling nodes.
 *
 * @param name - Name to check
 * @param parentFolderId - Parent folder ID (null for root)
 * @param siblings - Array of sibling nodes
 * @param excludeId - Optional ID to exclude from check (for rename operations)
 * @returns true if name is unique
 *
 * @example
 * const siblings = [
 *   { id: 1, name: 'file1.ts', parent_folder_id: 5 },
 *   { id: 2, name: 'file2.ts', parent_folder_id: 5 },
 * ];
 * isNameUnique('file3.ts', 5, siblings); // true
 * isNameUnique('file1.ts', 5, siblings); // false
 * isNameUnique('file1.ts', 5, siblings, 1); // true (excluding self)
 */
export const isNameUnique = (
  name: string,
  parentFolderId: number | null,
  siblings: TreeNode[],
  excludeId?: number
): boolean => {
  const normalizedName = name.toLowerCase();

  return !siblings.some(
    (node) =>
      node.parent_folder_id === parentFolderId &&
      node.name.toLowerCase() === normalizedName &&
      node.id !== excludeId
  );
};

/**
 * Validates that a name is unique among siblings, throwing if not.
 *
 * @param name - Name to validate
 * @param parentFolderId - Parent folder ID (null for root)
 * @param siblings - Array of sibling nodes
 * @param excludeId - Optional ID to exclude from check
 * @throws {DuplicateNameError} If name is not unique
 *
 * @example
 * validateNameUnique('file1.ts', 5, siblings);
 * // Throws if duplicate found
 */
export const validateNameUnique = (
  name: string,
  parentFolderId: number | null,
  siblings: TreeNode[],
  excludeId?: number
): void => {
  if (!isNameUnique(name, parentFolderId, siblings, excludeId)) {
    const location = parentFolderId === null ? 'root' : `folder ${parentFolderId}`;
    throw new DuplicateNameError(
      `A file or folder named "${name}" already exists in ${location}`
    );
  }
};

/**
 * Checks if moving a folder would create a cycle.
 * A cycle occurs when a folder is moved into one of its descendants.
 *
 * @param folderId - ID of folder being moved
 * @param targetParentId - ID of target parent folder (null for root)
 * @param folders - Array of all folders with parent relationships
 * @returns true if move would create a cycle
 *
 * @example
 * const folders = [
 *   { id: 1, parent_folder_id: null },
 *   { id: 2, parent_folder_id: 1 },
 *   { id: 3, parent_folder_id: 2 },
 * ];
 * wouldCreateCycle(1, 3, folders); // true (moving 1 into its descendant 3)
 * wouldCreateCycle(3, 1, folders); // false (moving up is ok)
 */
export const wouldCreateCycle = (
  folderId: number,
  targetParentId: number | null,
  folders: FolderNode[]
): boolean => {
  // Moving to root is always safe
  if (targetParentId === null) {
    return false;
  }

  // Can't move into itself
  if (folderId === targetParentId) {
    return true;
  }

  // Check if targetParentId is a descendant of folderId
  return isDescendant(targetParentId, folderId, folders);
};

/**
 * Checks if a folder is a descendant of another folder.
 *
 * @param folderId - Potential descendant folder ID
 * @param ancestorId - Potential ancestor folder ID
 * @param folders - Array of all folders
 * @returns true if folderId is a descendant of ancestorId
 *
 * @example
 * const folders = [
 *   { id: 1, parent_folder_id: null },
 *   { id: 2, parent_folder_id: 1 },
 *   { id: 3, parent_folder_id: 2 },
 * ];
 * isDescendant(3, 1, folders); // true (3 is descendant of 1)
 * isDescendant(1, 3, folders); // false (1 is ancestor, not descendant)
 */
export const isDescendant = (
  folderId: number,
  ancestorId: number,
  folders: FolderNode[]
): boolean => {
  let currentId: number | null = folderId;
  const visited = new Set<number>();

  while (currentId !== null) {
    // Detect infinite loops (shouldn't happen with valid data)
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    // Found the ancestor
    if (currentId === ancestorId) {
      return true;
    }

    // Move up to parent
    const folder = folders.find((f) => f.id === currentId);
    if (!folder) {
      return false;
    }

    currentId = folder.parent_folder_id;
  }

  return false;
};

/**
 * Validates that moving a folder won't create a cycle.
 *
 * @param folderId - ID of folder being moved
 * @param targetParentId - ID of target parent folder
 * @param folders - Array of all folders
 * @throws {CycleError} If move would create a cycle
 *
 * @example
 * validateNoCycle(1, 3, folders);
 * // Throws if moving 1 into its descendant 3
 */
export const validateNoCycle = (
  folderId: number,
  targetParentId: number | null,
  folders: FolderNode[]
): void => {
  if (wouldCreateCycle(folderId, targetParentId, folders)) {
    throw new CycleError(
      `Cannot move folder ${folderId} into folder ${targetParentId}: would create a cycle`
    );
  }
};

/**
 * Checks if a version matches the expected version (optimistic concurrency).
 *
 * @param expectedVersion - Version client expects
 * @param actualVersion - Current version from database
 * @returns true if versions match
 *
 * @example
 * isVersionMatch(5, 5); // true
 * isVersionMatch(5, 6); // false (version changed)
 */
export const isVersionMatch = (
  expectedVersion: number,
  actualVersion: number
): boolean => {
  return expectedVersion === actualVersion;
};

/**
 * Validates version match, throwing if mismatch detected.
 *
 * @param expectedVersion - Version client expects
 * @param actualVersion - Current version from database
 * @param resourceType - Type of resource (for error message)
 * @param resourceId - ID of resource (for error message)
 * @throws {VersionMismatchError} If versions don't match
 *
 * @example
 * validateVersion(5, 6, 'folder', 123);
 * // Throws: "Version mismatch for folder 123..."
 */
export const validateVersion = (
  expectedVersion: number,
  actualVersion: number,
  resourceType: string,
  resourceId: number
): void => {
  if (!isVersionMatch(expectedVersion, actualVersion)) {
    throw new VersionMismatchError(
      `Version mismatch for ${resourceType} ${resourceId}: ` +
        `expected ${expectedVersion}, got ${actualVersion}. ` +
        `The ${resourceType} was modified by another user.`,
      expectedVersion,
      actualVersion
    );
  }
};

/**
 * Checks if an updated_at timestamp is more recent than expected.
 * Used as alternative to version-based optimistic concurrency.
 *
 * @param expectedUpdatedAt - Timestamp client expects
 * @param actualUpdatedAt - Current timestamp from database
 * @returns true if timestamps match (allowing small tolerance)
 *
 * @example
 * const expected = new Date('2024-01-01T10:00:00Z');
 * const actual = new Date('2024-01-01T10:00:00Z');
 * isTimestampMatch(expected, actual); // true
 */
export const isTimestampMatch = (
  expectedUpdatedAt: Date | string,
  actualUpdatedAt: Date | string
): boolean => {
  const expectedTime =
    typeof expectedUpdatedAt === 'string'
      ? new Date(expectedUpdatedAt).getTime()
      : expectedUpdatedAt.getTime();

  const actualTime =
    typeof actualUpdatedAt === 'string'
      ? new Date(actualUpdatedAt).getTime()
      : actualUpdatedAt.getTime();

  // Allow 1 second tolerance for clock skew
  const tolerance = 1000;
  return Math.abs(actualTime - expectedTime) < tolerance;
};

/**
 * Validates timestamp match, throwing if resource was modified.
 *
 * @param expectedUpdatedAt - Timestamp client expects
 * @param actualUpdatedAt - Current timestamp from database
 * @param resourceType - Type of resource (for error message)
 * @param resourceId - ID of resource (for error message)
 * @throws {VersionMismatchError} If timestamps don't match
 *
 * @example
 * validateTimestamp(oldTimestamp, currentTimestamp, 'file', 456);
 * // Throws if file was modified since oldTimestamp
 */
export const validateTimestamp = (
  expectedUpdatedAt: Date | string,
  actualUpdatedAt: Date | string,
  resourceType: string,
  resourceId: number
): void => {
  if (!isTimestampMatch(expectedUpdatedAt, actualUpdatedAt)) {
    const expected =
      typeof expectedUpdatedAt === 'string'
        ? expectedUpdatedAt
        : expectedUpdatedAt.toISOString();
    const actual =
      typeof actualUpdatedAt === 'string'
        ? actualUpdatedAt
        : actualUpdatedAt.toISOString();

    throw new VersionMismatchError(
      `Timestamp mismatch for ${resourceType} ${resourceId}: ` +
        `expected ${expected}, got ${actual}. ` +
        `The ${resourceType} was modified by another user.`,
      0, // Not applicable for timestamp-based
      0
    );
  }
};

/**
 * Gets all ancestor folder IDs for a folder.
 *
 * @param folderId - ID of folder to get ancestors for
 * @param folders - Array of all folders
 * @returns Array of ancestor folder IDs (closest to farthest)
 *
 * @example
 * const folders = [
 *   { id: 1, parent_folder_id: null },
 *   { id: 2, parent_folder_id: 1 },
 *   { id: 3, parent_folder_id: 2 },
 * ];
 * getAncestors(3, folders); // [2, 1]
 */
export const getAncestors = (
  folderId: number,
  folders: FolderNode[]
): number[] => {
  const ancestors: number[] = [];
  let currentId: number | null = folderId;
  const visited = new Set<number>();

  while (currentId !== null) {
    // Detect cycles in data
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const folder = folders.find((f) => f.id === currentId);
    if (!folder || folder.parent_folder_id === null) {
      break;
    }

    ancestors.push(folder.parent_folder_id);
    currentId = folder.parent_folder_id;
  }

  return ancestors;
};

/**
 * Gets all descendant folder IDs for a folder.
 *
 * @param folderId - ID of folder to get descendants for
 * @param folders - Array of all folders
 * @returns Array of descendant folder IDs
 *
 * @example
 * const folders = [
 *   { id: 1, parent_folder_id: null },
 *   { id: 2, parent_folder_id: 1 },
 *   { id: 3, parent_folder_id: 2 },
 *   { id: 4, parent_folder_id: 1 },
 * ];
 * getDescendants(1, folders); // [2, 4, 3]
 */
export const getDescendants = (
  folderId: number,
  folders: FolderNode[]
): number[] => {
  const descendants: number[] = [];
  const queue = [folderId];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Find direct children
    const children = folders.filter((f) => f.parent_folder_id === currentId);

    for (const child of children) {
      if (child.id !== folderId) {
        // Don't include the folder itself
        descendants.push(child.id);
        queue.push(child.id);
      }
    }
  }

  return descendants;
};

/**
 * Calculates the depth of a folder in the tree (0 = root level).
 *
 * @param folderId - ID of folder
 * @param folders - Array of all folders
 * @returns Depth (0 for root-level folders)
 *
 * @example
 * const folders = [
 *   { id: 1, parent_folder_id: null },     // depth 0
 *   { id: 2, parent_folder_id: 1 },        // depth 1
 *   { id: 3, parent_folder_id: 2 },        // depth 2
 * ];
 * getFolderDepth(3, folders); // 2
 */
export const getFolderDepth = (
  folderId: number,
  folders: FolderNode[]
): number => {
  return getAncestors(folderId, folders).length;
};
