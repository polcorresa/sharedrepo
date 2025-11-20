import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { env } from '../config/env';

interface CodeEditorProps {
  repoId: string;
  fileId: string;
  language: string;
  slug: string; // Used for auth context if needed, but token is in cookie
  theme: 'light' | 'dark';
}

export const CodeEditor = ({ repoId, fileId, language, theme }: CodeEditorProps) => {
  const [editor, setEditor] = useState<any>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const handleEditorDidMount: OnMount = (editorInstance) => {
    setEditor(editorInstance);
  };

  useEffect(() => {
    if (!editor) return;

    console.log('[CodeEditor] Setting up real-time collaboration for file:', fileId);

    // 1. Create Yjs Doc
    const doc = new Y.Doc();
    docRef.current = doc;

    // 2. Connect to WebSocket with CORRECT PATH
    // Room name: repo:<repoId>:file:<fileId>
    const roomName = `repo:${repoId}:file:${fileId}`;
    console.log('[CodeEditor] WebSocket URL:', `${env.wsBase}/ws/yjs`);
    console.log('[CodeEditor] Room name:', roomName);
    
    const wsProvider = new WebsocketProvider(`${env.wsBase}/ws/yjs`, roomName, doc);
    providerRef.current = wsProvider;

    // Track connection status
    wsProvider.on('status', (event: { status: string }) => {
      console.log('[CodeEditor] WebSocket status:', event.status);
      if (event.status === 'connected') {
        setConnectionStatus('connected');
      } else if (event.status === 'disconnected') {
        setConnectionStatus('disconnected');
      }
    });

    wsProvider.on('sync', (synced: boolean) => {
      console.log('[CodeEditor] Sync status:', synced ? 'synced' : 'syncing');
    });

    // 3. Get Y.Text
    const type = doc.getText('monaco');

    // 4. Bind to Monaco
    const binding = new MonacoBinding(
      type,
      editor.getModel()!,
      new Set([editor]),
      wsProvider.awareness
    );
    bindingRef.current = binding;

    // Set random color for awareness (remote cursors)
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
    wsProvider.awareness.setLocalStateField('user', {
      name: 'Anonymous',
      color: randomColor,
    });

    console.log('[CodeEditor] Real-time sync active, no manual save needed');

    return () => {
      console.log('[CodeEditor] Cleaning up WebSocket and editor bindings');
      binding.destroy();
      wsProvider.destroy();
      doc.destroy();
    };
  }, [editor, repoId, fileId]);
  
  return (
    <div className="code-editor-wrapper">
      <div className="editor-toolbar">
        <div className="editor-toolbar-right">
          <span className={`save-status ${connectionStatus === 'connected' ? 'saved' : 'unsaved'}`}>
            <span className="status-dot"></span>
            {connectionStatus === 'connected'
              ? '● Real-time sync active'
              : connectionStatus === 'connecting'
              ? '○ Connecting...'
              : '○ Disconnected'}
          </span>
        </div>
      </div>
      <div className="monaco-container">
        <Editor
          height="100%"
          language={language || 'plaintext'}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
    </div>
  );
};
