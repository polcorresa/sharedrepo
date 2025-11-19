import { z } from 'zod';

export const nodeTypeSchema = z.enum(['file', 'folder']);

export type NodeType = z.infer<typeof nodeTypeSchema>;

export const treeNodeBaseSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  parentFolderId: z.string().nullable(),
  name: z.string().min(1),
  version: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const treeFolderSchema = treeNodeBaseSchema.extend({
  type: z.literal('folder')
});

export type TreeFolderNode = z.infer<typeof treeFolderSchema>;

export const treeFileSchema = treeNodeBaseSchema.extend({
  type: z.literal('file'),
  languageHint: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  hasUnsavedChanges: z.boolean().optional()
});

export type TreeFileNode = z.infer<typeof treeFileSchema>;

export const treeResponseSchema = z.object({
  folders: z.array(treeFolderSchema),
  files: z.array(treeFileSchema)
});

export type TreeResponse = z.infer<typeof treeResponseSchema>;
