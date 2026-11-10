import {describe,it,expect} from 'vitest';
import 'fake-indexeddb/auto';
import {openDB} from 'idb';
import ExcelJS from 'exceljs';
import {createRepository,DuplicateCatalogError,type Draft} from './db';
import {backup,emptyForm,normalize,type Entry} from './model';
import {catalogsFromHistory,emptyCatalogs,fieldOptions,rankedOptions} from './catalog';
import {dateDecision,hasDraft} from './date';
import {fullBackup,parseFullBackup} from './backup';
import {monthlyFilename,noteChunks,rowHeight,workbook} from './export';
const entry=(changes:Partial<Entry>={}):Entry=>({...emptyForm(),id:crypto.randomUUID(),date:'2026-11-03',airline:'  Аэрофлот  ',pn:'0001ab',sn:'001SN',tirePn:'T-1',tireSn:'TS-1',in1c:true,notes:'Старая запись',createdAt:'2026-11-03T06:00:00Z',updatedAt:'2026-11-03T06:00:00Z',...changes});
const freshRepo=()=>createRepository('test-'+crypto.randomUUID());
describe('Обновление реальной схемы v1 без изменения записей',()=>{
 it('сохраняет записи, даты, 1С и черновик байт-в-байт; справочники заполняются один раз',async()=>{
  const name='legacy-'+crypto.randomUUID(),old=await openDB(name,1,{upgrade(d){d.createObjectStore('entries',{keyPath:'id'});d.createObjectStore('settings');}});
  const records=[entry(),entry({date:'2026-10-10',airline:'АЭРОФЛОТ',in1c:false}),entry({type:'brake',pn:'BRAKE',tirePn:'',tireSn:''})];
  const draft:Draft={date:'2026-10-11',form:{...emptyForm(),pn:'DRAFT'},editId:null};
  const tx=old.transaction(['entries','settings'],'readwrite');for(const r of records)await tx.objectStore('entries').put(r);await tx.objectStore('settings').put(draft,'draft');await tx.done;old.close();
  const repo=createRepository(name),prefs=await repo.init();
  expect((await repo.loadEntries()).sort((a,b)=>a.id.localeCompare(b.id))).toEqual(records.sort((a,b)=>a.id.localeCompare(b.id)));
  expect(await repo.loadDraft()).toEqual(draft);expect(prefs.catalogs.airline).toHaveLength(1);expect(prefs.catalogs.wheelPn.map(x=>x.name)).toEqual(['0001AB']);expect(prefs.catalogs.tirePn.map(x=>x.name)).toEqual(['T-1']);
  const snapshot=await repo.beforeUpdate();expect(snapshot?.entries).toEqual(await repo.loadEntries());expect(snapshot?.draft).toEqual(draft);
  await repo.removeCatalog('airline',prefs.catalogs.airline[0].id);await repo.close();await repo.init();expect((await repo.init()).catalogs.airline).toEqual([]);expect(await repo.beforeUpdate()).toEqual(snapshot);
  const check=await openDB(name);expect(check.version).toBe(1);expect([...check.objectStoreNames]).toEqual(['entries','settings']);check.close();await repo.close();
 });
 it('обновлённый экспорт читает старые записи, не меняя локальную базу',async()=>{const repo=freshRepo();await repo.saveEntry(entry({id:'old'}));await repo.init();const before=await repo.loadEntries();const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(before,'2026-11'));expect(book.worksheets[0].getCell('D2').value).toBe('0001ab');expect(await repo.loadEntries()).toEqual(before);await repo.close();});
});
describe('Справочники и подтверждённое изменение истории',()=>{
 it('отклоняет пробельные и регистровые дубли, не меняя журнал',async()=>{const repo=freshRepo();await repo.init();await repo.editCatalog('airline','  Аэро   Флот  ');await expect(repo.editCatalog('airline','аэро флот')).rejects.toBeInstanceOf(DuplicateCatalogError);expect((await repo.init()).catalogs.airline.map(x=>x.name)).toEqual(['Аэро Флот']);expect(await repo.loadEntries()).toEqual([]);await repo.close();});
 it('переименование по умолчанию не меняет историю; отдельный выбор изменяет только связанные записи',async()=>{
  const repo=freshRepo();await repo.init();await repo.saveEntry(entry({id:'a'}));await repo.saveEntry(entry({id:'b',airline:'Другая',in1c:false}));
  let item=(await repo.init()).catalogs.airline.find(x=>x.name==='Аэрофлот')!;const before=await repo.loadEntries();await repo.editCatalog('airline','Новое название',item.id);expect(await repo.loadEntries()).toEqual(before);
  await repo.editCatalog('airline','Аэрофлот',item.id);await repo.editCatalog('airline','Новое название',item.id,true);
  const rows=await repo.loadEntries();expect(rows.find(x=>x.id==='a')?.airline).toBe('Новое название');expect(rows.find(x=>x.id==='a')?.date).toBe('2026-11-03');expect(rows.find(x=>x.id==='a')?.in1c).toBe(true);expect(rows.find(x=>x.id==='b')).toEqual(before.find(x=>x.id==='b'));
  const snap=await repo.loadEntries();await repo.removeCatalog('airline',item.id);expect(await repo.loadEntries()).toEqual(snap);await repo.close();
 });
 it('P/N независимы, в верхнем регистре; переименование истории только по выбору',async()=>{const repo=freshRepo();await repo.init();await repo.saveEntry(entry({id:'w'}));await repo.editCatalog('wheelPn','pn-2');await repo.editCatalog('tirePn','pn-2');await expect(repo.editCatalog('wheelPn',' PN-2 ')).rejects.toThrow();const id=(await repo.init()).catalogs.wheelPn.find(x=>x.name==='0001AB')!.id;await repo.editCatalog('wheelPn','changed',id,true);expect((await repo.loadEntries())[0].pn).toBe('CHANGED');expect((await repo.loadEntries())[0].tirePn).toBe('T-1');await repo.close();});
});
describe('Собственные подсказки',()=>{
 it('совпадения, префиксы, регистр и отсутствие дублей',()=>{expect(rankedOptions(['X261','261B','261A','261b','261'],'261')).toEqual(['261','261B','261A','X261']);expect(rankedOptions(['AbC','abc','ZABC'],'abc')).toEqual(['AbC','ZABC']);});
 it('авиакомпании только из справочника; тормоза не получают P/N колёс',()=>{const rows=[entry()],catalogs=catalogsFromHistory(rows);expect(fieldOptions(rows,emptyCatalogs(),'airline','wheel')).toEqual([]);expect(fieldOptions(rows,catalogs,'pn','brake')).toEqual([]);expect(fieldOptions(rows,catalogs,'tirePn','wheel')).toEqual(['T-1']);expect(fieldOptions(rows,catalogs,'pn','wheel')).not.toContain('T-1');});
});
describe('Дата устройства',()=>{
 it('обновляет пустую автоформу после полуночи',()=>expect(dateDecision('2026-11-09','auto',false,'2026-11-10')).toEqual({date:'2026-11-10',notice:false}));
 it('защищает черновик, редактирование и ручной выбор даты',()=>{for(const [mode,dirty] of [['auto',true],['manual',false],['manual',true]] as const)expect(dateDecision('2026-11-09',mode,dirty,'2026-11-10')).toEqual({date:'2026-11-09',notice:true});expect(hasDraft({...emptyForm(),pn:'abc'},null)).toBe(true);expect(hasDraft(emptyForm(),'editing')).toBe(true);expect(hasDraft(emptyForm(),null)).toBe(false);});
});
describe('Месячный Excel',()=>{
 it('сортирует дневные листы, не создаёт пустые, печатает A4 в ширину без ограничения высоты',async()=>{
  const rows=[normalize(entry({date:'2026-11-10'})),normalize(entry({date:'2026-11-03'})),normalize(entry({date:'2026-10-20'}))],book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(rows,'2026-11'));
  expect(book.worksheets.map(s=>s.name)).toEqual(['03.11','10.11']);for(const sheet of book.worksheets){expect(sheet.rowCount).toBe(2);expect(sheet.getCell('A2').value).toBe('2026-11-'+sheet.name.slice(0,2));expect(sheet.columnCount).toBe(9);expect(sheet.pageSetup.paperSize).toBe(9);expect(sheet.pageSetup.orientation).toBe('landscape');expect(sheet.pageSetup.fitToWidth).toBe(1);expect(sheet.pageSetup.fitToHeight).toBe(0);expect(sheet.pageSetup.printTitlesRow).toBe('1:1');expect(sheet.views[0].state).toBe('frozen');expect(sheet.autoFilter).toBeTruthy();expect(sheet.getCell('D2').numFmt).toBe('@');expect(sheet.getCell('I2').alignment.wrapText).toBe(true);}
 });
 it('повторный экспорт отражает изменения и удаления',async()=>{const old=entry({id:'one'}),changed={...old,airline:'Новое',date:'2026-11-10'};const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook([changed],'2026-11'));expect(book.worksheets.map(s=>s.name)).toEqual(['10.11']);expect(book.worksheets[0].getCell('B2').value).toBe('Новое');await expect(workbook([],'2026-11')).rejects.toThrow();});
 it('имя файла и высота строк',()=>{expect(monthlyFilename('  Антон  ','2026-11')).toBe('Антон_Ноябрь_2026.xlsx');expect(monthlyFilename('Имя/другое','2026-01')).toBe('Имя_другое_Январь_2026.xlsx');expect(rowHeight(['short'])).toBe(30);expect(rowHeight(['a\nb\nc'])).toBeGreaterThan(40);});
 it('очень длинные примечания не обрезаются пределом высоты строки Excel',async()=>{const text='Длинное примечание '.repeat(200);expect(noteChunks(text).join('')).toBe(text);const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook([entry({notes:text})],'2026-11'));const sheet=book.worksheets[0];let restored='';sheet.eachRow((row,i)=>{if(i>1){expect(row.height).toBeLessThan(409);restored+=String(row.getCell(9).value).replace(/^↳ /,'');}});expect(restored).toBe(text);});
});
describe('Совместимость JSON',()=>{
 it('восстанавливает старую копию v1, не теряя 1С, и заполняет новые справочники',async()=>{const repo=freshRepo();await repo.init();const rows=[normalize(entry())];await repo.importBackup(parseFullBackup(JSON.stringify(backup(rows))));expect(await repo.loadEntries()).toEqual(rows);expect((await repo.init()).catalogs.airline).toHaveLength(1);await repo.close();});
 it('восстанавливает справочники и имя из v2; повреждённые справочники отклоняются до записи',async()=>{const repo=freshRepo();await repo.init();const data=fullBackup([normalize(entry())],catalogsFromHistory([entry()]),'Антон');const restored=parseFullBackup(JSON.stringify(data));await repo.importBackup(restored);expect((await repo.init()).employee).toBe('Антон');expect((await repo.init()).catalogs.wheelPn[0].name).toBe('0001AB');await repo.saveEmployee('Коллега');await repo.importBackup(restored);expect((await repo.init()).employee).toBe('Коллега');expect(()=>parseFullBackup(JSON.stringify({...data,catalogs:{...data.catalogs,wheelPn:[{name:'',lastUsedAt:''}]}}))).toThrow();await repo.close();});
});
