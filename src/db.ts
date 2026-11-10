import { openDB } from 'idb';
import { mergeEntries, type Entry, type Form } from './model';
import { addCatalogValue, catalogName, catalogsFromHistory, emptyCatalogs, nameKey, related, rememberEntry, renameInEntry, type CatalogKind, type Catalogs } from './catalog';
import type { DateMode } from './date';
import type { FullBackup } from './backup';
export interface Draft {form:Form;date:string;editId:string|null;dateMode?:DateMode;createdAt?:string}
export interface BeforeUpdate {savedAt:string;entries:Entry[];draft?:Draft}
export interface Preferences {catalogs:Catalogs;employee:string}
export class DuplicateCatalogError extends Error {constructor(public existing:string){super(`Уже есть «${existing}». Используйте существующее значение.`);}}
const CATALOG_KEY='catalogs-v2', EMPLOYEE_KEY='employee-v2', SNAPSHOT_KEY='before-update-v2';
// Preserve the v1 database, its version and both stores. New features use settings keys.
export function createRepository(name='aviacontrol-local'){
 let connection:ReturnType<typeof openDB>|undefined;
 const database=()=>connection??=openDB(name,1,{upgrade(db){db.createObjectStore('entries',{keyPath:'id'});db.createObjectStore('settings');}});
 async function init():Promise<Preferences>{
  const tx=(await database()).transaction(['entries','settings'],'readwrite'),settings=tx.objectStore('settings');
  let catalogs=await settings.get(CATALOG_KEY) as Catalogs|undefined;
  if(!catalogs){const entries=await tx.objectStore('entries').getAll() as Entry[];const draft=await settings.get('draft') as Draft|undefined;
   await settings.put({savedAt:new Date().toISOString(),entries,draft} satisfies BeforeUpdate,SNAPSHOT_KEY);
   catalogs=catalogsFromHistory(entries);await settings.put(catalogs,CATALOG_KEY);
  }
  const employee=await settings.get(EMPLOYEE_KEY) as string|undefined;await tx.done;return {catalogs,employee:employee??''};
 }
 async function loadEntries():Promise<Entry[]>{return (await database()).getAll('entries');}
 async function loadDraft():Promise<Draft|undefined>{return (await database()).get('settings','draft');}
 async function saveDraft(draft:Draft){await (await database()).put('settings',draft,'draft');}
 async function saveEmployee(employee:string){await (await database()).put('settings',employee,EMPLOYEE_KEY);}
 async function saveEntry(entry:Entry){const tx=(await database()).transaction(['entries','settings'],'readwrite'),settings=tx.objectStore('settings');await tx.objectStore('entries').put(entry);const catalogs=await settings.get(CATALOG_KEY) as Catalogs|undefined;await settings.put(rememberEntry(catalogs??emptyCatalogs(),entry),CATALOG_KEY);await settings.delete('draft');await tx.done;}
 async function updateEntry(entry:Entry){await (await database()).put('entries',entry);}
 async function deleteEntry(id:string){await (await database()).delete('entries',id);}
 async function editCatalog(kind:CatalogKind,value:string,id?:string,updateHistory=false){
  const valueName=catalogName(kind,value);if(!valueName||valueName.length>150)throw Error('Введите значение от 1 до 150 символов.');
  const tx=(await database()).transaction(['entries','settings'],'readwrite'),settings=tx.objectStore('settings');
  try {
   const catalogs=(await settings.get(CATALOG_KEY) as Catalogs|undefined)??emptyCatalogs();
   const duplicate=catalogs[kind].find(x=>x.id!==id&&nameKey(x.name)===nameKey(valueName));if(duplicate)throw new DuplicateCatalogError(duplicate.name);
   const original=catalogs[kind].find(x=>x.id===id);if(id&&!original)throw Error('Значение уже удалено. Откройте справочник заново.');
   const next=original?{...catalogs,[kind]:catalogs[kind].map(x=>x.id===id?{...x,name:valueName}:x)}:addCatalogValue(catalogs,kind,valueName);
   if(original&&updateHistory){const records=await tx.objectStore('entries').getAll() as Entry[];const now=new Date().toISOString();for(const r of records)if(related(r,kind,original.name))await tx.objectStore('entries').put(renameInEntry(r,kind,valueName,now));}
   await settings.put(next,CATALOG_KEY);await tx.done;
  }catch(e){try{tx.abort();}catch{/* Already aborted. */}await tx.done.catch(()=>{});throw e;}
 }
 async function removeCatalog(kind:CatalogKind,id:string){const tx=(await database()).transaction('settings','readwrite');const c=await tx.store.get(CATALOG_KEY) as Catalogs;await tx.store.put({...c,[kind]:c[kind].filter(x=>x.id!==id)},CATALOG_KEY);await tx.done;}
 async function importBackup(incoming:FullBackup){
  const tx=(await database()).transaction(['entries','settings'],'readwrite'),settings=tx.objectStore('settings');const all=await tx.objectStore('entries').getAll() as Entry[];const merged=mergeEntries(all,incoming.entries);
  let catalogs=(await settings.get(CATALOG_KEY) as Catalogs|undefined)??emptyCatalogs();
  for(const r of incoming.entries)catalogs=rememberEntry(catalogs,r);
  if(incoming.catalogs)for(const kind of ['airline','wheelPn','tirePn'] as const)for(const item of incoming.catalogs[kind])catalogs=addCatalogValue(catalogs,kind,item.name,item.lastUsedAt);
  for(const r of merged)await tx.objectStore('entries').put(r);await settings.put(catalogs,CATALOG_KEY);
  if(incoming.employee&&!await settings.get(EMPLOYEE_KEY))await settings.put(incoming.employee,EMPLOYEE_KEY);
  await tx.done;return merged;
 }
 async function importEntries(incoming:Entry[]){return importBackup({entries:incoming});}
 async function beforeUpdate():Promise<BeforeUpdate|undefined>{return (await database()).get('settings',SNAPSHOT_KEY);}
 async function close(){if(connection){(await connection).close();connection=undefined;}}
 return {init,loadEntries,loadDraft,saveDraft,saveEntry,updateEntry,deleteEntry,saveEmployee,editCatalog,removeCatalog,importEntries,importBackup,beforeUpdate,close};
}
const repository=createRepository();
export const {init,loadEntries,loadDraft,saveDraft,saveEntry,updateEntry,deleteEntry,saveEmployee,editCatalog,removeCatalog,importEntries,importBackup,beforeUpdate}=repository;
