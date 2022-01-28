#!/bin/env node
import {abiConfig, makeCaller} from './avm.mjs'
import ora from 'ora'
import repl from 'repl'
import vm from 'vm'
import { processTopLevelAwait } from 'node-repl-await'
import colors from 'colors'
import fg from 'fast-glob'
import waitkey from './waitkey.mjs'

//import terminal from 'terminal-kit'
//const term = terminal.terminal

import Table from 'cli-table3'

const algod_token = '8854a3be0df4c5495a9e8f62ff7b0b74dc3fe197351bff3d66c4996201a912d0'
const algod_host = 'https://node.algonfts.art'
const algod_port = ''
const mnemonic = 'defy walk load seven paddle clap future normal stuff body glide year blouse south spray range man crawl concert wine comic shrimp boat ability stuff'

let r

let service


function completer(line) {
  let completions
  
  if (line.includes('/contract ')) {
    let toks = line.split(' ')
    let fname = toks.length>1? toks[1] : ''
    let files = fg.sync(`${toks[1]}*.json`)    
    completions = files.map( f => `/contract ${f}` )
  } else {
    completions = service.contract.methods.map(m => m.name)
    completions.push('/menu')
    completions.push('/debug')
    completions.push('/contract')
  }
  const hits = completions.filter((c) => c.startsWith(line));
  // Show all completions if none found
  return [hits.length ? hits : completions, line]
}

const input = async (str, args) => {
  process.stdout.write('Executing ABI call...')
  try {
    let {logs, val} = await service.call(str, args) 
    console.log()
    for (let l of logs) console.log(l)    
    
    return val
  } catch (e) {
    if (e.message.includes('logic eval error')) {
    
      debug().catch(console.error)
     
    }

    console.error(e.message)
  } finally {
  }    
}

async function doEval(cmd, context, filename, callback) {
  let result
  try {
    const funcnames = service.contract.methods.map( m => m.name )    
    const tokens = cmd.split(' ').map(s => s.trim())
    let args = tokens.slice(1).map(s => s.trim())
    args = args.filter(a => a != undefined && a.length > 0)
    if (funcnames.includes(tokens[0])) {
      let rr = await input(tokens[0], tokens.slice(1))
      callback(null, rr)
    } else {
      if (cmd[0] == '/') {
        cmd = cmd.substr(1)
        let toks = cmd.split(' ')
        toks = toks.map( t => t.replace("\n",'') )
        let fn = toks[0]
        let prms = toks.slice(1).join(',')
        if (fn == 'contract') prms = `'${toks[1]}'`
        cmd = `${fn}(${prms})`
      }
      cmd = processTopLevelAwait(cmd) || cmd
      result = await vm.runInThisContext(cmd, context)      
      callback(null, result)
    }
  } catch (e) {
    console.error(e)
    return callback(null, e)
    //callback(null, 1)
    //if (isRecoverableError(e)) {
    //  return callback(new repl.Recoverable(e))
    
  }
  //callback(null, result);
}

function isRecoverableError(error) {
  if (error.name === 'SyntaxError') {
    return /^(Unexpected end of input|Unexpected token)/.test(error.message);
  }
  return false;
}

const menu = (c = null) => {  
  if (!c) c = service.contract
  let table1 = new Table({head:[`  == ${(service.contract.name)} ==  `.cyan]})
  print(table1.toString())
  //table.push([{colspan:3, content: service.contract.name}])
  //console.log(`= ${service.contract.name} =`)
  let table = new Table({head:['Method'.cyan, 'Arguments'.cyan, 'Return'.cyan]})
  for (let m of c.methods) {
    let argdesc = m.args.map(a => `<${a.name}: ${a.type.toString()}>`).join(' ')
    table.push([m.name, argdesc, m.returns.type.toString()])
  }
  print(table.toString())
}

const print = console.log
const printerr = console.error

const prslot = (isStack, n, typ, byts, uint, outp) => {
  let hasBytes = byts && byts.length > 0
  let show = isStack || hasBytes || uint > 0
  if (!show) return outp
  outp += (n+'').brightWhite + '  '
  if (hasBytes) {
    if (byts && byts.length > 0) {
      let ss = Buffer.from(byts, 'base64').toString('ascii')      
      ss = ss.replace(/./g, function(c){return c.charCodeAt(0)<128?c:"\\x"+c.charCodeAt(0).toString(16)})      
      ss = JSON.stringify(ss)
      outp += ss.substr(0, 50).green + '\n'
    }
  } else {
    if (!isStack && uint == 0) return outp
    outp += uint.toFixed(0).yellow + '\n'
  }
  return outp
}

const showFrame = (t, asm) => {
  let outp = ''
  let table = new Table({style:{head:[],border:[]}, colWidths: [60, 42]});
  let h = '    '
  if (t.error) h = t.error.red
  let stline = Math.max(0, t.line - 11)
  let enline = Math.min(t.line + 11, asm.length-1)
  let code = ''
  let ll = 0
  let sl = asm.slice(stline, enline+1)
  for (let l of sl) {
    let front = '    '
    if (ll+stline == t.line) front = ' => '
    code += front + sl[ll].substr(0,37) + '\n'
    ll++
  }

  let stack = 'STACK\n'.brightMagenta
  let ii = 0

  for (let st of t.stack) {
    stack = prslot(true,ii++,st.type, st.bytes, st.uint, stack)        
  }
  let scratch = 'SCRATCH\n'.brightRed
  ii = 0
  if (t.scratch) {
    for (let sc of t.scratch) {
      scratch = prslot(false, ii++, sc.type, sc.bytes, sc.uint, scratch)  
    }
  }
  table.push(
    [{colSpan:2,content:h}],
    [stack, {rowSpan: 2, content: code}],
    [scratch]
  )

  return table.toString()  
}

const debug = async () => {
  let dbg = await service.debugLast()
  if (dbg.error) { 
    printerr(dbg.error)
  }
  let appcall
  for (let tx of dbg.txns) {
    if (tx['app-call-trace']) appcall = tx

    if (appcall) {
       let trace = tx['app-call-trace']
      let f = trace.length-1
      
      let cont = true
      console.clear()
      while (cont) {
        let t = trace[f]
        let outp = showFrame(t, tx.disassembly)
        print("\x1B[1;1H")
        print(outp)
        let [ch, keycd] = await waitkey()
        let keyname = keycd.name
        if (keyname == 'left' && f > 0) f--
        else if (keyname == 'right' && f< trace.length-1) f++
        else if (keyname == 'escape') cont = false
        else print(keyname)
      }
    }  
  }
}

const contract = async (fname) => {
  service = makeCaller(mnemonic, fname)
  menu()  
}

const setup = async () => {
  abiConfig({algod_token, algod_host, algod_port})
  
  service = makeCaller(mnemonic, 'contract.json')
  global.menu = menu
  global.debug = debug
  global.contract = contract
  menu()
  console.log(service.acct.addr)
  r = repl.start({ prompt: '> ', eval: doEval, completer })  
}

setup().catch(console.error)
