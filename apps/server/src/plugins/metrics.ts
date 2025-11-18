import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import client from 'prom-client';

// Initialize registry
const register = new client.Registry();

// Add default metrics (cpu, memory, etc.)
client.collectDefaultMetrics({ register });

// Define custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const activeWebsocketConnections = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

const activeReposCount = new client.Gauge({
  name: 'active_repos_count',
  help: 'Number of active (non-expired) repositories',
  registers: [register],
});

const repoOperationsTotal = new client.Counter({
  name: 'repo_operations_total',
  help: 'Total number of repo operations',
  labelNames: ['operation'], // create, delete
  registers: [register],
});

const treeOperationsTotal = new client.Counter({
  name: 'tree_operations_total',
  help: 'Total number of tree operations',
  labelNames: ['operation', 'status'], // operation: create_file, move_folder, etc. status: success, conflict
  registers: [register],
});

// Export metrics for use in services
export const metrics = {
  activeWebsocketConnections,
  activeReposCount,
  repoOperationsTotal,
  treeOperationsTotal,
};

/**
 * Metrics plugin
 * Exposes /metrics endpoint and collects HTTP metrics
 */
const metricsPlugin: FastifyPluginAsync = async (app) => {
  // Expose metrics endpoint
  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  // Measure request duration
  app.addHook('onRequest', async (request) => {
    // Attach start time to request
    (request as any).startTime = process.hrtime();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime;
    if (!startTime) return;

    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    // Get parameterized route path if available, otherwise use url (careful with cardinality)
    // Fastify stores the route config in request.routeOptions.url or request.context.config.url depending on version
    // In Fastify v4: request.routeOptions.url
    const route = request.routeOptions.url || request.url;
    
    // Skip metrics endpoint itself to avoid noise
    if (route === '/metrics') return;

    const method = request.method;
    const statusCode = reply.statusCode;

    httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
  });
};

export default fastifyPlugin(metricsPlugin);
