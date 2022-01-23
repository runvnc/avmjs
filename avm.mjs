import algosdk from 'algosdk'

let client
let algod_token, algod_host, algod_port

export const abiConfig = ({algod_token, algod_host, algod_port} =>{
  algod_token = token
  algod_host = host
  algod_port = port
})

const getClient = () => {
  if (!client) client = new algosdk.Algodv2(algod_token, algod_host, algod_port)   	
  
  return client
}

class ABICaller {
	constructor(addr, contractJson) {
    this.addr = addr
    this.contractJson = contractJson
    this.acct = new algosdk.Account(addr)
    this.contract = new algosdk.ABIContract(contractJson)
    this.client = getClient()
	}

  async call(method, args) {
	  const sp = await this.client.getTransactionParams().do()
	  
	  const commonParams = {
	        appID: this.contract.networks["default"].appID,
	        sender: this.acct.addr,
	        suggestedParams:sp,
	        signer: algosdk.makeBasicAccountTransactionSigner(this.acct)
	  }

	  const comp = new algosdk.AtomicTransactionComposer()
	  const method_ = this.contract.methods.find( m => m.name == funcname )
	  
	  comp.addMethodCall({
	      method: method_, methodArgs: args, ...commonParams
	  })

	  const txIDs = await this.submit(client)
	  const txId = txIDs[0]
	  const pending = await client.pendingTransactionInformation(txId).do()
	  
	  return pending  	
  }
}
  
export const makeCaller = (addr, contractJson) => {
  return new ABICaller(addr, contractJson)
}

