import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: Request) {
  const apiKey = process.env.ABLY_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ably API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || `client-${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract the key parts from the API key
    const [keyId, keySecret] = apiKey.split(':');
    
    // Create JWT token
    const currentTime = Math.floor(Date.now() / 1000);
    const ttl = 3600; // 1 hour
    
    const tokenParams = {
      'x-ably-capability': JSON.stringify({
        '*': ['publish', 'subscribe', 'presence', 'history']
      }),
      'x-ably-clientId': clientId,
      'iat': currentTime,
      'exp': currentTime + ttl
    };
    
    const token = jwt.sign(
      tokenParams,
      keySecret,
      {
        algorithm: 'HS256',
        keyid: keyId
      }
    );
    
    // Return JWT token in format expected by Ably client
    return NextResponse.json({
      token: token,
      expires: (currentTime + ttl) * 1000, // Convert to milliseconds
      issued: currentTime * 1000,
      capability: {
        '*': ['publish', 'subscribe', 'presence', 'history']
      },
      clientId: clientId
    });
    
  } catch (error) {
    console.error('Error creating JWT token:', error);
    return NextResponse.json(
      { error: 'Failed to create JWT token' },
      { status: 500 }
    );
  }
}