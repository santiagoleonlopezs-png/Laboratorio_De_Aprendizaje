'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../mesa-acuerdos-data.js'),E=require('../mesa-acuerdos-engine.js'),X=require('../mesa-salas-engine.js');
const html=fs.readFileSync(require.resolve('../mesa-acuerdos.html'),'utf8');
function page(savedSession=true){
 const elements=new Map(),calls=[];let account=savedSession?{uid:'host',email:'facilitador@example.test'}:null;
 const $=id=>{if(!elements.has(id)){const tag=html.match(new RegExp('<[^>]+\\bid="'+id+'"[^>]*>'))?.[0]||'';elements.set(id,{id,hidden:/\bhidden\b/.test(tag),value:'',textContent:'',isConnected:true,disabled:false,classList:{add(){},remove(){},toggle(){}},focus(){},addEventListener(){}});}return elements.get(id);};
 const F={hostSession:async()=>!!account,hostLogin:async(email,password)=>{calls.push({email,password});if(password==='incorrecta')throw Error('Credenciales incorrectas.');account={uid:'host',email};return account;},logout:async()=>{account=null;},user:()=>account,error:e=>e.message};
 const context={window:{MESA_DATA:D,MESA_ENGINE:E,MESA_SALAS_ENGINE:X,MESA_FIREBASE:F,MESA_SALAS:{},scrollTo(){}},document:{getElementById:$,body:{insertAdjacentHTML(){}},documentElement:{style:{setProperty(){}}}},location:{search:''},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},URLSearchParams,URL,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,console:{error(){}}};
 vm.createContext(context);for(const name of ['mesa-acuerdos.js','mesa-salas.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),context);
 return {$,calls,click:id=>$(id).onclick(),login:async(password='clave-de-prueba')=>{$('hostEmail').value='  facilitador@example.test  ';$('hostPassword').value=password;$('loginForm').onsubmit({preventDefault(){},submitter:$('loginButton')});await new Promise(setImmediate);}};
}
test('el ingreso del facilitador exige formulario tanto sin sesión como con una sesión guardada',()=>{
 for(const saved of [false,true]){const p=page(saved);p.$('hostPassword').value='valor-anterior';p.click('hostAccess');assert.equal(p.$('setupView').hidden,false);assert.equal(p.$('loginForm').hidden,false);assert.equal(p.$('hostSetup').hidden,true);assert.equal(p.$('sessionView').hidden,true);assert.equal(p.$('hostPassword').value,'');}
});
test('validar credenciales abre la preparación de salas y muestra la cuenta; reingresar vuelve al acceso',async()=>{
 const p=page(true);p.click('hostAccess');await p.login();assert.equal(p.$('hostSetup').hidden,false);assert.equal(p.$('loginForm').hidden,true);assert.equal(p.$('hostAccount').textContent,'facilitador@example.test');assert.equal(p.$('hostPassword').value,'');assert.equal(p.calls[0].email,'facilitador@example.test');
 p.click('hostAccess');assert.equal(p.$('hostSetup').hidden,true);assert.equal(p.$('loginForm').hidden,false);
});
test('una contraseña incorrecta no abre el tablero y cerrar sesión devuelve al ingreso',async()=>{
 const p=page(true);p.click('hostAccess');await p.login('incorrecta');assert.equal(p.$('hostSetup').hidden,true);assert.equal(p.$('loginForm').hidden,false);assert.match(p.$('setupMessage').textContent,/Credenciales incorrectas/);
 await p.login();await p.click('hostSignOut');assert.equal(p.$('hostSetup').hidden,true);assert.equal(p.$('hostAccount').textContent,'');assert.equal(p.$('loginForm').hidden,false);
});
test('el acceso Firebase requiere el permiso booleano de facilitador y verifica el token actualizado',async()=>{
 for(const permission of [true,false,'true',undefined]){
  let refresh=null;const user={uid:'host',getIdTokenResult:async force=>{refresh=force;return {claims:{facilitator:permission}};}},auth={currentUser:null,signInWithEmailAndPassword:async()=>{auth.currentUser=user;}};
  const firebase={apps:[{}],app:()=>({}),auth:()=>auth,firestore:()=>({})},w={firebase,FIREBASE_CONFIG:{projectId:'test'}};
  new Function('window','firebase',fs.readFileSync(require.resolve('../mesa-acuerdos-firebase.js'),'utf8'))(w,firebase);
  const login=w.MESA_FIREBASE.hostLogin('facilitador@example.test','clave-de-prueba');if(permission===true)assert.equal(await login,user);else await assert.rejects(login,/rol de facilitador/);assert.equal(refresh,true);
 }
});
