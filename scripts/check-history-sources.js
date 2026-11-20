import {TOPICS,fetchSource,extractTable} from '../server/history.js';
for(const topic of TOPICS.slice(0,4)){
  try{const text=await fetchSource(topic);const rows=extractTable(text,topic);console.log(JSON.stringify({slug:topic.slug,teams:rows.length,champion:rows[0].team,points:rows[0].points}));}
  catch(e){console.log(JSON.stringify({slug:topic.slug,error:e.message}));process.exitCode=1;}
}
