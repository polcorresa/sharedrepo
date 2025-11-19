import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { env } from '../config/env';
import { useToast } from '../contexts/ToastContext';
import type { TreeResponse, TreeFolderNode, TreeFileNode } from '@sharedrepo/shared';

type TreeOperation = 'create' | 'rename' | 'move' | 'delete';
type NodeType = 'folder' | 'file';

interface TreeEvent {
  repoId: number;
  type: NodeType;
  operation: TreeOperation;
  node: TreeFolderNode | TreeFileNode | { id: string };
}

export const useTree = (slug: string) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const queryKey = ['repo', slug, 'tree'];

  // Helper for error handling
  const handleError = (error: any, action: string) => {
    if (error.status === 409) {
      addToast({
        type: 'warning',
        title: 'Conflict Detected',
        message: 'The tree has changed. Refreshing...',
      });
      queryClient.invalidateQueries({ queryKey });
    } else {
      addToast({
        type: 'error',
        title: `${action} Failed`,
        message: error.message || 'An unexpected error occurred',
      });
    }
  };

  // Fetch Tree
  const { data: tree, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => api.get<TreeResponse>(`/api/repos/${slug}/tree`),
  });

  // Real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use env.wsBase if available, otherwise derive from apiBase or window.location
    // env.wsBase is likely configured to the full URL e.g. ws://localhost:3001
    const wsUrl = `${env.wsBase}/ws/repo/${slug}/tree`;
    
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TreeEvent;
        // For now, simplest strategy is to invalidate queries to refetch tree
        // This ensures we have the correct state without complex client-side patching
        queryClient.invalidateQueries({ queryKey });
      } catch (err) {
        console.error('Failed to parse tree event', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [slug, queryClient]);

  // Create Folder
  const createFolder = useMutation({
    mutationFn: (data: { parentFolderId: string | null; name: string }) =>
      api.post<TreeFolderNode>(`/api/repos/${slug}/folders`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => handleError(err, 'Create Folder'),
  });

  // Create File
  const createFile = useMutation({
    mutationFn: (data: { folderId: string; name: string }) =>
      api.post<TreeFileNode>(`/api/repos/${slug}/files`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => handleError(err, 'Create File'),
  });

  // Rename Folder
  const renameFolder = useMutation({
    mutationFn: (data: { id: string; newName: string; expectedVersion: number }) =>
      api.patch<TreeFolderNode>(`/api/repos/${slug}/folders/${data.id}`, {
        operation: 'rename',
        newName: data.newName,
        expectedVersion: data.expectedVersion,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => handleError(err, 'Rename Folder'),
  });

  // Rename File
  const renameFile = useMutation({
    mutationFn: (data: { id: string; newName: string; expectedVersion: number }) =>
      api.patch<TreeFileNode>(`/api/repos/${slug}/files/${data.id}`, {
        operation: 'rename',
        newName: data.newName,
        expectedVersion: data.expectedVersion,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => handleError(err, 'Rename File'),
  });

  // Delete Folder
  const deleteFolder = useMutation({
    mutationFn: (data: { id: string; version: number }) =>
      api.delete(`/api/repos/${slug}/folders/${data.id}?version=${data.version}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => handleError(err, 'Delete Folder'),
  });

  // Delete File
  const deleteFile = useMutation({
    mutationFn: (data: { id: string; version: number }) =>
      api.delete(`/api/repos/${slug}/files/${data.id}?version=${data.version}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => handleError(err, 'Delete File'),
  });

  // Save File Content
  const saveFile = useMutation({
    mutationFn: (data: { id: string; text: string }) =>
      api.put<TreeFileNode>(`/api/repos/${slug}/files/${data.id}/content`, {
        text: data.text,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      addToast({ type: 'success', message: 'File saved successfully' });
    },
    onError: (err) => handleError(err, 'Save File'),
  });

  return {
    tree,
    isLoading,
    error,
    createFolder,
    createFile,
    renameFolder,
    renameFile,
    deleteFolder,
    deleteFile,
    saveFile,
  };
};
