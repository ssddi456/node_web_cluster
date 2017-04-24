var app = require('../app');
var http = require('http');
var net = require('net');
var debug = require('debug')('node_web_cluster:worker');

app.set('port', process.env.PORT);

var connections = [];
function onhandle(self, handle, data) {
  if (self.maxConnections && self.connections >= self.maxConnections) {
    handle.destroy();
    return;
  }

  var socket = new net.Socket({
    handle: handle._handle,
    allowHalfOpen: self.allowHalfOpen
  });

  socket.readable = socket.writable = true;
  socket.resume();
  self.connections++;
  socket.server = self;
  self.emit("connection", socket);
  socket.emit("connect");
  socket.__idx__ = connections.push(socket) - 1;
  socket.on('end',function() {
    connections[socket.__idx__] = null;
  })
}

server = http.createServer(app);


process.on("message", function(m, handle) {
  if ( m.type =='socket' && handle ) {
    onhandle(server, handle, m.buffer);
  }
  if( m.type == 'exit' ){
    server.close(function() {
      debug( 'worker exit ', process.pid );
      setTimeout(function() {
        process.exit(0);
      });
    });
    connections
      .filter(Boolean)
      .forEach(function(c) {
        c.destroy();
      });
  }
  if (m.status == "update") {
    process.send({
      "status": process.memoryUsage()
    });
  }
});
debug('worker start up', process.pid);
process.send({
  'ready_stat' : 4
});