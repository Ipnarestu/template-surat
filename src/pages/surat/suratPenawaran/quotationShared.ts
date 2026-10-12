export type QuotationItem = {

  id:string

  description:string

  quantity:number

  unit:string

  unitPrice:number

}



export type TaxMode =
'percent'
|
'manual'



export type QuotationData = {


recipient:string

address:string

city:string


date:string

number:string

validityDays:string


senderCompany:string

introduction:string


signer:string

position:string

email:string

phone:string


items:QuotationItem[]



taxEnabled?:boolean

taxMode?:TaxMode

taxRate?:number

taxManualAmount?:number



signatureImage?:string

stampImage?:string

}



export type ExportFormat =
'xlsx'
|
'pdf'
|
'docx'



export const MAX_ITEMS = 50

export const MAX_INTRODUCTION_LENGTH = 1500

export const MAX_ITEM_DESCRIPTION_LENGTH = 600



export const TAX_RATE = 11



export const rupiahFormatter =
new Intl.NumberFormat(
'id-ID',
{
style:'currency',
currency:'IDR',
maximumFractionDigits:0
}
)



export function calculateTotals(

items:QuotationItem[],

data?:Pick<
QuotationData,
'taxEnabled'
|
'taxMode'
|
'taxRate'
|
'taxManualAmount'
>

){


const subtotal =
items.reduce(
(sum,item)=>
sum+(item.quantity*item.unitPrice),
0
)



let tax=0



if(data?.taxEnabled !== false){


if(data?.taxMode==="manual"){

tax=data.taxManualAmount ?? 0

}

else{

tax=
subtotal*
((data?.taxRate ?? 11)/100)

}


}



return{

subtotal,

tax,

grandTotal:
subtotal+tax

}


}





let itemCounter=1


export function createEmptyItem():QuotationItem{


return{

id:
`item-${itemCounter++}`,

description:"",

quantity:1,

unit:"pcs",

unitPrice:0

}


}





export function getPrintedItems(
data:QuotationData
){

return data.items.filter(
item =>
item.description.trim() !== ''
)

}





export function validateQuotation(
data:QuotationData
){


if(
!data.recipient ||
!data.number ||
!data.date ||
!data.senderCompany
){

return "Data surat belum lengkap"

}



if(
getPrintedItems(data).length===0
){

return "Minimal satu produk harus diisi"

}



return ""

}





export function quotationFileName(
  data: QuotationData,
  format: ExportFormat,
) {

  const recipient =
    data.recipient
      ? data.recipient
          .trim()
          .replace(/[^a-zA-Z0-9]/g, '-')
          .toLowerCase()
      : 'tanpa-nama'


  const number =
    data.number
      ? data.number
          .trim()
          .replace(/[^a-zA-Z0-9]/g, '-')
      : 'tanpa-nomor'


  return `Surat-Penawaran-${number}-${recipient}.${format}`

}





export function downloadBlob(
blob:Blob,
name:string
){

const url =
URL.createObjectURL(blob)


const a=document.createElement('a')

a.href=url

a.download=name

a.click()


URL.revokeObjectURL(url)

}