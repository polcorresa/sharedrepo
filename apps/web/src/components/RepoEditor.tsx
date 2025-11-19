import { useState } from 'react';
import type { RepoMetadata, TreeFileNode } from '@sharedrepo/shared';
import { TreeView } from './TreeView';
import { CodeEditor } from './CodeEditor';
import { env } from '../config/env';
import { useTheme } from '../contexts/ThemeContext';

interface RepoEditorProps {
  metadata: RepoMetadata;
}

export const RepoEditor = ({ metadata }: RepoEditorProps) => {
  const [activeFile, setActiveFile] = useState<TreeFileNode | null>(null);
  const { theme, toggleTheme } = useTheme();

  const handleDownload = () => {
    window.location.href = `${env.apiBase}/api/repos/${metadata.slug}/archive`;
  };

  return (
    <div className="repo-editor">
      <header>
        <h1>{metadata.slug}</h1>
        <div className="actions">
          <button onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={handleDownload}>Download .zip</button>
          <button>Logout</button>
        </div>
      </header>
      <div className="editor-layout">
        <aside className="sidebar">
          <TreeView slug={metadata.slug} onSelectFile={setActiveFile} />
        </aside>
        <main className="content">
          {activeFile ? (
            <div className="editor-container">
              <div className="file-tab">{activeFile.name}</div>
              <CodeEditor
                key={activeFile.id} // Force remount on file change
                repoId={metadata.id}
                fileId={activeFile.id}
                language={activeFile.languageHint || 'plaintext'}
                slug={metadata.slug}
                theme={theme}
              />
            </div>
          ) : (
            <div className="empty-state">Select a file to edit</div>
          )}
        </main>
      </div>
    </div>
  );
};
