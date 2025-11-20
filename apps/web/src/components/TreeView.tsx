import { useState } from 'react';
import { useTree } from '../hooks/useTree';
import type { TreeFolderNode, TreeFileNode } from '@sharedrepo/shared';
import { ContextMenu } from './ContextMenu';

interface TreeViewProps {
  slug: string;
  onSelectFile: (file: TreeFileNode) => void;
  activeFileId: string | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  targetId: string | null;
  targetType: 'folder' | 'file' | 'root';
  targetVersion?: number;
}

export const TreeView = ({ slug, onSelectFile, activeFileId }: TreeViewProps) => {
  const { tree, isLoading, error, createFolder, createFile, deleteFolder, deleteFile } = useTree(slug);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  if (isLoading) return <div className="tree-loading">Loading files...</div>;
  if (error) return <div className="tree-error">Error loading files</div>;
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

  const handleContextMenu = (
    e: React.MouseEvent,
    targetId: string | null,
    targetType: 'folder' | 'file' | 'root',
    targetVersion?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetId,
      targetType,
      targetVersion,
    });
  };

  const handleCreateFile = (folderId: string | null) => {
    const name = prompt('New file name (e.g., index.js, README.md, app.py)');
    if (name) {
      if (!name.includes('.')) {
        alert('Please include a file extension (e.g., .js, .py, .md)');
        return;
      }
      createFile.mutate({ folderId, name });
    }
  };

  const handleCreateFolder = (parentFolderId: string | null) => {
    const name = prompt('New folder name');
    if (name) {
      createFolder.mutate({ parentFolderId, name });
    }
  };

  const handleDelete = (id: string, version: number, type: 'folder' | 'file') => {
    const confirmMsg = `Are you sure you want to delete this ${type}?`;
    if (window.confirm(confirmMsg)) {
      if (type === 'folder') {
        deleteFolder.mutate({ id, version });
      } else {
        deleteFile.mutate({ id, version });
      }
    }
  };

  const getContextMenuItems = () => {
    if (!contextMenu) return [];

    if (contextMenu.targetType === 'root') {
      return [
        { label: 'New File', icon: '📄', onClick: () => handleCreateFile(null) },
        { label: 'New Folder', icon: '📁', onClick: () => handleCreateFolder(null) },
      ];
    }

    if (contextMenu.targetType === 'folder') {
      return [
        { label: 'New File', icon: '📄', onClick: () => handleCreateFile(contextMenu.targetId) },
        { label: 'New Folder', icon: '📁', onClick: () => handleCreateFolder(contextMenu.targetId) },
        { label: 'Delete', icon: '🗑️', onClick: () => handleDelete(contextMenu.targetId!, contextMenu.targetVersion!, 'folder'), danger: true },
      ];
    }

    if (contextMenu.targetType === 'file') {
      return [
        { label: 'Delete', icon: '🗑️', onClick: () => handleDelete(contextMenu.targetId!, contextMenu.targetVersion!, 'file'), danger: true },
      ];
    }

    return [];
  };

  // Helper to organize nodes by parent
  const getChildren = (parentId: string | null) => {
    const folders = tree.folders.filter((f) => f.parentFolderId === parentId);
    const files = tree.files.filter((f) => f.parentFolderId === parentId);
    return { folders, files };
  };

  // Helper to get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return '📜';
      case 'ts':
      case 'tsx':
        return '📘';
      case 'py':
        return '🐍';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'css':
        return '🎨';
      case 'html':
        return '🌐';
      default:
        return '📄';
    }
  };

  const TreeNode = ({ parentId, level }: { parentId: string | null; level: number }) => {
    const { folders, files } = getChildren(parentId);

    if (folders.length === 0 && files.length === 0) {
      if (level === 0) {
        return (
          <div 
            className="tree-empty"
            onContextMenu={(e) => handleContextMenu(e, null, 'root')}
          >
            <p>No files yet</p>
            <p className="tree-empty-hint">Right-click to create files or folders</p>
          </div>
        );
      }
      return null;
    }

    return (
      <div style={{ paddingLeft: level > 0 ? 16 : 0 }}>
        {folders.map((folder) => (
          <div key={folder.id}>
            <div
              className="tree-item folder"
              onClick={() => toggleFolder(folder.id)}
              onContextMenu={(e) => handleContextMenu(e, folder.id, 'folder', folder.version)}
            >
              <span className="tree-item-icon">
                {expandedFolders.has(folder.id) ? '📂' : '📁'}
              </span>
              <span className="tree-item-label">{folder.name}</span>
            </div>
            {expandedFolders.has(folder.id) && <TreeNode parentId={folder.id} level={level + 1} />}
          </div>
        ))}
        {files.map((file) => (
          <div
            key={file.id}
            className={`tree-item file ${activeFileId === file.id ? 'active' : ''}`}
            onClick={() => onSelectFile(file)}
            onContextMenu={(e) => handleContextMenu(e, file.id, 'file', file.version)}
          >
            <span className="tree-item-icon">{getFileIcon(file.name)}</span>
            <span className="tree-item-label">{file.name}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className="tree-view"
      onContextMenu={(e) => {
        // Allow context menu on empty space
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('tree-view')) {
          handleContextMenu(e, null, 'root');
        }
      }}
    >
      <div className="tree-header">
        <span className="tree-title">FILES</span>
      </div>
      <div className="tree-content">
        <TreeNode parentId={null} level={0} />
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
