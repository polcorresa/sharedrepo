import { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { env } from '../config/env';
import { useTree } from '../hooks/useTree';

interface CodeEditorProps {
  repoId: string;
  fileId: string;
  language: string;
  slug: string; // Used for auth context if needed, but token is in cookie
  theme: 'light' | 'dark';
}

export const CodeEditor = ({ repoId, fileId, language, slug, theme }: CodeEditorProps) => {
  const [editor, setEditor] = useState<any>(null);
  const [monaco, setMonaco] = useState<any>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const docRef = useRef<Y.Doc | null>(null);

  const { saveFile } = useTree(slug);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const text = editor.getValue();
    try {
      await saveFile.mutateAsync({ id: fileId, text });
      console.log('File saved');
    } catch (err) {
      console.error('Failed to save file', err);
    }
  }, [editor, fileId, saveFile]);

  const handleEditorDidMount: OnMount = (editorInstance, monacoInstance) => {
    setEditor(editorInstance);
    setMonaco(monacoInstance);
  };

  // Register save command
  useEffect(() => {
    if (!editor || !monaco) return;

    const disposable = editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    return () => {
      disposable?.dispose();
    };
  }, [editor, monaco, handleSave]);

  useEffect(() => {
    if (!editor) return;

    // 1. Create Yjs Doc
    const doc = new Y.Doc();
    docRef.current = doc;

    // 2. Connect to WebSocket
    // Room name: repo:<repoId>:file:<fileId>
    const roomName = `repo:${repoId}:file:${fileId}`;
    const wsProvider = new WebsocketProvider(env.wsBase, roomName, doc);
    providerRef.current = wsProvider;

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

    // Set random color for awareness
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
    wsProvider.awareness.setLocalStateField('user', {
      name: 'Anonymous',
      color: randomColor,
    });

    return () => {
      // Cleanup
      binding.destroy();
      wsProvider.destroy();
      doc.destroy();
    };
  }, [editor, repoId, fileId]);

  return (
    <div className="code-editor-container" style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, right: 20, zIndex: 10 }}>
        <button 
          onClick={handleSave}
          disabled={saveFile.isPending}
          style={{
            padding: '4px 8px',
            background: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: saveFile.isPending ? 0.7 : 1
          }}
        >
          {saveFile.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
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
        }}
      />
    </div>
  );
};
