import { Router, Request, Response } from 'express';

export function createHealthRouter(): Router {
  const router = Router();
  
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });
  
  return router;
}