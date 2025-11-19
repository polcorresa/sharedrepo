import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const useFileContent = (slug: string, fileId: string) => {
  return useQuery({
    queryKey: ['repo', slug, 'file', fileId, 'content'],
    queryFn: () => api.get<{ text: string }>(`/api/repos/${slug}/files/${fileId}/content`),
    staleTime: 0, // Always fetch fresh content on mount
  });
};
