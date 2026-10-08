export function p2CardType(height: number) {return height < 115 ? {label:18, text:15, padding:14, gap:8, row:height<85} : {label:24,text:19,padding:20,gap:10,row:false};}

export function memberRadius(index: number, count: number) {return Math.hypot(index % 4 - 1.5, Math.floor(index / 4) - (Math.ceil(count / 4) - 1) / 2);}
