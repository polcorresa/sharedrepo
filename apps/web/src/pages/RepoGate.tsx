import { useParams } from '@tanstack/react-router';

export const RepoGate = () => {
  const { slug } = useParams({ from: '/$slug' });

  return (
    <main className="repo-gate">
      <h1>/{slug}</h1>
      <p>
        Repo entry flow placeholder. Implement status check, create/login form, and
        transitions to the editor here.
      </p>
    </main>
  );
};
