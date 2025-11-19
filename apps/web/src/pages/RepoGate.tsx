import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { RepoEditor } from '../components/RepoEditor';
import { useRepoStatus } from '../hooks/useRepoStatus';
import { useRepoAuth } from '../hooks/useRepoAuth';

export const RepoGate = () => {
  const { slug } = useParams({ from: '/$slug' });
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Check repo status
  const { data: status, isLoading: isLoadingStatus, error: statusError } = useRepoStatus(slug);

  // 2. Check auth / handle actions
  const { 
    metadata, 
    isLoading: isLoadingAuth, 
    createRepo, 
    loginRepo 
  } = useRepoAuth(slug, !!status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    try {
      if (status?.state === 'available') {
        await createRepo.mutateAsync(password);
      } else {
        await loginRepo.mutateAsync(password);
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred');
    }
  };

  if (isLoadingStatus || (status && isLoadingAuth)) {
    return <div className="loading">Loading...</div>;
  }

  if (statusError) {
    return (
      <main className="repo-gate">
        <div className="gate-card error">
          <h1>Error</h1>
          <p>{(statusError as Error).message || 'Failed to load repo status'}</p>
          <a href="/">Go Home</a>
        </div>
      </main>
    );
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
          {formError && <p className="error">{formError}</p>}
          <button type="submit" disabled={createRepo.isPending || loginRepo.isPending}>
            {createRepo.isPending || loginRepo.isPending ? 'Processing...' : (isCreating ? 'Create Repo' : 'Enter')}
          </button>
        </form>
      </div>
    </main>
  );
};
