import { repoSlugSchema } from '../contracts/repos.js';

const slugRegex = /^[a-z0-9]{1,20}$/;

export const normalizeSlug = (input: string): string => input.trim().toLowerCase();

export const isSlugValid = (slug: string): boolean => slugRegex.test(slug);

export const validateSlug = (slug: string): string => repoSlugSchema.parse(slug);
