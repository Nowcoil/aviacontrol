import ExcelJS from 'exceljs';
import { validDate, type Entry } from './model';
export const columns=['Дата','Авиакомпания','Тип компонента','P/N компонента','S/N компонента','P/N шины','S/N шины','Номер наварки','Примечания'];
const widths=[12,21,16,19,19,19,19,12,32];
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export function validMonth(month:string){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&validDate(month+'-01');}
export function monthlyFilename(employee:string,month:string){if(!validMonth(month))throw Error('Выберите месяц и год.');const name=employee.trim().replace(/\s+/g,' ').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'Сотрудник';return `${name}_${months[Number(month.slice(5))-1]}_${month.slice(0,4)}.xlsx`;}
// Reserve wrapped row height: Excel readers do not reliably AutoFit on first opening.
export function rowHeight(values:string[],columnWidths=widths){return Math.min(409,Math.max(30,...values.map((value,i)=>value.split(/\r?\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/Math.max(1,Math.floor(columnWidths[i]-2)))),0)*13+10)));}
// Excel caps one row at 409 points. Split very long notes into labelled continuation
// rows rather than hide their tail or shrink the entire worksheet to unreadable text.
export function noteChunks(text:string){const chunks:string[]=[];let start=0,lines=1,column=0;for(let i=0;i<text.length;i++){if(text[i]==='\n'){lines++;column=0;}else if(++column>30){lines++;column=1;}if(lines>25){chunks.push(text.slice(start,i));start=i;lines=1;column=text[i]==='\n'?0:1;}}chunks.push(text.slice(start));return chunks;}
export async function workbook(entries:Entry[],month:string){
 if(!validMonth(month))throw Error('Выберите корректный месяц и год.');
 const selected=entries.filter(r=>r.date.startsWith(month+'-'));if(!selected.length)throw Error('За выбранный месяц нет сохранённых поступлений.');
 const book=new ExcelJS.Workbook();book.creator='АвиаКонтроль';book.calcProperties.fullCalcOnLoad=true;
 for(const date of [...new Set(selected.map(r=>r.date))].sort()){
  const sheet=book.addWorksheet(`${date.slice(8)}.${date.slice(5,7)}`,{views:[{state:'frozen',ySplit:1}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1',margins:{left:.2,right:.2,top:.3,bottom:.3,header:.1,footer:.15}}});
  sheet.columns=columns.map((header,i)=>({header,key:String(i),width:widths[i]}));
  for(const r of selected.filter(r=>r.date===date).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
   const notes=noteChunks(r.notes);for(const [i,note] of notes.entries()){
    const values=i===0?[r.date,r.airline,r.type==='wheel'?'Колесо':'Тормоз',r.pn,r.sn,r.tirePn,r.tireSn,r.retread,note]:['','','','','','','','','↳ '+note];const row=sheet.addRow(values);row.height=rowHeight(values);
    row.eachCell({includeEmpty:true},cell=>{cell.numFmt='@';cell.font={name:'Calibri',size:11};cell.alignment={vertical:'top',wrapText:true};cell.border={bottom:{style:'hair',color:{argb:'FFDDE5DF'}}};});
   }
  }
  sheet.getRow(1).height=32;sheet.getRow(1).eachCell(c=>{c.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF102E33'}};c.alignment={vertical:'middle',wrapText:true};});
  sheet.autoFilter={from:'A1',to:`I${sheet.rowCount}`};sheet.pageSetup.printArea=`A1:I${sheet.rowCount}`;sheet.headerFooter.oddFooter='&LАвиаКонтроль&C'+date+'&RСтраница &P из &N';
 }
 return book.xlsx.writeBuffer();
}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
