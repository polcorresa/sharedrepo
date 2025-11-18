import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

/**
 * Plugin to enable Zod validation and serialization for Fastify routes
 * This allows type-safe route definitions with automatic request/response validation
 */
const zodProviderPlugin: FastifyPluginAsync = async (app) => {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
};

export default fastifyPlugin(zodProviderPlugin);

// Re-export ZodTypeProvider for use in route files
export type { ZodTypeProvider };
