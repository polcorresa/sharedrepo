import { useState } from 'react';
import type { RepoMetadata, TreeFileNode } from '@sharedrepo/shared';
import { TreeView } from './TreeView';
import { CodeEditor } from './CodeEditor';
import { env } from '../config/env';
import { useTheme } from '../contexts/ThemeContext';
import { useRepoAuth } from '../hooks/useRepoAuth';

interface RepoEditorProps {
  metadata: RepoMetadata;
}

export const RepoEditor = ({ metadata }: RepoEditorProps) => {
  const [activeFile, setActiveFile] = useState<TreeFileNode | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { logoutRepo } = useRepoAuth(metadata.slug, false);

  const handleDownload = () => {
    window.location.href = `${env.apiBase}/api/repos/${metadata.slug}/archive`;
  };

  const handleLogout = () => {
    logoutRepo.mutate();
  };

  return (
    <div className="repo-editor">
      <header className="editor-header">
        <div className="header-left">
          <div className="repo-icon">📦</div>
          <div className="repo-info">
            <h1 className="repo-title">{metadata.slug}</h1>
            <span className="repo-subtitle">Collaborative Repository</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="action-button" onClick={handleDownload}>
            <span className="button-icon">📥</span>
            Download
          </button>
          <button className="action-button secondary" onClick={handleLogout}>
            <span className="button-icon">🚪</span>
            Logout
          </button>
        </div>
      </header>
      <div className="editor-layout">
        <aside className="sidebar">
          <TreeView 
            slug={metadata.slug} 
            onSelectFile={setActiveFile}
            activeFileId={activeFile?.id || null}
          />
        </aside>
        <main className="content">
          {activeFile ? (
            <div className="editor-container">
              <div className="file-tab">
                <span className="file-tab-icon">📄</span>
                <span className="file-tab-name">{activeFile.name}</span>
                <button 
                  className="file-tab-close"
                  onClick={() => setActiveFile(null)}
                  title="Close file"
                >
                  ✕
                </button>
              </div>
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
            <div className="empty-state">
              <div className="empty-state-content">
                <div className="empty-state-icon">📝</div>
                <h2>No file selected</h2>
                <p>Select a file from the sidebar to start editing</p>
                <p className="empty-state-hint">Or right-click in the sidebar to create new files</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
