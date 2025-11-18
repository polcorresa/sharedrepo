import { useState } from 'react';
import { useTree } from '../hooks/useTree';
import type { TreeFolderNode, TreeFileNode } from '@sharedrepo/shared';

interface TreeViewProps {
  slug: string;
  onSelectFile: (file: TreeFileNode) => void;
}

export const TreeView = ({ slug, onSelectFile }: TreeViewProps) => {
  const { tree, isLoading, error, createFolder, createFile, deleteFolder, deleteFile } = useTree(slug);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  if (isLoading) return <div>Loading tree...</div>;
  if (error) return <div>Error loading tree</div>;
  if (!tree) return null;

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Helper to organize nodes by parent
  const getChildren = (parentId: string | null) => {
    const folders = tree.folders.filter((f) => f.parentFolderId === parentId);
    const files = tree.files.filter((f) => f.parentFolderId === parentId);
    return { folders, files };
  };

  const TreeNode = ({ parentId, level }: { parentId: string | null; level: number }) => {
    const { folders, files } = getChildren(parentId);

    if (folders.length === 0 && files.length === 0) {
      if (level === 0) return <div className="empty-tree">Empty repo</div>;
      return null;
    }

    return (
      <ul className="tree-list" style={{ paddingLeft: level * 12 }}>
        {folders.map((folder) => (
          <li key={folder.id}>
            <div className="tree-item folder">
              <span onClick={() => toggleFolder(folder.id)}>
                {expandedFolders.has(folder.id) ? '📂' : '📁'} {folder.name}
              </span>
              <button onClick={() => deleteFolder.mutate({ id: folder.id, version: folder.version })}>x</button>
              <button onClick={() => {
                const name = prompt('New file name');
                if (name) createFile.mutate({ folderId: folder.id, name });
              }}>+📄</button>
              <button onClick={() => {
                const name = prompt('New folder name');
                if (name) createFolder.mutate({ parentFolderId: folder.id, name });
              }}>+📁</button>
            </div>
            {expandedFolders.has(folder.id) && <TreeNode parentId={folder.id} level={level + 1} />}
          </li>
        ))}
        {files.map((file) => (
          <li key={file.id}>
            <div className="tree-item file" onClick={() => onSelectFile(file)}>
              📄 {file.name}
              <button onClick={(e) => {
                e.stopPropagation();
                deleteFile.mutate({ id: file.id, version: file.version });
              }}>x</button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="tree-view">
      <div className="tree-actions">
        <button onClick={() => {
          const name = prompt('New root folder name');
          if (name) createFolder.mutate({ parentFolderId: null, name });
        }}>+ Root Folder</button>
      </div>
      <TreeNode parentId={null} level={0} />
    </div>
  );
};
