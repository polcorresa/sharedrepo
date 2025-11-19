import { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { env } from '../config/env';
import { useTree } from '../hooks/useTree';
import { useFileContent } from '../hooks/useFileContent';
import { useDebounce } from '../hooks/useDebounce';

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
  const [isDirty, setIsDirty] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [lastSavedText, setLastSavedText] = useState<string>('');

  const { saveFile } = useTree(slug);
  const { data: savedData } = useFileContent(slug, fileId);

  // Update lastSavedText when we fetch fresh content from server
  useEffect(() => {
    if (savedData) {
      setLastSavedText(savedData.text);
    }
  }, [savedData]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const text = editor.getValue();
    try {
      await saveFile.mutateAsync({ id: fileId, text });
      setLastSavedText(text); // Optimistic update
      console.log('File saved');
    } catch (err) {
      console.error('Failed to save file', err);
    }
  }, [editor, fileId, saveFile]);

  const debouncedSave = useDebounce(handleSave, 2000);

  // Check dirty state and trigger auto-save
  useEffect(() => {
    if (!editor) return;
    
    const checkDirty = () => {
      const currentText = editor.getValue();
      const dirty = currentText !== lastSavedText;
      setIsDirty(dirty);
      
      if (dirty && autoSave) {
        debouncedSave();
      }
    };

    // Check immediately
    checkDirty();

    // Listen for changes
    const disposable = editor.onDidChangeModelContent(() => {
      checkDirty();
    });

    return () => {
      disposable.dispose();
    };
  }, [editor, lastSavedText, autoSave, debouncedSave]);

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
  }, [editor, repoId, fileId, savedData]); // Re-run if savedData changes? No, only on mount/file change. 
  // Actually, savedData might load later. 
  // If savedData loads AFTER sync, we might want to initialize.
  // But we only want to initialize ONCE per session/file load.
  // The dependency array [editor, repoId, fileId] ensures we re-setup when file changes.
  // But savedData is needed inside the effect.
  // If I add savedData to deps, it will reconnect WS every time savedData changes (e.g. on save).
  // That's bad.
  // I should use a ref for savedData or handle initialization separately.

  // Better: Use a separate effect for initialization
  const initializedRef = useRef(false);

  // Reset initialization state when file changes
  useEffect(() => {
    initializedRef.current = false;
  }, [fileId]);

  // Initialize content from saved data
  useEffect(() => {
    if (!editor || !savedData || initializedRef.current || !docRef.current || !providerRef.current) return;

    const doc = docRef.current;
    const type = doc.getText('monaco');
    const provider = providerRef.current;

    const init = () => {
      if (type.toString() === '' && savedData.text) {
        doc.transact(() => {
          type.insert(0, savedData.text);
        });
      }
      initializedRef.current = true;
    };

    if (provider.synced) {
      init();
    } else {
      provider.once('sync', init);
    }
  }, [editor, savedData, fileId]); // fileId dependency ensures we retry if file changes
  
  return (
    <div className="code-editor-container" style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        right: 20, 
        zIndex: 10,
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '4px 8px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#333' }}>
          <input 
            type="checkbox" 
            checked={autoSave} 
            onChange={(e) => setAutoSave(e.target.checked)} 
          />
          Auto-save
        </label>
        <span style={{ fontSize: '12px', color: isDirty ? '#e6a23c' : '#4caf50' }}>
          {isDirty ? '● Unsaved' : '● Saved'}
        </span>
        <button 
          onClick={handleSave}
          disabled={saveFile.isPending || !isDirty}
          style={{
            padding: '4px 8px',
            background: isDirty ? '#007acc' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isDirty ? 'pointer' : 'default',
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
