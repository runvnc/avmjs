import algosdk from 'algosdk'
import delay from 'delay'
import md5 from 'md5'

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

const toUint8Array = (hexstr) => {
  let b = Buffer.from(hexstr)
  console.log({b})
  //for (let c of hexstr) {
  //  console.log(c)
  //}  
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

	  const comp = new algosdk.AtomicTransactionComposer()
	  const method_ = this.contract.methods.find( m => m.name == method )
	  
	  comp.addMethodCall({
	      method: method_, methodArgs: args, ...commonParams
	  })
    const status = await client.status().do()
    const lastRound = status['last-round']
    let currRound = lastRound+1
	  const txIDs = await comp.submit(client)
	  const txId = txIDs[0]
	  let start = Date.now()
	  let tries = 0
	  let found = false
	  let block
	  let tx
	  await delay(1)
	  while (!found && currRound <= lastRound + 4) {
	    tries = 0
  	  while (tries < 28 && !found) {
    	  try {
    	    tries += 1
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
          if (!found) break
        } catch (e) {
          await delay(200)       
        }
      }
      currRound++
    }
    let elapsed = Date.now() - start
    let logs = tx.dt.lg
    const text = new TextDecoder()
    const lastLog = logs.splice(-1)[0]
    let v = lastLog.slice(4)
    let val = method_.returns.type.decode(Buffer.from(v))
	  return {logs, val}
  }
}
  
export const makeCaller = (addr, contractJson) => {
  return new ABICaller(addr, contractJson)
}

