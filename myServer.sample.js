// let's have a go at using SC runtime stuff in node
var sys = require('sys');
require('./OrionServer');
require('./OrionStore');
//sys.puts("SC object: " + sys.inspect(SC.Object));
//sys.puts("OrionServer: " + sys.inspect(OrionServer));
// start the repl for debugging



var myModel = require('./myModel').myModel;

var myServer = OrionServer.create({
   models: [myModel],
   store: OrionStore.create(),
   authModule: OrionFileAuth.create({ fileName: 'myUsers'})
});

myServer.start();

//var repl = require('repl');
//repl.start().scope.myServer = myServer;



