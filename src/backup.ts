import { backup, parseBackup, type Entry } from './model';
import { catalogName, emptyCatalogs, nameKey, type Catalogs } from './catalog';
export interface FullBackup {entries:Entry[];catalogs?:Catalogs;employee?:string}
export function fullBackup(entries:Entry[],catalogs:Catalogs,employee:string){return {...backup(entries),version:2,catalogs,employee};}
export function parseFullBackup(text:string):FullBackup {
 const raw=JSON.parse(text);if(raw?.version===1)return {entries:parseBackup(text)};
 if(raw?.app!=='aviacontrol'||raw.version!==2||typeof raw.employee!=='string'||raw.employee.length>100||!raw.catalogs)throw Error('Некорректная резервная копия АвиаКонтроля.');
 const entries=parseBackup(JSON.stringify({...raw,version:1})),catalogs=emptyCatalogs();
 for(const kind of ['airline','wheelPn','tirePn'] as const){const items=raw.catalogs[kind];if(!Array.isArray(items)||items.length>100000)throw Error('Повреждён справочник в резервной копии.');const keys=new Set<string>();for(const item of items){if(typeof item?.name!=='string'||typeof item.lastUsedAt!=='string'||item.lastUsedAt!==''&&!Number.isFinite(Date.parse(item.lastUsedAt)))throw Error('Некорректное значение справочника.');const name=catalogName(kind,item.name);if(!name||name.length>150||keys.has(nameKey(name)))throw Error('Пустое или повторяющееся значение справочника.');keys.add(nameKey(name));catalogs[kind].push({id:crypto.randomUUID(),name,lastUsedAt:item.lastUsedAt});}}
 return {entries,catalogs,employee:raw.employee.trim()};
}
