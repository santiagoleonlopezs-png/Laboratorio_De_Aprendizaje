const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../nexus-player.js'),'utf8');
const body=source.slice(source.indexOf('function effects(){'),source.indexOf('async function execute(){'));
const run=new Function('state','selected','practices','selectedCost','$','document','vars',body+'return effects();');
const vars=['Conciencia','Confianza','Energía','Compromiso','Conocimiento','Capacidad','Apropiación'];
function simulate(names,{round=1,target='Capacidad',energy=70}={}){
 const metrics={Conciencia:60,Confianza:60,Energía:energy,Compromiso:50,Conocimiento:60,Capacidad:45,Apropiación:40};
 const attention={Conciencia:0,Confianza:40,Energía:20,Compromiso:0,Conocimiento:0,Capacidad:40,Apropiación:0};
 return run({round,metrics},names.map((_,i)=>i),names.map(n=>[n]),()=>names.length*30,()=>({value:target}),{querySelectorAll:()=>Object.entries(attention).map(([k,v])=>({dataset:{diag:k},value:v}))},vars);
}
test('Empatar la máxima atención en dos dimensiones no produce una falsa incoherencia',()=>{
 const e=simulate(['Lean Change']);assert.ok(!e.__consequence.warnings.some(w=>w.includes('no coincide')));
});
test('La tercera intervención consume energía aunque las tres sean pertinentes',()=>{
 const two=simulate(['Lean Change','Co-creación']),three=simulate(['Lean Change','Co-creación','Aprendizaje experiencial']);
 assert.ok(three.Energía<two.Energía);assert.ok(three.__consequence.warnings.some(w=>w.includes('sobreintervención')));
});
test('El mismo contexto y la misma decisión producen el mismo resultado',()=>assert.deepEqual(simulate(['ADKAR']),simulate(['ADKAR'])));
test('Las cinco rondas producen efectos numéricos y clasifican las acciones',()=>{
 for(let round=0;round<5;round++){
 const e=simulate(['ADKAR','Lean Change','Reconocimiento'],{round});
 for(const v of vars)assert.ok(Number.isFinite(e[v]));
 const c=e.__consequence;assert.equal(c.high.length+c.medium.length+c.low.length+c.irrelevant.length+c.counterproductive.length,3);
 }
});
