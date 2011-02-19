/*

Trying to re-implement a mysql store based on the node-mysql client
by felixge

*/

var NodeMySQLClient = require('./node-mysql/lib/mysql').Client,
    API = require('./core/API'),
    Constants = require('./core/Constants'),
    Tools = require('./core/Tools'),
    sys = require('sys'),
    Store = require('./core/Store').Store,
    JunctionMixin = require('./core/mixins/junctionrelations').RelationsByJunctionTable;

exports.MySQLStoreNodeMySQL = Store.extend(JunctionMixin,{
   
   hostname: null,
   
   user: null,
   
   password: null,
   
   database: null,
   
   _tableInfo: null,
   
   log: function(msg){
     sys.log('Thoth NodeMySQLStore: ' + msg);
   },
   
   createDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the new record
      var bucket = storeRequest.bucket,
          primKey = API.getPrimaryKey(storeRequest),
          key = storeRequest.key,
          record = storeRequest.recordData,
          me = this, query, params, tabledata, field, insertfields, valuefields;
          
      
      tabledata = this._tableCache[bucket];
      if(tabledata){
        insertfields = [];
        valuefields = [];
        params = [];
        for(field in tabledata){
          if(tabledata.hasOwnProperty(field) && (record[field] !== undefined)){
            insertfields.push(field);
            valuefields.push("?");
            params.push(record[field]);
          }
        }
        query = "INSERT INTO " + bucket;
        query += "(" + insertfields.join(",") + ")";
        query += " VALUES(" + valuefields.join(",") + ")";
        this.performQuery(query,params,function(err,result,fields){
          if(!err){
            record[primKey] = result.insertId;
            if(callback) callback(me.filterfields(record));
          }
          else {
            me.log('error while creating a record with query: ' + query + ' Error: ' + err);
            if(callback) callback(null);
          }
        });
      }
      else {
        me.log('trying to create a record in a table that doesn\'t exist');
        if(callback) callback(null);
      }
   },
   
   updateDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the updated record
      var bucket = storeRequest.bucket,
          primKey = API.getPrimaryKey(storeRequest),
          key = storeRequest.key,
          record = storeRequest.recordData,
          me = this,
          query,params,tabledata,field,setfields;
      
      tabledata = this._tableCache[bucket];
      if(tabledata){
        setfields = [];
        params = [];
        for(field in tabledata){
          if(tabledata.hasOwnProperty(field) && (record[field] !== undefined)){
            setfields.push([field,"= ?"].join("")); // push set fieldname = ? to setfields array
            params.push(record[field]); // push value on params
          }
        }
        // assemble query:
        query = "UPDATE " + bucket + " SET " + setfields.join(",") + " WHERE ? = ?";
        params.push(primKey);
        params.push(key);
        
        this.performQuery(query,params,function(err,result,fields){
          if(!err){
            if(callback) callback(me.filterRecord(record));
          }
          else {
            me.log('error with query: ' + query + ' Error: ' + err);
          }
        });
      }
      else if(callback) callback(null);
   },
   
   deleteDBRecord: function(storeRequest,clientId,callback){
      // check for callbacks.. Often it is not included!
      var bucket = storeRequest.bucket,
          primKey = API.getPrimaryKey(storeRequest),
          key = storeRequest.key,
          me = this;
          query;
          
      if(this._tableCache[bucket]){
        query = "DELETE FROM " + bucket + " WHERE ? = ?";
        this.performQuery(query,[primKey,key],function(err,result,fields){
          if(!err){
            if(callback) callback(YES);
          }
          else {
            me.log('error while trying to delete record: ' + err);
            if(callback) callback(null);
          }
        });
      }
      else {
        this.log('trying to delete a record from a table that doesn\'t exist.');
        if(callback) callback(null);
      }
   },
   
   fetchDBRecords: function(storeRequest,clientId,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      var bucket = storeRequest.bucket, me = this;
      if(this._tableCache[bucket]){ // make sure no malformed bucket can be used here...
        var query = "SELECT * FROM " + bucket;
        this.performQuery(query,function(err,result,fields){
          if(callback){
            if(!err && result) callback(me.filterRecords(result));
            else me.log('error in fetch: ' + err);            
          }
          else me.log('no callback in fetch??');
        });
      }
      else {
        callback(null);
      }
   },
   
   refreshDBRecord: function(storeRequest,clientId,callback){
      // the callback expects a record
      var bucket = storeRequest.bucket,
          primKey = API.getPrimaryKey(storeRequest),
          key = storeRequest.key,
          me = this;
      
      if(this._tableCache[bucket]){
        var query = "SELECT * FROM " + bucket + " WHERE " + primKey + " = ?";
        this.performQuery(query,[key],function(err,result,fields){
          if(!err && result) callback(result);
          else me.log('error in refresh: ' + err);
        });
      }
      else callback(null);
   },
   
   /*
     Function to create a cache of all tables and fields these tables consist of.
     This cache will be used to match requests in such a way that retrieval or update of information
     is only possible to existing tables and fields.
     The function consists of an inner function which will iterate over all the tables found
   */
   
   createTableCache: function(){
     sys.log('Thoth NodeMySQLStore: caching tables in database');
     var me = this;
     this._tableCache = {};
     var row = "Tables_in_" + this.database;
     // define field retrieval function, which also sets the actual cache
     var createFieldCache = function(tablename){
       var query = "SHOW COLUMNS from " + tablename;
       me.performQuery(query,function(err,result,fields){
         if(!err){
           sys.log('Reading fields from table ' + tablename);
           me._tableCache[tablename] = {};
           result.forEach(function(field){
             me._tableCache[tablename][field.Field] = field;  //fieldname in Field
           });
         }
         else me.log('Error while reading columns from table ' + tablename + ' Error: ' + err);
       });
     };
     
     // start getting the info by getting the table information
     this.performQuery("SHOW TABLES", function(err,result,fields){
       if(!err){
         result.forEach(function(obj){
           createFieldCache(obj[row]);
         });
       }
       else me.log('error while retrieving Tables from database ' + err);
     });
   },
   
  performQuery: function(query,params,callback){
    var me = this,       
        client = this.createClient();
    
    var createCb = function(cb){
      return function(err,results,fields){
        //me.log('result from query: ' + err + results + fields);
        //sys.log('results: ' + sys.inspect(results));
        //sys.log('fields: ' + sys.inspect(fields));
        cb(err,results,fields);
        client.end(); // clean up
      };      
    };
      
    if(query){ 
      if(!callback && params) client.query(query,createCb(params)); // allow for both (query,callback) and (query,params,callback)
      else {
        this.log('performing query ' + client.format(Tools.copy(query),Tools.copy(params)));
        client.query(query,params,createCb(callback));
      } 
    }
    else this.log('No query given when performing a query?');
    
  },
   
   createClient: function(){
     var client = new NodeMySQLClient();
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
      sys.log('Thoth NodeMySQLStore: Error with the client: ' + error);
      //process.exit("Error connecting...");
   }
   

   
});