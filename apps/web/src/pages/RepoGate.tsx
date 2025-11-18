import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RepoEditor } from '../components/RepoEditor';
import type { RepoStatusResponse, RepoMetadata } from '@sharedrepo/shared';

export const RepoGate = () => {
  const { slug } = useParams({ from: '/$slug' });
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 1. Check repo status
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['repo', slug, 'status'],
    queryFn: () => api.get<RepoStatusResponse>(`/api/repos/${slug}/status`),
  });

  // 2. Try to fetch metadata (check if already authenticated)
  const { data: metadata, isLoading: isLoadingMetadata, refetch: refetchMetadata } = useQuery({
    queryKey: ['repo', slug, 'metadata'],
    queryFn: () => api.get<RepoMetadata>(`/api/repos/${slug}`),
    retry: false,
    enabled: !!status, // Only fetch if status is known
  });

  // Create Repo Mutation
  const createRepo = useMutation({
    mutationFn: () => api.post<RepoMetadata>('/api/repos', { slug, password }),
    onSuccess: (data) => {
      queryClient.setQueryData(['repo', slug, 'metadata'], data);
      refetchMetadata();
    },
    onError: (err: any) => setError(err.message),
  });

  // Login Mutation
  const loginRepo = useMutation({
    mutationFn: () => api.post<RepoMetadata>(`/api/repos/${slug}/login`, { password }),
    onSuccess: (data) => {
      queryClient.setQueryData(['repo', slug, 'metadata'], data);
      refetchMetadata();
    },
    onError: (err: any) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (status?.state === 'available') {
      createRepo.mutate();
    } else {
      loginRepo.mutate();
    }
  };

  if (isLoadingStatus || (status && isLoadingMetadata)) {
    return <div className="loading">Loading...</div>;
  }

  // If we have metadata, we are authenticated
  if (metadata) {
    return <RepoEditor metadata={metadata} />;
  }

  // Otherwise, show gate (Create or Login)
  const isCreating = status?.state === 'available';

  return (
    <main className="repo-gate">
      <div className="gate-card">
        <h1>{isCreating ? 'Create Repository' : 'Enter Password'}</h1>
        <p className="slug">/{slug}</p>
        
        {isCreating ? (
          <p className="hint">
            This slug is available. Set a password to create a temporary repo.
          </p>
        ) : (
          <p className="hint">
            This repo exists. Enter the password to access it.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            required
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={createRepo.isPending || loginRepo.isPending}>
            {createRepo.isPending || loginRepo.isPending ? 'Processing...' : (isCreating ? 'Create Repo' : 'Enter')}
          </button>
        </form>
      </div>
    </main>
  );
};
