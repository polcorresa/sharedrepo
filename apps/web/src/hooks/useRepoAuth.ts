import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { RepoMetadata } from '@sharedrepo/shared';

export const useRepoAuth = (slug: string, enabled: boolean = true) => {
  const queryClient = useQueryClient();

  // Check if authenticated (fetch metadata)
  const { data: metadata, isLoading, error, refetch } = useQuery({
    queryKey: ['repo', slug, 'metadata'],
    queryFn: () => api.get<RepoMetadata>(`/api/repos/${slug}`),
    retry: false,
    enabled,
  });

  // Create Repo
  const createRepo = useMutation({
    mutationFn: (password: string) => api.post<RepoMetadata>('/api/repos', { slug, password }),
    onSuccess: (data) => {
      queryClient.setQueryData(['repo', slug, 'metadata'], data);
      refetch();
    },
  });

  // Login
  const loginRepo = useMutation({
    mutationFn: (password: string) => api.post<RepoMetadata>(`/api/repos/${slug}/login`, { password }),
    onSuccess: (data) => {
      queryClient.setQueryData(['repo', slug, 'metadata'], data);
      refetch();
    },
  });

  // Logout
  const logoutRepo = useMutation({
    mutationFn: () => api.post(`/api/repos/${slug}/logout`, {}),
    onSuccess: () => {
      queryClient.setQueryData(['repo', slug, 'metadata'], null);
      queryClient.invalidateQueries({ queryKey: ['repo', slug] });
    },
  });

  return {
    metadata,
    isLoading,
    error,
    isAuthenticated: !!metadata,
    createRepo,
    loginRepo,
    logoutRepo,
  };
};
