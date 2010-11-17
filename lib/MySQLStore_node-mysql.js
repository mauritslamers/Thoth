/*

Trying to re-implement a mysql store based on the node-mysql client
by felixge, because the mysqlclient one tends to crash without error...

*/

var Client = require('./node-mysql/lib/mysql').Client;

var sys = require('sys');
global.ThothMySQLStoreNodeMySQL = ThothStore.extend({
   
   client: new Client(),
   
   hostname: null,
   
   user: null,
   
   password: null,
   
   database: null,
   
   _connection: null,
   
   _hasConnection: null,
   
   _tableInfo: null,
   
   createInsertQuery: function(storeRequest){
      // create an SQL insert function
      var bucket = storeRequest.bucket, record = storeRequest.recordData;
      if(bucket && record && this._connection && this._tableInfo){
         var fieldInfo = this.recordFieldsInRequest(storeRequest);
         if(fieldInfo){
            var ret = "INSERT INTO " + bucket + " (";
            ret += fieldInfo.fieldNames.join(",");
            ret += ") VALUES (";
            ret += fieldInfo.fieldValues.join(",");
            ret += ")";
            ret = this.escapeField(ret);
            return ret;            
         }
         else return NO;
      }
      else return NO;
   },
   
   createUpdateQuery: function(storeRequest){
      // create the query from the record data
      var bucket = storeRequest.bucket, record = storeRequest.recordData;
      var id = record[this.primaryKey];
      var fieldInfo = this.recordFieldsInRequest(storeRequest);
      if(fieldInfo && id){ // we NEED the id ...
         var fieldNames = fieldInfo.fieldNames,
             fieldValues = fieldInfo.fieldValues;
         
         var sets = [];
         for(var i=0,len=fieldNames.length;i<len;i++){
            sets.push(fieldNames[i] + "=\"" + fieldValues[i] + "\"");
         }
         var ret = "UPDATE " + bucket + " set " + sets.join(",");
         ret += " WHERE " + this.primaryKey + "=\"" + id + "\"";
         return ret;
      }
      else sys.log("ThothMySQLStore: trying to create an update query without a primaryKey field");

      return NO;
   },
   
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
   
   
   performQuery: function(query,callback){
      if(query){
         var me = this;
         this.client.query(query,function(err,results,fields){
            sys.log('results: ' + sys.inspect(results));
            sys.log('fields: ' + sys.inspect(fields));
         });
         /*var q  = this.client.query(query);
         q.on('field', function(field){
            sys.log('field: ' + sys.inspect(field));
         });
         q.on('row', function(result){
            sys.log('row: ' + sys.inspect(result));
         }); */
      }
   },
   
   // this function provides a hook for starting certain things when the server starts
   // which cannot be done using the init function (constructor)
   start: function(){
      var user = this.user,
          password = this.password,
          host = this.hostname,
          database = this.database;
      
      if(user && password && host && database){
         this.client.user = user;
         this.client.password = password;
         this.client.host = host;
         this.client.database = database;
         this.client.connect();
         this._hasConnection = YES;
         this.client.on('error', this.mySQLError);
         // set up the tablecache 
         //this.performQuery("SHOW TABLES");
         this.performQuery('show columns from student');
         return;
      }
      else {
         process.exit("Error while connecting to MySQL because of missing connection data");   
      }
      
   },
   
   mySQLError: function(error){
      // function to be called for every error
      sys.log('ThothMySQLStoreNodeMySQL: Error with the client: ' + error);
   }
   

   
});