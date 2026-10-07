import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 doesn't catch rejected promises from async handlers: the error
// never reaches the error middleware and, as an unhandled rejection, crashes
// the whole process. Wrapping forwards it to next() so it becomes a 500.
export function asyncRoute<P = Record<string, string>>(
  handler: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler<P> {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
