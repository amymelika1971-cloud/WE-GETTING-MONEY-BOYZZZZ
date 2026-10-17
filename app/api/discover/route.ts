import {discover} from '@/lib/fast-providers.mjs';
export async function GET() {
  try {return Response.json(await discover(), {headers: {'Cache-Control': 'private, no-store'}});}
  catch (error) {return Response.json({error: error instanceof Error ? error.message : 'Discovery is unavailable.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});}
}
