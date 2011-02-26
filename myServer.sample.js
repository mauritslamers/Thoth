
var sys = require('sys');
var Thoth = require('./lib/Thoth').Thoth;

/*
   You need to assemble a Thoth server here. You need at least a store.
   Be aware that Store is a default store and shouldn't be used as the DB calls are not implemented.
   Create a custom store by implementing the DB calls, or choose a bundled store, like RiakStore,
   MySQLStore_mysqlClient or DBStore.

   The same goes for the authModule.

   If you add the policyModule, you need to set up the policies first according to the policy samples
   
*/

// require the store you need here:
//var Store = require('./lib/RiakStore').RiakStore;
//var Store = require('./lib/MySQLStore_mysqlClient').MySQLStoreMySQLClient;
//var Store = require('./lib/MySQLStore_node-mysql').MySQLStoreNodeMySQL;

var myServer = Thoth.Server.create({
   port: 8080,
   //store: Thoth.Store.create(), // don't use directly!
   //store: RiakStore.create(),
   //store: Store.create({hostname:'', user:'', password: '', database: ''}),
   authModule: Thoth.FileAuth.create({ fileName: './myUsers'}),
   sessionModule: Thoth.Session.create({ sessionName: 'ThothServer' }),
   policyModule: Thoth.Policies.create({ policyFile: './myPolicies'})
});

myServer.start();




