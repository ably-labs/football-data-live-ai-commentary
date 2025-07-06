import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check Ably events subscription status
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ably-events`);
    const ablyStatus = await response.json();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ably: ablyStatus,
      environment: {
        hasAblyKey: !!process.env.ABLY_API_KEY,
        nodeEnv: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}