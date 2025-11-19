import { describe, it, expect, vi } from 'vitest';
import { treeEventService } from './tree-events.service.js';

describe('TreeEventService', () => {
  it('should emit tree-update events', () => {
    const listener = vi.fn();
    treeEventService.on('tree-update', listener);

    const event = {
      repoId: 1,
      type: 'file' as const,
      operation: 'create' as const,
      node: { id: '1' },
    };

    treeEventService.emitEvent(event);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('should handle multiple listeners', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    treeEventService.on('tree-update', listenerA);
    treeEventService.on('tree-update', listenerB);

    const event = {
      repoId: 1,
      type: 'folder' as const,
      operation: 'delete' as const,
      node: { id: '2' },
    };

    treeEventService.emitEvent(event);

    expect(listenerA).toHaveBeenCalledWith(event);
    expect(listenerB).toHaveBeenCalledWith(event);
  });
});
