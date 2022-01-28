import readline from 'readline'

let watch = false

let resolver

process.stdin.on('keypress', (str, key) => {
  if (resolver) {
    process.stdin.setRawMode(false)
    resolver([str, key])
  }
})

export default async function waitkey() {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  return new Promise( (rs, rj) => {
    resolver = rs
  })
}
  
