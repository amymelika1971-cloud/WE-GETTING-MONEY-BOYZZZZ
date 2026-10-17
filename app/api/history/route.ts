import {history} from '@/lib/providers.mjs';
export async function GET(request:Request){
  const q=new URL(request.url).searchParams;
  try{return Response.json(await history(q.get('chain')||'',q.get('pair')||'',q.get('address')||'',q.get('period')||'24H'),{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Chart data is unavailable.'},{status:422});}
}
