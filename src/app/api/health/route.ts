import { NextResponse } from 'next/server';

/**
 * Health check endpoint. Surfaces dashboard/API status for uptime monitoring
 * only — this status is intentionally never rendered in the end-user UI.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
