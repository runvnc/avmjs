import algosdk from 'algosdk'
import delay from 'delay'
import md5 from 'md5'
import {exec} from 'child_process'

let client
let algodtoken, algodhost, algodport
import fs from 'fs'

export const abiConfig = ({algod_token, algod_host, algod_port}) => {
  algodtoken = algod_token
  algodhost = algod_host
  algodport = algod_port
}

const getClient = () => {
  if (!client) client = new algosdk.Algodv2(algodtoken, algodhost, algodport)   	
  
  return client
}

class ABICaller {
	constructor(mnemonic, contract) {
	  this.acct = algosdk.mnemonicToSecretKey(mnemonic)
    try {
      JSON.parse(contract)
      this.contractData = contract
    } catch (e) {
      //try {
        this.contractData = fs.readFileSync(contract, 'utf8')        
        this.contractData = JSON.parse(this.contractData)
      //} catch (e) {
        
      //}     
    }

    this.contract = new algosdk.ABIContract(this.contractData)
    this.client = getClient()
	}

  dir() {
    return this.contract.methods.map(m => m.toJSON(m))
    
  }

  async call(method, args) {
	  const sp = await this.client.getTransactionParams().do()
	  const myid = md5(Date.now() + method + args?.join())
	  const commonParams = {
	        appID: this.contract.networks["default"].appID,
	        sender: this.acct.addr,
	        suggestedParams:sp,
	        note: new Uint8Array(Buffer.from(myid)),
	        signer: algosdk.makeBasicAccountTransactionSigner(this.acct)
	  }

	  this.comp = new algosdk.AtomicTransactionComposer()
	  const method_ = this.contract.methods.find( m => m.name == method )
    this.lastData = {
    	   method: method_, methodArgs: args, ...commonParams
    }
	  this.comp.addMethodCall(this.lastData)
    const status = await client.status().do()
    const lastRound = status['last-round']
    let sinceLast = status['time-since-last-round']
    sinceLast = Math.round(sinceLast/1000000)
    let currRound = lastRound+2
    let timeLeftInRound = 4400 - sinceLast
	  const txIDs = await this.comp.submit(client)
	  const txId = txIDs[0]
	  let tries = 0
	  let found = false
	  let block
	  let tx
	  let start = Date.now()
	  await delay(sinceLast)
    
	  while (!found && currRound <= lastRound + 4) {
	    tries = 0
  	  while (tries < 28 && !found) {
    	  try {
    	    tries += 1
    	    process.stdout.write('.')
          block = await client.block(currRound).do()
          const decoder = new TextDecoder()
          found = false
          for (let tx_ of block.block.txns) {
            let note = decoder.decode(tx_.txn.note)
            if (note == myid) {
              found = true
              tx = tx_
            }
          }
          if (!found) {
            await delay(4400);
            break
          }
        } catch (e) {
          await delay(300) 
        }
      }
      currRound++
    }
    let elapsed = Date.now() - start
    process.stdout.write(` ${elapsed} ms.`)
    let logs = tx.dt.lg
    const text = new TextDecoder()
    const lastLog = logs.splice(-1)[0]
    
    let v = lastLog.slice(4)
    let val = method_.returns.type.decode(Buffer.from(v))
    let val2 = []
    let childType = method_.returns.type?.childType
    if (childType) {
      for (let v2 of val)
        val2.push(childType.decode(Buffer.from(v2)))
      return {logs, val: val2}
    } else {
	    return {logs, val}
	  }
  }

  async debugLast() {
	  this.comp = new algosdk.AtomicTransactionComposer()
    
	  this.comp.addMethodCall(this.lastData)
    let sigs = await this.comp.gatherSignatures()
    console.log({sigs})
    let sigs2 = sigs.map( s => algosdk.decodeSignedTransaction(s) )
    console.log({sigs2})
    const req = await algosdk.createDryrun({client: this.client, txns: sigs2})
    console.log({req})
    
    //const json = req._get_object_for_encoding()
    //const str = JSON.stringify(json)
    //let {stdout, stderr} = await exec(`goal clerk dryrun-remote -D '${str}'`)
    //console.log(stdour)
    let ret = await this.client.dryrun(req).do()

    return ret
  }
  
}
  
export const makeCaller = (addr, contractJson) => {
  return new ABICaller(addr, contractJson)
}

