import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { RepoStatusResponse } from '@sharedrepo/shared';

export const useRepoStatus = (slug: string) => {
  return useQuery({
    queryKey: ['repo', slug, 'status'],
    queryFn: () => api.get<RepoStatusResponse>(`/api/repos/${slug}/status`),
    retry: false,
  });
};
