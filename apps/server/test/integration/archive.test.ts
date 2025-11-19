import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../../src/app.js';
import { createTestDatabase, migrateToLatest, clearDatabase } from './setup.js';
import AdmZip from 'adm-zip';

describe('Archive Integration Tests', () => {
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
    
    response.cookies.forEach(c => {
      cookies[c.name] = c.value;
    });
  });

  it('should download empty zip for empty repo', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/repos/testrepo/archive',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-disposition']).toContain('attachment; filename="codeshare-testrepo.zip"');
  });

  it('should download zip with files', async () => {
    // Create folder
    const folderRes = await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/tree/folders',
      cookies,
      payload: { name: 'src', parentFolderId: null },
    });
    const folderId = JSON.parse(folderRes.payload).id;

    // Create file
    const fileRes = await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/tree/files',
      cookies,
      payload: { name: 'index.ts', folderId },
    });
    const fileId = JSON.parse(fileRes.payload).id;

    // Update content
    await app.inject({
      method: 'PUT',
      url: `/api/repos/testrepo/files/${fileId}/content`,
      cookies,
      payload: { text: 'console.log("hello");' },
    });

    // Download zip
    const response = await app.inject({
      method: 'GET',
      url: '/api/repos/testrepo/archive',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    
    // Verify zip content
    const zip = new AdmZip(response.rawPayload);
    const zipEntries = zip.getEntries();
    
    expect(zipEntries).toHaveLength(1);
    expect(zipEntries[0].entryName).toBe('src/index.ts');
    expect(zipEntries[0].getData().toString('utf8')).toBe('console.log("hello");');
  });
});
