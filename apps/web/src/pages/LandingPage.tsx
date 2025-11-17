import { Link } from '@tanstack/react-router';

export const LandingPage = () => (
  <main className="landing">
    <section className="hero">
      <p className="tag">Ephemeral collab repos</p>
      <h1>sharedrepo.com</h1>
      <p className="lead">
        Spin up a temporary, password-protected code workspace for your team in
        seconds. No accounts. No baggage. Just a slug, a password, and pure
        collaboration.
      </p>
      <form
        className="slug-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const slug = (data.get('slug') as string | null)?.trim().toLowerCase();
          if (!slug) return;
          window.location.href = `/${slug}`;
        }}
      >
        <input
          name="slug"
          placeholder="choose-a-slug"
          minLength={1}
          maxLength={20}
          pattern="[a-zA-Z0-9]+"
          required
        />
        <button type="submit">Go</button>
      </form>
    </section>
    <section className="how-it-works">
      <h2>How it works</h2>
      <ol>
        <li>Visit <code>sharedrepo.com/&lt;slug&gt;</code>.</li>
        <li>Set a shared password (or enter the existing one).</li>
        <li>Invite collaborators by sharing the URL + password.</li>
        <li>Edit together with Monaco + Yjs real-time sync.</li>
        <li>Repo auto-expires 7 days after last access.</li>
      </ol>
    </section>
    <section className="future">
      <h2>Coming soon</h2>
      <ul>
        <li>Read-only links</li>
        <li>Snapshots & history</li>
        <li>Git export</li>
        <li>Comments & annotations</li>
      </ul>
      <p className="note">Everything stays no-auth and privacy minimal.</p>
    </section>
    <p className="footnote">
      Already have a slug? <Link to="/$slug" params={{ slug: 'demo' }}>Jump in</Link>
    </p>
  </main>
);
