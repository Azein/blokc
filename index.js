const program = require('commander')
const udp = require('udp-request')

program
  .version('0.0.0')
  .option('-p, --port, <n>', 'Port', parseInt)
  .parse(process.argv)

const port = program.port || 3000
const isRoot = !program.port
const socketListener = udp()
const addExpires = 1000 * 60 * 5

const memberList = {}

const checkExpires = () => {
  const now = Date.now()
  for (const port in memberList) {
    if (memberList[port] < now) {
      delete memberList[port]
    }
  }
}

setInterval(checkExpires, 1000)

const addMember = (port) => {
  memberList[port] = Date.now() + addExpires
}

const bufferFormat = (json) => new Buffer(JSON.stringify(json))

let receivedMemberList = {}

socketListener.on('request', (request, peer) => {
  console.log('root request', request, peer)
  const jsonRequest = JSON.parse(request.toString())
  console.log('jsonRequest', jsonRequest)
  const { cmd, port, ports } = jsonRequest
  if (isRoot) {
    switch (cmd) {
      case 'ADD': {
        addMember(port)
        break
      }
      case 'FETCH': {
        socketListener.response(
          bufferFormat({ cmd: 'LIST', ports: memberList }),
          peer,
        )
      }
    }
  } else {
    switch (cmd) {
      case 'LIST': {
        receivedMemberList = ports
        console.log('received member list', receivedMemberList)
        break
      }
    }
  }
})

socketListener.listen(port)

const rootPort = 3000

if (!isRoot) {
  const rootPeer = {
    port: rootPort,
    host: 'localhost',
  }
  const rootConnection = udp()
  setInterval(() => {
    rootConnection.request(
      bufferFormat({ cmd: 'ADD', port }),
      rootPeer,
      (error, response, peer) => {
        console.log('root request add', response && response.toString())
      },
    )
    rootConnection.request(bufferFormat({ cmd: 'FETCH' }), rootPeer, (e, r) => {
      const jsonResponse = JSON.parse(r.toString())
      if (jsonResponse.cmd === 'LIST') {
        receivedMemberList = jsonResponse.ports
      }
    })
  }, 1000 * 60 * 4)
  setInterval(() => {
    console.log('received member list', receivedMemberList)
  }, 1000 * 5)
}
