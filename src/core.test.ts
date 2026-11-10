import { describe,it,expect } from 'vitest';
import 'fake-indexeddb/auto';
import ExcelJS from 'exceljs';
import { backup,emptyForm,mergeEntries,normalize,parseBackup,suggestions,validate,validDate,matches,type Entry } from './model';
import { workbook,columns } from './export';
import * as db from './db';
const row=(changes:Partial<Entry>={}):Entry=>({...emptyForm(),id:'one',date:'2026-11-09',airline:'Нордстар',pn:'001a',sn:'sn-01',tirePn:'t-001',tireSn:'ts-01',createdAt:'2026-11-09T08:00:00Z',updatedAt:'2026-11-09T08:00:00Z',...changes});
describe('Правила журнала',()=>{
 it('нормализует все номера, сохраняя авиакомпанию и примечание',()=>{const r=normalize(row({notes:'  Ремонт в ноябре  ',retread:'r2'}));expect([r.pn,r.sn,r.tirePn,r.tireSn,r.retread]).toEqual(['001A','SN-01','T-001','TS-01','R2']);expect(r.airline).toBe('Нордстар');expect(r.notes).toBe('Ремонт в ноябре');});
 it('требует шину только для колеса',()=>{expect(validate({...emptyForm(),airline:'A',pn:'P',sn:'S',type:'brake'},'2026-11-09')).toEqual({});expect(validate(emptyForm(),'2026-11-09')).toHaveProperty('tirePn');expect(normalize(row({type:'brake'})).tirePn).toBe('');});
 it('проверяет даты без исключений',()=>{for(const d of ['2026-02-30','2026-99-99','','0000-01-01'])expect(validDate(d)).toBe(false);expect(validDate('2024-02-29')).toBe(true);});
 it('предлагает недавние авиакомпании без связи колеса и шины',()=>{const rows=[row(),row({id:'two',airline:'Победа',pn:'P2',tirePn:'T2',updatedAt:'2026-11-09T10:00:00Z'})];expect(suggestions(rows,'airline','brake')).toEqual(['Победа','Нордстар']);expect(suggestions(rows,'tirePn','wheel')).toEqual(['T2','t-001']);expect(suggestions(rows,'pn','wheel')).not.toContain('T2');expect(matches(rows[0],'норд')).toBe(true);});
});
describe('Резервные копии',()=>{
 it('полностью восстанавливает записи и отметку 1С',()=>{const original=normalize(row({in1c:true}));expect(parseBackup(JSON.stringify(backup([original])))).toEqual([original]);});
 it('отклоняет повреждённый файл, дубли и неизвестную версию',()=>{for(const x of [{version:2},backup([row({pn:''})]),backup([row(),row()]),backup([row({date:'2026-99-99'})])])expect(()=>parseBackup(JSON.stringify(x))).toThrow();});
 it('сливает по id, не удаляет записи и не заменяет свежие старыми',()=>{const fresh=row({updatedAt:'2026-11-09T12:00:00Z',notes:'Новая'});const result=mergeEntries([fresh,row({id:'keep'})],[row(),row({id:'new'})]);expect(result).toHaveLength(3);expect(result[0].notes).toBe('Новая');});
});
describe('Настоящий Excel',()=>{
 it('фильтрует месяц, исключает 1С, сохраняет строки, ведущие нули и текст вместо формул',async()=>{const data=await workbook([row({pn:'00012',sn:'=1+1',in1c:true}),row({id:'other',date:'2026-10-08'})],'2026-11');const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(data);const sheet=loaded.worksheets[0];expect(sheet.rowCount).toBe(2);expect(sheet.getRow(1).values).toEqual([undefined,...columns]);expect(sheet.getCell('D2').value).toBe('00012');expect(sheet.getCell('E2').value).toBe('=1+1');expect(sheet.columnCount).toBe(9);expect(Array.from(new Uint8Array(data).slice(0,2))).toEqual([80,75]);});
});
describe('IndexedDB',()=>{
 it('сохраняет, редактирует, объединяет, удаляет и защищает черновик',async()=>{await db.saveDraft({form:emptyForm(),date:'2026-11-09',editId:null});expect(await db.loadDraft()).toBeTruthy();await db.saveEntry(row());expect(await db.loadDraft()).toBeUndefined();expect(await db.loadEntries()).toHaveLength(1);await db.saveDraft({form:{...emptyForm(),pn:'DRAFT'},date:'2026-11-08',editId:null});await db.updateEntry(row({in1c:true}));expect((await db.loadDraft())?.form.pn).toBe('DRAFT');expect((await db.loadEntries())[0].in1c).toBe(true);await db.importEntries([row({id:'two'})]);expect(await db.loadEntries()).toHaveLength(2);await db.deleteEntry('one');expect((await db.loadEntries()).map(r=>r.id)).toEqual(['two']);});
});
