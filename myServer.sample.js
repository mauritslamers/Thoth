var sys = require('sys');
require('./lib/Server');

/*
   You can set up a few items here to have ONR do for you.
   You need at least a store.
   Be aware that ThothStore is a default store and shouldn't be used as the DB calls are not implemented.
   Create a custom store by implementing the DB calls, or choose a bundled store, like ThothRiakStore or ThothDBStore.

   The same goes for the authModule.

   If you add the policyModule, you need to set up the policies first according to the policy samples
   
*/


var myServer = ThothServer.create({
   port: 8080,
   store: ThothStore.create(), 
   authModule: ThothFileAuth.create({ fileName: './myUsers'}),
   sessionModule: ThothSession.create({ sessionName: 'ThothServer' }),
   policyModule: ThothPolicies.create({ policyFile: './myPolicies'})
});

myServer.start();

//sys.puts("ThothServer: " + sys.inspect(ThothServer));
// start the repl for debugging
//var repl = require('repl');
//repl.start().context.myServer = myServer;



