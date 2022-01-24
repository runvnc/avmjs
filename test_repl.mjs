import {abiConfig, makeCaller} from './avm.mjs'
import ora from 'ora'
import repl from 'repl'
import vm from 'vm'
import { processTopLevelAwait } from 'node-repl-await'
//import terminal from 'terminal-kit'
//const term = terminal.terminal

const algod_token = '8854a3be0df4c5495a9e8f62ff7b0b74dc3fe197351bff3d66c4996201a912d0'
const algod_host = 'https://node.algonfts.art'
const algod_port = ''
const mnemonic = 'defy walk load seven paddle clap future normal stuff body glide year blouse south spray range man crawl concert wine comic shrimp boat ability stuff'

let r

let service

const input = async (str, args) => {
  process.stdout.write('Executing ABI call...')
  try {
    let {logs, val} = await service.call(str, args) 
    console.log()
    //spinner.destroy()
    for (let l of logs) console.log(l)    
    //console.log(`[ ${val} ]`)
    
    return null
  } catch (e) {
    console.error(e)
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
      await input(tokens[0], tokens.slice(1))
      /*
      global.input = input    
      let cmd_ = `await input('${tokens[0]}', ${JSON.stringify(tokens.slice(1))})`
      cmd_ = processTopLevelAwait(cmd_) || cmd_
      result = await vm.runInThisContext(cmd_, context) */
      callback(null, 1)
    } else {
      if (cmd[0] == '/') {
        cmd = cmd.substr(1)
        let toks = cmd.split(' ')
        let fn = toks[0]
        let prms = toks.slice(1).join(',')
        cmd = `${fn}(${prms})`
      }
      cmd = processTopLevelAwait(cmd) || cmd
      result = await vm.runInThisContext(cmd, context)      
      callback(null, result)
    }
  } catch (e) {
    console.error(e)

    return callback(null, 1)
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
  console.log(`= ${service.contract.name} =`)
  for (let m of c.methods) {
    let argdesc = m.args.map(a => `<${a.name}: ${a.type.toString()}>`).join(' ')

    console.log(m.name, argdesc, `-> ${m.returns.type.toString()}`)
  }
}

const setup = async () => {
  abiConfig({algod_token, algod_host, algod_port})
  
  service = makeCaller(mnemonic, 'contract.json')
  global.menu = menu
  menu()
  console.log(service.acct.addr)
  r = repl.start({ prompt: '> ', eval: doEval })
  
}

setup().catch(console.error)
