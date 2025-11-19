import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../../src/app.js';
import { createTestDatabase, migrateToLatest, clearDatabase } from './setup.js';

describe('Repo Integration Tests', () => {
  let app: ReturnType<typeof buildServer>;
  const db = createTestDatabase();

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
  });

  it('should create a new repo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: {
        slug: 'testrepo',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.slug).toBe('testrepo');
    expect(body.id).toBeDefined();
    
    // Check cookie
    const cookies = response.cookies;
    expect(cookies.find(c => c.name === 'access_token')).toBeDefined();
  });

  it('should login to existing repo', async () => {
    // Create repo first
    await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: {
        slug: 'testrepo',
        password: 'password123',
      },
    });

    // Login
    const response = await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/login',
      payload: {
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.slug).toBe('testrepo');
    
    // Check cookie
    const cookies = response.cookies;
    expect(cookies.find(c => c.name === 'access_token')).toBeDefined();
  });

  it('should fail login with wrong password', async () => {
    // Create repo first
    await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: {
        slug: 'testrepo',
        password: 'password123',
      },
    });

    // Login with wrong password
    const response = await app.inject({
      method: 'POST',
      url: '/api/repos/testrepo/login',
      payload: {
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get repo status', async () => {
    // Check non-existent
    let response = await app.inject({
      method: 'GET',
      url: '/api/repos/testrepo/status',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).state).toBe('available');

    // Create repo
    await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: {
        slug: 'testrepo',
        password: 'password123',
      },
    });

    // Check existing
    response = await app.inject({
      method: 'GET',
      url: '/api/repos/testrepo/status',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).state).toBe('exists');
  });
});
