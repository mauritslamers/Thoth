var sys = require('sys');
require('./lib/OrionServer');

/*
   You can set up a few items here to have ONR do for you.
   You need at least a store.
   Be aware that OrionStore is a default store and shouldn't be used as the DB calls are not implemented.
   Create a custom store by implementing the DB calls, or choose a bundled store, like OrionRiakStore or OrionDBStore.

   The same goes for the authModule.

   If you add the policyModule, you need to set up the policies first according to the policy samples
   
*/


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
//repl.start().context.myServer = myServer;



