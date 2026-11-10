import { emptyForm, today, type Form } from './model';
export type DateMode = 'auto'|'manual';
export function hasDraft(form:Form,editId:string|null){return editId!==null||Object.keys(emptyForm()).some(k=>form[k as keyof Form]!==emptyForm()[k as keyof Form]);}
export function dateDecision(date:string,mode:DateMode,dirty:boolean,current=today()){if(date===current)return {date,notice:false};return mode==='auto'&&!dirty?{date:current,notice:false}:{date,notice:true};}
