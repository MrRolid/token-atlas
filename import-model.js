export function validateModel(meta,weights){
 const fail=()=>{throw Error('Neplatný nebo nekompatibilní model. Použij formát Token Atlas v1 (1 000 tokenů, 48D, 2 vrstvy, 4 hlavy, kontext 48).')};
 if(!meta||meta.d!==48||meta.heads!==4||meta.layers!==2||meta.context!==48||!Array.isArray(meta.vocab)||meta.vocab.length!==1000||!meta.vocab.every(v=>typeof v==='string'&&v.length>0&&v.length<=80)||new Set(meta.vocab).size!==1000)fail();
 if(['<pad>','<bos>','<eos>','<unk>','<q>','<a>'].some((v,i)=>meta.vocab[i]!==v))fail();
 if(!(weights instanceof Float32Array)||weights.length!==137320||!weights.every(Number.isFinite))fail();
 const shapes={'emb.weight':[1000,48],'pos.weight':[48,48],'norm.weight':[48],'norm.bias':[48],'head.weight':[1000,48],'head.bias':[1000]};
 for(let l=0;l<2;l++)for(let [k,s] of Object.entries({'n1.weight':[48],'n1.bias':[48],'n2.weight':[48],'n2.bias':[48],'qkv.weight':[144,48],'qkv.bias':[144],'proj.weight':[48,48],'proj.bias':[48],'fc.weight':[96,48],'fc.bias':[96],'out.weight':[48,96],'out.bias':[48]}))shapes[`blocks.${l}.${k}`]=s;
 if(!meta.offsets||Object.keys(meta.offsets).length!==Object.keys(shapes).length)fail();let spans=[];
 for(let [k,shape] of Object.entries(shapes)){let o=meta.offsets[k];if(!o||!Number.isInteger(o.offset)||o.offset<0||JSON.stringify(o.shape)!==JSON.stringify(shape))fail();let end=o.offset+shape.reduce((a,b)=>a*b,1);if(end>weights.length)fail();spans.push([o.offset,end]);}spans.sort((a,b)=>a[0]-b[0]);if(spans[0][0]!==0||spans.at(-1)[1]!==weights.length||spans.some((s,i)=>i&&s[0]!==spans[i-1][1]))fail();
 if(!Array.isArray(meta.coords)||meta.coords.length!==1000||!meta.coords.every(p=>Array.isArray(p)&&p.length===3&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=10)))fail();
 if(!Array.isArray(meta.counts)||meta.counts.length!==1000||!meta.counts.every(v=>Number.isSafeInteger(v)&&v>=0))fail();
 if(!Number.isSafeInteger(meta.examples)||meta.examples<0||!Number.isSafeInteger(meta.steps)||meta.steps<0||!Number.isFinite(meta.projectionVariance)||meta.projectionVariance<0||meta.projectionVariance>1||!Array.isArray(meta.loss)||!meta.loss.length||!meta.loss.every(r=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)))fail();
 if(!Array.isArray(meta.examplesPrompt)||!meta.examplesPrompt.length||!meta.examplesPrompt.every(v=>typeof v==='string'&&v.length<=250))fail();
 meta.parameters=weights.length;return meta;
}
export async function readModelFiles(files){if(files.length!==2)throw Error('Vyber současně jeden soubor JSON a jeden soubor BIN.');let json=files.find(f=>f.name.toLowerCase().endsWith('.json')),bin=files.find(f=>f.name.toLowerCase().endsWith('.bin'));if(!json||!bin)throw Error('Vyber současně jeden soubor JSON a jeden soubor BIN.');if(json.size>2*1024*1024||bin.size!==137320*4)throw Error('Nesprávná velikost souborů modelu. JSON může mít nejvýše 2 MB a BIN musí mít 549 280 bajtů.');let meta;try{meta=JSON.parse(await json.text())}catch{throw Error('Soubor JSON nelze přečíst.')}const weights=new Float32Array(await bin.arrayBuffer());validateModel(meta,weights);return {meta,weights,label:json.name.replace(/\.json$/i,'').slice(0,60)};}
