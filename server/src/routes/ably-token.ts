import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export function createAblyTokenRouter(): Router {
  const router = Router();
  
  router.get('/ably-token', (req: Request, res: Response) => {
    try {
      console.log('Token request for client:', req.query.clientId);
      
      const apiKey = process.env.ABLY_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error' });
      }
      
      // Extract the key name and secret from the API key
      const [keyName, keySecret] = apiKey.split(':');
      
      // Create JWT token for Ably
      const tokenParams = {
        'x-ably-clientId': req.query.clientId || 'anonymous',
        'x-ably-capability': JSON.stringify({
          '*': ['publish', 'subscribe', 'presence', 'history']
        })
      };
      
      const jwtOptions = {
        expiresIn: 3600, // 1 hour
        keyid: `${keyName}`,
      };
      
      const token = jwt.sign(tokenParams, keySecret, jwtOptions);
      
      // Return in Ably's expected format
      const expiresAt = Date.now() + 3600 * 1000; // 1 hour from now
      
      res.json({
        token: token,
        expires: expiresAt,
        issued: Date.now(),
        capability: JSON.stringify({
          '*': ['publish', 'subscribe', 'presence', 'history']
        }),
        clientId: req.query.clientId || 'anonymous'
      });
    } catch (error) {
      console.error('Error generating Ably token:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });
  
  return router;
}