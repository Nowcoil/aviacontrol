import { suggestions, type Entry, type Form } from './model';
export type CatalogKind = 'airline' | 'wheelPn' | 'tirePn';
export interface CatalogItem { id:string; name:string; lastUsedAt:string }
export type Catalogs = Record<CatalogKind,CatalogItem[]>;
export const emptyCatalogs = ():Catalogs => ({airline:[],wheelPn:[],tirePn:[]});
export const cleanName = (value:string) => value.trim().replace(/\s+/g,' ');
export const catalogName = (kind:CatalogKind,value:string) => kind==='airline'?cleanName(value):cleanName(value).toUpperCase();
export const nameKey = (value:string) => cleanName(value).toLocaleUpperCase('ru');
export function addCatalogValue(catalogs:Catalogs,kind:CatalogKind,value:string,usedAt=''):Catalogs {
 const name=catalogName(kind,value);if(!name)return catalogs;
 const found=catalogs[kind].find(item=>nameKey(item.name)===nameKey(name));
 const items=found?catalogs[kind].map(item=>item.id===found.id&&usedAt>item.lastUsedAt?{...item,lastUsedAt:usedAt}:item):[...catalogs[kind],{id:crypto.randomUUID(),name,lastUsedAt:usedAt}];
 return {...catalogs,[kind]:items};
}
export function rememberEntry(catalogs:Catalogs,r:Entry){let next=addCatalogValue(catalogs,'airline',r.airline,r.updatedAt);if(r.type==='wheel'){next=addCatalogValue(next,'wheelPn',r.pn,r.updatedAt);next=addCatalogValue(next,'tirePn',r.tirePn,r.updatedAt);}return next;}
export function catalogsFromHistory(entries:Entry[]){return [...entries].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).reduce(rememberEntry,emptyCatalogs());}
export function related(r:Entry,kind:CatalogKind,name:string){return kind==='airline'?nameKey(r.airline)===nameKey(name):r.type==='wheel'&&nameKey(kind==='wheelPn'?r.pn:r.tirePn)===nameKey(name);}
export function renameInEntry(r:Entry,kind:CatalogKind,name:string,now:string):Entry {return {...r,[kind==='airline'?'airline':kind==='wheelPn'?'pn':'tirePn']:name,updatedAt:now};}
export function rankedOptions(values:string[],query:string){const q=nameKey(query),unique=new Map<string,string>();for(const value of values){const name=cleanName(value);if(name&&!unique.has(nameKey(name)))unique.set(nameKey(name),name);}return [...unique.values()].filter(v=>nameKey(v).includes(q)).map((value,index)=>({value,index,rank:nameKey(value)===q?0:nameKey(value).startsWith(q)?1:2})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.value);}
export function fieldOptions(entries:Entry[],catalogs:Catalogs,key:'airline'|'pn'|'sn'|'tirePn'|'tireSn'|'retread',type:Form['type']){
 if(key==='airline')return [...catalogs.airline].sort((a,b)=>b.lastUsedAt.localeCompare(a.lastUsedAt)||a.name.localeCompare(b.name,'ru')).map(x=>x.name);
 const history=suggestions(entries,key,type),kind=key==='tirePn'?'tirePn':key==='pn'&&type==='wheel'?'wheelPn':null;
 return rankedOptions(kind?[...catalogs[kind].map(x=>x.name),...history]:history,'');
}
