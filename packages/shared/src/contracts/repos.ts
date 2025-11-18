import { z } from 'zod';

/**
 * Regex for valid repo slugs:
 * - Only lowercase letters (a-z) and digits (0-9)
 * - No uppercase, no special characters, no spaces
 * - Length: 1-20 characters
 */
const slugRegex = /^[a-z0-9]{1,20}$/;

export const repoSlugSchema = z
  .string()
  .min(1, 'Slug cannot be empty')
  .max(20, 'Slug must be at most 20 characters')
  .regex(slugRegex, 'Slug can only contain lowercase letters (a-z) and digits (0-9)');

export type RepoSlug = z.infer<typeof repoSlugSchema>;

export const repoPasswordSchema = z
  .string()
  .min(4, 'Password must be at least 4 characters.')
  .max(128, 'Password is too long.');

export type RepoPassword = z.infer<typeof repoPasswordSchema>;

export const repoStatusSchema = z.object({
  slug: repoSlugSchema,
  state: z.enum(['available', 'exists']),
  expiresAt: z.string().datetime().nullable()
});

export type RepoStatusResponse = z.infer<typeof repoStatusSchema>;

export const repoMetadataSchema = z.object({
  id: z.string(),
  slug: repoSlugSchema,
  createdAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  approxSizeBytes: z.number().nullable()
});

export type RepoMetadata = z.infer<typeof repoMetadataSchema>;

export const repoTokenPayloadSchema = z.object({
  repoId: z.string(),
  slug: repoSlugSchema,
  exp: z.number(),
  iat: z.number()
});

export type RepoTokenPayload = z.infer<typeof repoTokenPayloadSchema>;

export const slugAvailabilitySchema = z.object({
  slug: repoSlugSchema,
  available: z.boolean()
});

export type SlugAvailability = z.infer<typeof slugAvailabilitySchema>;
