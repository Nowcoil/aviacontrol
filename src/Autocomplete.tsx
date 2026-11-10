import { useId, useState } from 'react';
import { rankedOptions } from './catalog';
interface Props {label:string;value:string;values:string[];onChange:(value:string)=>void;required?:boolean;upper?:boolean;placeholder?:string;error?:string;wide?:boolean}
export default function Autocomplete({label,value,values,onChange,required=false,upper=false,placeholder,error,wide=false}:Props){
 const id=useId(),[open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const options=rankedOptions(values,value).slice(0,20),visible=open&&options.length>0;
 const choose=(option:string)=>{onChange(option);setOpen(false);setActive(-1);};
 return <div className={'autocomplete '+(wide?'wide':'')}>
  <label htmlFor={id}>{label}{required&&<span className="required"> *</span>}</label>
  <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible?id+'-list':undefined} aria-activedescendant={visible&&active>=0?id+'-'+active:undefined} aria-invalid={!!error} aria-describedby={error?id+'-error':undefined} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize={upper?'characters':'none'} maxLength={150} required={required} value={value} placeholder={placeholder} onFocus={()=>setOpen(true)} onBlur={()=>{setOpen(false);setActive(-1);}} onChange={e=>{onChange(upper?e.target.value.toUpperCase():e.target.value);setOpen(true);setActive(-1);}} onKeyDown={e=>{
   if(e.key==='Escape'){setOpen(false);setActive(-1);e.preventDefault();}
   if(e.key==='ArrowDown'&&options.length){e.preventDefault();setOpen(true);setActive(i=>Math.min(i+1,options.length-1));}
   if(e.key==='ArrowUp'&&visible){e.preventDefault();setActive(i=>Math.max(0,i-1));}
   if(e.key==='Enter'&&visible&&active>=0){e.preventDefault();choose(options[active]);}
  }}/>
  {visible&&<ul id={id+'-list'} role="listbox" aria-label={'Подсказки: '+label} className="suggestions">{options.map((v,i)=><li key={v} role="option" id={id+'-'+i} aria-selected={i===active}><button type="button" tabIndex={-1} className={i===active?'selected':''} onPointerDown={e=>{e.preventDefault();choose(v);}} onClick={()=>choose(v)}>{v}</button></li>)}</ul>}
  {error&&<small id={id+'-error'} className="field-error">{error}</small>}
 </div>;
}
