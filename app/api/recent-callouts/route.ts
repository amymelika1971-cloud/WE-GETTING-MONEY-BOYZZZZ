import {env} from 'cloudflare:workers';
import {recentCallouts} from '@/lib/fast-providers.mjs';
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  try {
    return Response.json(await recentCallouts(q.get('chain') || '', q.get('address') || '', Number(q.get('minutes') || 30), env.X_BEARER_TOKEN || ''), {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {return Response.json({error: error instanceof Error ? error.message : 'Callout sources are unavailable.'}, {status: 422, headers: {'Cache-Control': 'no-store'}});}
}
