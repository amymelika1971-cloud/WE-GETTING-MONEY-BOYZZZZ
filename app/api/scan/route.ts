import {scan} from '@/lib/providers.mjs';
export async function GET(request:Request){
  const q=new URL(request.url).searchParams;
  try{return Response.json(await scan(q.get('input')||'',q.get('chain')||'auto'),{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Market data is unavailable.'},{status:422});}
}
