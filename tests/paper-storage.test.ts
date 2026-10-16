import {it,expect} from 'vitest';
import {validateAccount} from '../src/lib/paper-storage';
import {createAccount} from '../src/lib/paper';
it('rejects corrupted or mixed-dataset balances instead of silently resetting money',()=>{
 const a=createAccount('d','JPY',20);
 expect(validateAccount(a,'d')).toEqual(a);
 expect(()=>validateAccount({...a,cash:-1},'d')).toThrow();
 expect(()=>validateAccount(a,'other')).toThrow();
 expect(()=>validateAccount({...a,basis:100},'d')).toThrow();
});
it('rejects invalid journal records before any ledger render',()=>{
 const a=createAccount('d','JPY',20);
 expect(()=>validateAccount({...a,journal:[null]},'d')).toThrow();
 expect(()=>validateAccount({...a,journal:[{id:'x',time:1,action:'BUY',reason:'test',qty:1,price:100,pnl:NaN,guard:'ok'}]},'d')).toThrow();
});
