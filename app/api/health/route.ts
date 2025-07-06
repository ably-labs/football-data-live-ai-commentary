import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      ably: false,
      openai: false,
      environment: {
        hasAblyKey: !!process.env.ABLY_API_KEY,
        hasOpenAIKey: !!process.env.OPEN_AI_API_KEY,
      }
    }
  };

  // Check Ably connection
  try {
    const ablyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/status`);
    const ablyStatus = await ablyResponse.json();
    checks.checks.ably = ablyStatus.status === 'ok';
  } catch (error) {
    console.error('Ably health check failed:', error);
  }

  // Simple OpenAI check (just verify key exists)
  checks.checks.openai = !!process.env.OPEN_AI_API_KEY;

  // Determine overall health
  const isHealthy = checks.checks.ably && checks.checks.openai;
  checks.status = isHealthy ? 'healthy' : 'degraded';

  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503
  });
}