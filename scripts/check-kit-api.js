// Diagnostic uses rejected input, so it cannot change a player's confirmation.
const headers={apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
try{
 const response=await fetch(process.env.VITE_SUPABASE_URL+'/rest/v1/rpc/save_registration',{method:'POST',headers,body:JSON.stringify({candidate_id:'p1',expected_version:-1,new_team:'',new_status:'confirmed',new_kit:null}),signal:AbortSignal.timeout(15000)});
 const body=await response.json();console.log(JSON.stringify({status:response.status,validationCode:body.code,noDataChanged:body.code==='P0001'}));
}catch(error){console.log(JSON.stringify({networkError:error.name}));process.exitCode=1;}
