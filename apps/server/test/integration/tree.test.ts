import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../../src/app.js';
import { createTestDatabase, migrateToLatest, clearDatabase } from './setup.js';

describe('Tree Integration Tests', () => {
  let app: ReturnType<typeof buildServer>;
  const db = createTestDatabase();
  let cookies: { [key: string]: string } = {};

  beforeAll(async () => {
    await migrateToLatest(db);
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  beforeEach(async () => {
    await clearDatabase(db);
    
    // Create repo and login
    const response = await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: {
        slug: 'testrepo',
        password: 'password123',
      },
    });
    
    // Extract cookies
    response.cookies.forEach(c => {
      cookies[c.name] = c.value;
    });
  });

  it('should create a folder', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/tree/folders',
      cookies,
      payload: {
        name: 'src',
        parentFolderId: null,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.name).toBe('src');
    expect(body.parentFolderId).toBeNull();
  });

  it('should create a file', async () => {
    // Create folder first
    const folderRes = await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/tree/folders',
      cookies,
      payload: {
        name: 'src',
        parentFolderId: null,
      },
    });
    const folderId = JSON.parse(folderRes.payload).id;

    // Create file
    const response = await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/tree/files',
      cookies,
      payload: {
        name: 'index.ts',
        folderId: folderId,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.name).toBe('index.ts');
    expect(body.parentFolderId).toBe(folderId);
  });

  it('should get the tree', async () => {
    // Create folder
    await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/tree/folders',
      cookies,
      payload: {
        name: 'src',
        parentFolderId: null,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/repos/testrepo/tree',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.folders).toHaveLength(1);
    expect(body.folders[0].name).toBe('src');
  });
});
