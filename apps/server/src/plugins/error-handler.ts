import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ConflictError, NotFoundError, ValidationError } from '@sharedrepo/db';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';

/**
 * Extract useful information from request for logging
 */
const getRequestContext = (request: FastifyRequest) => ({
  requestId: request.id,
  method: request.method,
  url: request.url,
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

/**
 * Determine if error details should be exposed to client
 * In production, hide implementation details for security
 */
const shouldExposeDetails = (error: Error): boolean => {
  if (isProduction) {
    // Only expose custom application errors in production
    return (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof ConflictError ||
      error instanceof ZodError
    );
  }
  return true;
};

/**
 * Centralized error handling plugin
 * Maps application errors to appropriate HTTP status codes and responses
 * Logs errors with structured context for debugging and monitoring
 */
const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const context = getRequestContext(request);

    // Determine status code
    let statusCode = error.statusCode || 500;
    let errorType = 'Internal Server Error';
    let message = error.message || 'An unexpected error occurred';
    let details: any = undefined;

    // Handle Zod validation errors (400)
    if (error instanceof ZodError) {
      statusCode = 400;
      errorType = 'Validation Error';
      message = 'Invalid request data';
      details = {
        issues: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };

      app.log.warn(
        {
          ...context,
          errorType,
          validationErrors: details.issues,
        },
        'Validation error'
      );
    }
    // Handle custom application errors
    else if (error instanceof ValidationError) {
      statusCode = 400;
      errorType = 'Validation Error';

      app.log.warn(
        {
          ...context,
          errorType,
          errorMessage: message,
        },
        'Validation error'
      );
    } else if (error instanceof NotFoundError) {
      statusCode = 404;
      errorType = 'Not Found';

      app.log.info(
        {
          ...context,
          errorType,
          errorMessage: message,
        },
        'Resource not found'
      );
    } else if (error instanceof ConflictError) {
      statusCode = 409;
      errorType = 'Conflict';

      app.log.warn(
        {
          ...context,
          errorType,
          errorMessage: message,
        },
        'Conflict error'
      );
    }
    // Handle Fastify-level validation errors
    else if ((error as FastifyError).validation) {
      statusCode = 400;
      errorType = 'Validation Error';
      details = { validation: (error as FastifyError).validation };

      app.log.warn(
        {
          ...context,
          errorType,
          validation: details.validation,
        },
        'Request validation error'
      );
    }
    // Handle authentication/authorization errors
    else if (statusCode === 401) {
      errorType = 'Unauthorized';
      message = error.message || 'Authentication required';

      app.log.warn(
        {
          ...context,
          errorType,
        },
        'Authentication required'
      );
    } else if (statusCode === 403) {
      errorType = 'Forbidden';
      message = error.message || 'Access denied';

      app.log.warn(
        {
          ...context,
          errorType,
        },
        'Access forbidden'
      );
    }
    // Handle unexpected errors (500)
    else {
      statusCode = 500;
      errorType = 'Internal Server Error';

      // Log full error details for internal errors
      app.log.error(
        {
          ...context,
          err: error,
          errorType,
          stack: error.stack,
        },
        'Internal server error'
      );

      // Don't expose internal error details in production
      if (isProduction) {
        message = 'An unexpected error occurred';
      }
    }

    // Build error response
    const errorResponse: any = {
      error: errorType,
      message,
      statusCode,
    };

    // Add request ID for debugging
    if (request.id) {
      errorResponse.requestId = request.id;
    }

    // Add error details if appropriate
    if (details && shouldExposeDetails(error)) {
      errorResponse.details = details;
    }

    // Add stack trace in development
    if (!isProduction && error.stack) {
      errorResponse.stack = error.stack.split('\\n');
    }

    return reply.status(statusCode).send(errorResponse);
  });
};

export default fastifyPlugin(errorHandlerPlugin);
