// Chapter-scoped image cache. Pending work and object URLs are released on exit.
export function createReaderCache({load,concurrency=2,createUrl=blob=>URL.createObjectURL(blob),revokeUrl=url=>URL.revokeObjectURL(url)}){
 const entries=new Map(),queue=[];let running=0,closed=false;
 const aborted=()=>new DOMException('Lectura cancelada.','AbortError');
 function pump(){
  while(!closed&&running<concurrency&&queue.length){
   const entry=queue.shift();if(entry.controller.signal.aborted)continue;
   running++;
   Promise.resolve().then(()=>load(entry.index,entry.controller.signal)).then(blob=>{
    if(closed||entry.controller.signal.aborted)throw aborted();
    entry.url=createUrl(blob);entry.resolve(entry.url);
   }).catch(error=>{
    if(entries.get(entry.index)===entry)entries.delete(entry.index);
    entry.reject(error);
   }).finally(()=>{running--;pump();});
  }
 }
 function remove(index){
  const entry=entries.get(index);if(!entry)return;
  entries.delete(index);entry.controller.abort();entry.reject(aborted());if(entry.url)revokeUrl(entry.url);
 }
 return {
  get(index){
   if(closed)return Promise.reject(aborted());
   let entry=entries.get(index);if(entry)return entry.promise;
   entry={index,controller:new AbortController()};
   entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});
   entries.set(index,entry);queue.push(entry);pump();return entry.promise;
  },
  retain(indexes){if(indexes===null)return;const keep=new Set(indexes);for(const index of entries.keys())if(!keep.has(index))remove(index);},
  close(){closed=true;for(const index of entries.keys())remove(index);queue.length=0;}
 };
}
