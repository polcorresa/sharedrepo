import { describe, it, expect } from 'vitest';
import {
  isNameUnique,
  validateNameUnique,
  wouldCreateCycle,
  validateNoCycle,
  isDescendant,
  isVersionMatch,
  validateVersion,
  isTimestampMatch,
  validateTimestamp,
  getAncestors,
  getDescendants,
  getFolderDepth,
  DuplicateNameError,
  CycleError,
  VersionMismatchError,
  type TreeNode,
  type FolderNode,
} from './tree.js';

describe('Tree Validators', () => {
  describe('isNameUnique', () => {
    const siblings: TreeNode[] = [
      { id: 1, name: 'file1.ts', parent_folder_id: 5, version: 1 },
      { id: 2, name: 'file2.ts', parent_folder_id: 5, version: 1 },
      { id: 3, name: 'File3.ts', parent_folder_id: 5, version: 1 },
      { id: 4, name: 'other.ts', parent_folder_id: 10, version: 1 },
    ];

    it('returns true for unique name', () => {
      expect(isNameUnique('file4.ts', 5, siblings)).toBe(true);
    });

    it('returns false for duplicate name', () => {
      expect(isNameUnique('file1.ts', 5, siblings)).toBe(false);
    });

    it('handles case-insensitive comparison', () => {
      expect(isNameUnique('FILE1.TS', 5, siblings)).toBe(false);
      expect(isNameUnique('file3.ts', 5, siblings)).toBe(false);
    });

    it('returns true when excluding the duplicate ID (rename scenario)', () => {
      expect(isNameUnique('file1.ts', 5, siblings, 1)).toBe(true);
    });

    it('respects parent folder scope', () => {
      expect(isNameUnique('other.ts', 5, siblings)).toBe(true);
      expect(isNameUnique('other.ts', 10, siblings)).toBe(false);
    });

    it('handles root folder (null parent)', () => {
      const rootNodes: TreeNode[] = [
        { id: 1, name: 'root-file.ts', parent_folder_id: null, version: 1 },
      ];
      expect(isNameUnique('new-file.ts', null, rootNodes)).toBe(true);
      expect(isNameUnique('root-file.ts', null, rootNodes)).toBe(false);
    });

    it('handles empty siblings array', () => {
      expect(isNameUnique('file.ts', 5, [])).toBe(true);
    });
  });

  describe('validateNameUnique', () => {
    const siblings: TreeNode[] = [
      { id: 1, name: 'file1.ts', parent_folder_id: 5, version: 1 },
      { id: 2, name: 'file2.ts', parent_folder_id: 5, version: 1 },
    ];

    it('does not throw for unique name', () => {
      expect(() => validateNameUnique('file3.ts', 5, siblings)).not.toThrow();
    });

    it('throws DuplicateNameError for duplicate', () => {
      expect(() => validateNameUnique('file1.ts', 5, siblings)).toThrow(
        DuplicateNameError
      );
      expect(() => validateNameUnique('file1.ts', 5, siblings)).toThrow(
        /already exists in folder 5/
      );
    });

    it('error message mentions root for null parent', () => {
      const rootNodes: TreeNode[] = [
        { id: 1, name: 'file.ts', parent_folder_id: null, version: 1 },
      ];
      expect(() => validateNameUnique('file.ts', null, rootNodes)).toThrow(/root/);
    });

    it('does not throw when excluding duplicate ID', () => {
      expect(() => validateNameUnique('file1.ts', 5, siblings, 1)).not.toThrow();
    });
  });

  describe('wouldCreateCycle', () => {
    const folders: FolderNode[] = [
      { id: 1, parent_folder_id: null },
      { id: 2, parent_folder_id: 1 },
      { id: 3, parent_folder_id: 2 },
      { id: 4, parent_folder_id: 3 },
      { id: 5, parent_folder_id: 1 },
    ];

    it('returns false for moving to root', () => {
      expect(wouldCreateCycle(3, null, folders)).toBe(false);
    });

    it('returns true for moving into itself', () => {
      expect(wouldCreateCycle(2, 2, folders)).toBe(true);
    });

    it('returns true for moving into descendant', () => {
      expect(wouldCreateCycle(1, 3, folders)).toBe(true);
      expect(wouldCreateCycle(2, 4, folders)).toBe(true);
    });

    it('returns false for moving into sibling', () => {
      expect(wouldCreateCycle(2, 5, folders)).toBe(false);
    });

    it('returns false for moving up the tree', () => {
      expect(wouldCreateCycle(3, 1, folders)).toBe(false);
      expect(wouldCreateCycle(4, 2, folders)).toBe(false);
    });

    it('returns false for moving to a different branch', () => {
      expect(wouldCreateCycle(3, 5, folders)).toBe(false);
    });
  });

  describe('isDescendant', () => {
    const folders: FolderNode[] = [
      { id: 1, parent_folder_id: null },
      { id: 2, parent_folder_id: 1 },
      { id: 3, parent_folder_id: 2 },
      { id: 4, parent_folder_id: 1 },
    ];

    it('returns true for direct child', () => {
      expect(isDescendant(2, 1, folders)).toBe(true);
    });

    it('returns true for indirect descendant', () => {
      expect(isDescendant(3, 1, folders)).toBe(true);
    });

    it('returns false for ancestor', () => {
      expect(isDescendant(1, 3, folders)).toBe(false);
    });

    it('returns false for sibling', () => {
      expect(isDescendant(2, 4, folders)).toBe(false);
    });

    it('returns false for unrelated folders', () => {
      expect(isDescendant(10, 20, folders)).toBe(false);
    });

    it('handles cycle detection with corrupted data', () => {
      const corruptedFolders: FolderNode[] = [
        { id: 1, parent_folder_id: 2 },
        { id: 2, parent_folder_id: 1 },
      ];
      // In a cycle, the function should detect the visited set and return false
      // rather than infinitely looping. Testing both directions.
      const result1 = isDescendant(1, 2, corruptedFolders);
      const result2 = isDescendant(2, 1, corruptedFolders);
      // At least one should be true (since 1 points to 2 as parent)
      // but the function should not hang
      expect(result1 || result2).toBe(true);
    });
  });

  describe('validateNoCycle', () => {
    const folders: FolderNode[] = [
      { id: 1, parent_folder_id: null },
      { id: 2, parent_folder_id: 1 },
      { id: 3, parent_folder_id: 2 },
    ];

    it('does not throw for valid move', () => {
      expect(() => validateNoCycle(3, 1, folders)).not.toThrow();
    });

    it('throws CycleError for move into descendant', () => {
      expect(() => validateNoCycle(1, 3, folders)).toThrow(CycleError);
      expect(() => validateNoCycle(1, 3, folders)).toThrow(/would create a cycle/);
    });

    it('throws CycleError for move into itself', () => {
      expect(() => validateNoCycle(2, 2, folders)).toThrow(CycleError);
    });

    it('does not throw for move to root', () => {
      expect(() => validateNoCycle(3, null, folders)).not.toThrow();
    });
  });

  describe('isVersionMatch', () => {
    it('returns true for matching versions', () => {
      expect(isVersionMatch(5, 5)).toBe(true);
      expect(isVersionMatch(0, 0)).toBe(true);
      expect(isVersionMatch(999, 999)).toBe(true);
    });

    it('returns false for mismatched versions', () => {
      expect(isVersionMatch(5, 6)).toBe(false);
      expect(isVersionMatch(10, 9)).toBe(false);
    });
  });

  describe('validateVersion', () => {
    it('does not throw for matching versions', () => {
      expect(() => validateVersion(5, 5, 'folder', 123)).not.toThrow();
    });

    it('throws VersionMismatchError for mismatch', () => {
      expect(() => validateVersion(5, 6, 'folder', 123)).toThrow(
        VersionMismatchError
      );
    });

    it('error includes resource details', () => {
      try {
        validateVersion(5, 6, 'file', 456);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof VersionMismatchError) {
          expect(error.message).toContain('file 456');
          expect(error.message).toContain('expected 5');
          expect(error.message).toContain('got 6');
          expect(error.expectedVersion).toBe(5);
          expect(error.actualVersion).toBe(6);
        } else {
          throw error;
        }
      }
    });

    it('error message mentions concurrent modification', () => {
      expect(() => validateVersion(1, 2, 'folder', 10)).toThrow(
        /modified by another user/
      );
    });
  });

  describe('isTimestampMatch', () => {
    it('returns true for exact match with Date objects', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      expect(isTimestampMatch(date, date)).toBe(true);
    });

    it('returns true for exact match with ISO strings', () => {
      const timestamp = '2024-01-01T10:00:00.000Z';
      expect(isTimestampMatch(timestamp, timestamp)).toBe(true);
    });

    it('returns true for mixed Date and string', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      const string = '2024-01-01T10:00:00.000Z';
      expect(isTimestampMatch(date, string)).toBe(true);
      expect(isTimestampMatch(string, date)).toBe(true);
    });

    it('returns true within tolerance (1 second)', () => {
      const date1 = new Date('2024-01-01T10:00:00.000Z');
      const date2 = new Date('2024-01-01T10:00:00.500Z');
      expect(isTimestampMatch(date1, date2)).toBe(true);
    });

    it('returns false outside tolerance', () => {
      const date1 = new Date('2024-01-01T10:00:00Z');
      const date2 = new Date('2024-01-01T10:00:02Z');
      expect(isTimestampMatch(date1, date2)).toBe(false);
    });

    it('returns false for significantly different times', () => {
      const date1 = new Date('2024-01-01T10:00:00Z');
      const date2 = new Date('2024-01-01T11:00:00Z');
      expect(isTimestampMatch(date1, date2)).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    const timestamp1 = '2024-01-01T10:00:00Z';
    const timestamp2 = '2024-01-01T11:00:00Z';

    it('does not throw for matching timestamps', () => {
      expect(() =>
        validateTimestamp(timestamp1, timestamp1, 'folder', 123)
      ).not.toThrow();
    });

    it('throws VersionMismatchError for mismatch', () => {
      expect(() =>
        validateTimestamp(timestamp1, timestamp2, 'folder', 123)
      ).toThrow(VersionMismatchError);
    });

    it('error includes timestamp details', () => {
      expect(() =>
        validateTimestamp(timestamp1, timestamp2, 'file', 456)
      ).toThrow(/file 456/);
      expect(() =>
        validateTimestamp(timestamp1, timestamp2, 'file', 456)
      ).toThrow(/modified by another user/);
    });

    it('handles Date objects', () => {
      const date1 = new Date('2024-01-01T10:00:00Z');
      const date2 = new Date('2024-01-01T11:00:00Z');

      expect(() => validateTimestamp(date1, date1, 'folder', 1)).not.toThrow();
      expect(() => validateTimestamp(date1, date2, 'folder', 1)).toThrow(
        VersionMismatchError
      );
    });
  });

  describe('getAncestors', () => {
    const folders: FolderNode[] = [
      { id: 1, parent_folder_id: null },
      { id: 2, parent_folder_id: 1 },
      { id: 3, parent_folder_id: 2 },
      { id: 4, parent_folder_id: 3 },
    ];

    it('returns ancestors in order (closest to farthest)', () => {
      expect(getAncestors(4, folders)).toEqual([3, 2, 1]);
      expect(getAncestors(3, folders)).toEqual([2, 1]);
      expect(getAncestors(2, folders)).toEqual([1]);
    });

    it('returns empty array for root folder', () => {
      expect(getAncestors(1, folders)).toEqual([]);
    });

    it('returns empty array for nonexistent folder', () => {
      expect(getAncestors(999, folders)).toEqual([]);
    });

    it('handles cycle detection in corrupted data', () => {
      const corruptedFolders: FolderNode[] = [
        { id: 1, parent_folder_id: 2 },
        { id: 2, parent_folder_id: 1 },
      ];
      const ancestors = getAncestors(1, corruptedFolders);
      expect(ancestors.length).toBeLessThan(10); // Should break out, not infinite loop
    });
  });

  describe('getDescendants', () => {
    const folders: FolderNode[] = [
      { id: 1, parent_folder_id: null },
      { id: 2, parent_folder_id: 1 },
      { id: 3, parent_folder_id: 1 },
      { id: 4, parent_folder_id: 2 },
      { id: 5, parent_folder_id: 2 },
      { id: 6, parent_folder_id: 4 },
    ];

    it('returns all descendants', () => {
      const descendants = getDescendants(1, folders);
      expect(descendants).toContain(2);
      expect(descendants).toContain(3);
      expect(descendants).toContain(4);
      expect(descendants).toContain(5);
      expect(descendants).toContain(6);
      expect(descendants).toHaveLength(5);
    });

    it('returns direct children only for leaf branches', () => {
      const descendants = getDescendants(3, folders);
      expect(descendants).toEqual([]);
    });

    it('handles multi-level descendants', () => {
      const descendants = getDescendants(2, folders);
      expect(descendants).toContain(4);
      expect(descendants).toContain(5);
      expect(descendants).toContain(6);
      expect(descendants).toHaveLength(3);
    });

    it('returns empty array for folder with no children', () => {
      expect(getDescendants(6, folders)).toEqual([]);
    });

    it('handles cycle detection', () => {
      const corruptedFolders: FolderNode[] = [
        { id: 1, parent_folder_id: 2 },
        { id: 2, parent_folder_id: 1 },
      ];
      const descendants = getDescendants(1, corruptedFolders);
      expect(descendants.length).toBeLessThan(10);
    });
  });

  describe('getFolderDepth', () => {
    const folders: FolderNode[] = [
      { id: 1, parent_folder_id: null },
      { id: 2, parent_folder_id: 1 },
      { id: 3, parent_folder_id: 2 },
      { id: 4, parent_folder_id: 3 },
    ];

    it('returns 0 for root-level folder', () => {
      expect(getFolderDepth(1, folders)).toBe(0);
    });

    it('returns correct depth for nested folders', () => {
      expect(getFolderDepth(2, folders)).toBe(1);
      expect(getFolderDepth(3, folders)).toBe(2);
      expect(getFolderDepth(4, folders)).toBe(3);
    });

    it('returns 0 for nonexistent folder', () => {
      expect(getFolderDepth(999, folders)).toBe(0);
    });
  });

  describe('Edge cases and integration', () => {
    it('handles empty folder arrays', () => {
      expect(wouldCreateCycle(1, 2, [])).toBe(false);
      expect(isDescendant(1, 2, [])).toBe(false);
      expect(getAncestors(1, [])).toEqual([]);
      expect(getDescendants(1, [])).toEqual([]);
      expect(getFolderDepth(1, [])).toBe(0);
    });

    it('validateNoCycle and isNameUnique together (move + rename scenario)', () => {
      const folders: FolderNode[] = [
        { id: 1, parent_folder_id: null },
        { id: 2, parent_folder_id: 1 },
        { id: 3, parent_folder_id: 2 },
      ];

      const siblings: TreeNode[] = [
        { id: 10, name: 'folder-a', parent_folder_id: 1, version: 1 },
        { id: 11, name: 'folder-b', parent_folder_id: 1, version: 1 },
      ];

      // Moving folder 3 into folder 1 is valid (no cycle)
      expect(() => validateNoCycle(3, 1, folders)).not.toThrow();

      // But folder 1 already has a "folder-a"
      expect(() => validateNameUnique('folder-a', 1, siblings)).toThrow();

      // "folder-c" would be unique
      expect(() => validateNameUnique('folder-c', 1, siblings)).not.toThrow();
    });

    it('version and timestamp validation used together', () => {
      // In practice, use one or the other, but both should work
      expect(() => validateVersion(1, 1, 'folder', 5)).not.toThrow();

      const timestamp = new Date('2024-01-01T10:00:00Z');
      expect(() => validateTimestamp(timestamp, timestamp, 'folder', 5)).not.toThrow();
    });
  });

  describe('Error types', () => {
    it('DuplicateNameError is instanceof Error', () => {
      const error = new DuplicateNameError('test');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('DuplicateNameError');
    });

    it('CycleError is instanceof Error', () => {
      const error = new CycleError('test');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('CycleError');
    });

    it('VersionMismatchError is instanceof Error with version fields', () => {
      const error = new VersionMismatchError('test', 5, 6);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('VersionMismatchError');
      expect(error.expectedVersion).toBe(5);
      expect(error.actualVersion).toBe(6);
    });
  });
});
