// let's have a go at using SC runtime stuff in node
var sys = require('sys');
require('./OrionServer');
require('./OrionStore');
require('./OrionSessions');
require('./OrionPolicies');


var myServer = OrionServer.create({
   port: 8080,
   store: OrionStore.create(),
   authModule: OrionFileAuth.create({ fileName: './myUsers'}),
   sessionModule: OrionSession.create({ sessionName: 'OrionServer' }),
   policyModule: OrionPolicies.create({ policyFile: './myPolicies'})
});

myServer.start();

//sys.puts("OrionServer: " + sys.inspect(OrionServer));
// start the repl for debugging
//var repl = require('repl');
//repl.start().scope.myServer = myServer;



