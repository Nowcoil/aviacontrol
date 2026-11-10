import { useState } from 'react';
import { catalogName, cleanName, nameKey, related, type CatalogItem, type CatalogKind, type Catalogs } from './catalog';
import type { Entry } from './model';
import * as db from './db';
interface Props {kind:CatalogKind;catalogs:Catalogs;entries:Entry[];busy:boolean;mutate:(fn:()=>Promise<void>)=>Promise<void>;reload:()=>Promise<void>}
const titles={airline:'Авиакомпании',wheelPn:'Партийные номера колёс',tirePn:'Партийные номера шин'};
export default function CatalogManager({kind,catalogs,entries,busy,mutate,reload}:Props){
 const [query,setQuery]=useState(''),[value,setValue]=useState(''),[editing,setEditing]=useState<CatalogItem|null>(null),[updateHistory,setUpdateHistory]=useState(false),[problem,setProblem]=useState(''),[duplicate,setDuplicate]=useState<CatalogItem|null>(null);
 const items=catalogs[kind].filter(x=>nameKey(x.name).includes(nameKey(query))).sort((a,b)=>kind==='airline'?b.lastUsedAt.localeCompare(a.lastUsedAt)||a.name.localeCompare(b.name,'ru'):a.name.localeCompare(b.name,'ru'));
 const count=editing?entries.filter(r=>related(r,kind,editing.name)).length:0;
 function clear(){setValue('');setEditing(null);setUpdateHistory(false);setProblem('');setDuplicate(null);}
 async function save(e:React.FormEvent){e.preventDefault();const name=catalogName(kind,value);if(!name||name.length>150){setProblem('Введите значение от 1 до 150 символов.');return;}
  const found=catalogs[kind].find(x=>x.id!==editing?.id&&nameKey(x.name)===nameKey(name));if(found){setDuplicate(found);setProblem(`Уже есть «${found.name}». Можно использовать его вместо нового значения.`);return;}
  if(updateHistory&&count&&!confirm(`Изменить ${count} записей журнала: «${editing!.name}» → «${name}»? Даты и отметки 1С сохранятся. Несохранённый черновик не изменится.`))return;
  await mutate(async()=>{await db.editCatalog(kind,name,editing?.id,updateHistory);await reload();clear();});
 }
 return <section className="panel catalog-panel"><div className="panel-heading"><div><p className="eyebrow">ЛОКАЛЬНЫЙ СПРАВОЧНИК</p><h2>{titles[kind]} <span className="count">{catalogs[kind].length}</span></h2></div></div>
  <p className="section-note">{kind==='airline'?'Название можно вводить вручную или выбирать из справочника.':'Колёса и шины независимы: выбор одного номера не подставляет другой.'} Удаление из справочника сохраняет поступления.</p>
  <form onSubmit={save} className="catalog-form"><fieldset disabled={busy}><div className="fields"><label className="wide">{editing?'Изменить значение':'Добавить значение'}<input aria-label={kind==='airline'?'Название авиакомпании':'Партийный номер'} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize={kind==='airline'?'none':'characters'} value={value} maxLength={150} onChange={e=>{setValue(kind==='airline'?e.target.value:e.target.value.toUpperCase());setProblem('');setDuplicate(null);}} placeholder={kind==='airline'?'Например, Аэрофлот':'P/N'}/></label></div>
   {editing&&<label className="checkbox history-choice"><input type="checkbox" checked={updateHistory} onChange={e=>setUpdateHistory(e.target.checked)}/><span>Также изменить в журнале ({count})<small>Только после отдельного подтверждения. Черновик не изменится.</small></span></label>}
   {problem&&<p role="alert" className="field-error">{problem}</p>}{duplicate&&<button type="button" onClick={()=>{setQuery(duplicate.name);setValue(duplicate.name);setEditing(duplicate);setDuplicate(null);setProblem('Выбрано существующее значение. Новое не создано.');}}>Использовать «{duplicate.name}»</button>}
   <div className="buttons"><button className="primary" type="submit">{editing?'Сохранить название':'＋ Добавить'}</button>{editing&&<button type="button" onClick={clear}>Отмена</button>}</div>
  </fieldset></form>
  <div className="search"><span>⌕</span><input type="search" aria-label={'Поиск: '+titles[kind]} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск в справочнике…"/></div>
  <ul className="catalog-list">{items.map(item=><li key={item.id}><span>{item.name}</span><div><button disabled={busy} onClick={()=>{setEditing(item);setValue(item.name);setUpdateHistory(false);setProblem('');setDuplicate(null);}}>Изменить</button><button className="delete" disabled={busy} onClick={()=>{const usage=entries.filter(r=>related(r,kind,item.name)).length;if(confirm(`Удалить «${cleanName(item.name)}» из справочника?${usage?` Используется в ${usage} записях: они сохранятся.`:' Записи журнала не изменятся.'}`))void mutate(async()=>{await db.removeCatalog(kind,item.id);await reload();if(editing?.id===item.id)clear();});}}>Удалить</button></div></li>)}</ul>{!items.length&&<p className="section-note">{query?'Совпадений нет.':'Справочник пуст. Добавьте первое значение.'}</p>}
 </section>;
}
