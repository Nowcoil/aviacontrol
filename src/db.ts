import { openDB } from 'idb';
import { mergeEntries, type Entry, type Form } from './model';
export interface Draft {form:Form;date:string;editId:string|null;createdAt?:string}
const db=openDB('aviacontrol-local',1,{upgrade(db){db.createObjectStore('entries',{keyPath:'id'});db.createObjectStore('settings');}});
export async function loadEntries():Promise<Entry[]>{return (await db).getAll('entries');}
export async function loadDraft():Promise<Draft|undefined>{return (await db).get('settings','draft');}
export async function saveDraft(draft:Draft){await (await db).put('settings',draft,'draft');}
export async function saveEntry(entry:Entry){const tx=(await db).transaction(['entries','settings'],'readwrite');await tx.objectStore('entries').put(entry);await tx.objectStore('settings').delete('draft');await tx.done;}
export async function deleteEntry(id:string){await (await db).delete('entries',id);}
export async function updateEntry(entry:Entry){await (await db).put('entries',entry);}
export async function importEntries(incoming:Entry[]){const tx=(await db).transaction('entries','readwrite');const all=await tx.store.getAll();const merged=mergeEntries(all,incoming);for(const r of merged)await tx.store.put(r);await tx.done;return merged;}
