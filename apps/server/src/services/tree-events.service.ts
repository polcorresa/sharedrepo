import { EventEmitter } from 'events';
import type { TreeFolderNode, TreeFileNode } from '@sharedrepo/shared';

type TreeOperation = 'create' | 'rename' | 'move' | 'delete';
type NodeType = 'folder' | 'file';

interface TreeEvent {
  repoId: number;
  type: NodeType;
  operation: TreeOperation;
  node: TreeFolderNode | TreeFileNode | { id: string }; // Full node for create/update, just ID for delete
}

class TreeEventService extends EventEmitter {
  emitEvent(event: TreeEvent) {
    this.emit('tree-update', event);
  }
}

export const treeEventService = new TreeEventService();
