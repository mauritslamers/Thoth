/*

Trying to re-implement a mysql store based on the node-mysql client
by felixge

*/

var NodeMySQlClient = require('./node-mysql/lib/mysql').Client;
var sys = require('sys');
var Store = require('./Store').Store;

exports.MySQLStoreNodeMySQL = Store.extend({
   
   hostname: null,
   
   user: null,
   
   password: null,
   
   database: null,
   
   _tableInfo: null,
   
   createDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the new record
      
   },
   
   updateDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the updated record
      
   },
   
   deleteDBRecord: function(storeRequest,clientId,callback){
      // check for callbacks.. Often it is not included!
      
   },
   
   fetchDBRecords: function(storeRequest,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      if(this._hasConnection){
         
      }
      else callback(null);
   },
   
   refreshDBRecord: function(storeRequest,clientId,callback){
      // the callback expects a record
      
   },
   
   /*
     Function to create a cache of all tables and fields these tables consist of.
     This cache will be used to match requests in such a way that retrieval or update of information
     is only possible to existing tables and fields.
     The function consists of an inner function which will iterate over all the tables found
   */
   
   createTableCache: function(){
     var me = this;
     this._tableCache = {};
     var row = "Tables_in_" + this.database;
     // define field retrieval function, which also sets the actual cache
     var createFieldCache = function(tablename){
       var query = "SHOW COLUMNS from " + tablename;
       me.performQuery(query,function(err,result,fields){
         if(!err){
           me._tableCache[tablename] = {};
           result.forEach(function(field){
             me._tableCache[tablename][field.Field] = field;  //fieldname in Field
           });
         }
       });
     };
     
     // start getting the info by getting the table information
     this.performQuery("SHOW TABLES", function(err,result,fields){
       if(!err){
         result.forEach(function(obj){
           createFieldCache(obj[row]);
         });
       }
     });
   },
   
   performQuery: function(query,callback){
     if(query && callback){ 
       var client = this.createClient();
       client.query(query,function(err,results,fields){
         //sys.log('results: ' + sys.inspect(results));
         //sys.log('fields: ' + sys.inspect(fields));
         callback(err,results,fields);
         client.end(); // clean up
       });
     }
   },
   
   createClient: function(){
     var client = new NodeMySQlClient();
     if(client && this.user && this.password && this.hostname && this.database){
       client.user = this.user;
       client.password = this.password;
       client.host = this.hostname;
       client.database = this.database;
       //add onerror
       client.on('error',this.mySQLError);
       // try connect
       client.connect();
       
       return client;
     }
     else throw("Missing connection data!");
   },
   
   // this function provides a hook for starting certain things when the server starts
   // which cannot be done using the init function (constructor)
   start: function(){
      this.createTableCache();
   },
   
   mySQLError: function(error){
      // function to be called for every error
      sys.log('Thoth MySQLStoreNodeMySQL: Error with the client: ' + error);
      //process.exit("Error connecting...");
   }
   

   
});