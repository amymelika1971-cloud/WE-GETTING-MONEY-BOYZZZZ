import {security} from '@/lib/providers.mjs';
export async function GET(request:Request){
  const q=new URL(request.url).searchParams;
  try{return Response.json(await security(q.get('chain')||'',q.get('address')||''),{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Security data is unavailable.'},{status:422});}
}
