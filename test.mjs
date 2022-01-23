import {abiConfig, makeCaller} from './avm.mjs'
import ora from 'ora'

const algod_token = '8854a3be0df4c5495a9e8f62ff7b0b74dc3fe197351bff3d66c4996201a912d0'
const algod_host = 'https://node.algonfts.art'
const algod_port = ''
const mnemonic = 'defy walk load seven paddle clap future normal stuff body glide year blouse south spray range man crawl concert wine comic shrimp boat ability stuff'

const test = async () => {

  // get a list of transactions

  // use the abi

  // sign transactions

  // send a transaction to an app

  abiConfig({algod_token, algod_host, algod_port})
  
  const service = makeCaller(mnemonic, 'contract.json')
  
  //console.log(service.dir())
  //console.log(service.acct.addr)

  const spinner = ora('Executing ABI call..').start()
  let res = await service.call('setup',[])
  spinner.stop()
  console.log(JSON.stringify(res))
  console.log('log',res.dt.lg)
  delete res.dt['lg']
  console.log('dt',res.dt)
}

test().catch(console.error)
