/*
Trying how easy it is to "rewrite" OrionDB as a ONR store
Based on the node libmysqlclient by Sannis: http://github.com/Sannis/node-mysql-libmysqlclient
*/

// include mysql node bindings
var mysql = require('./mysqlclient/mysql-libmysqlclient');
var sys = require('sys');
var Store = require('./core/Store').Store;
var JunctionMixin = require('./core/mixins/junctionrelations').RelationsByJunctionTable;

exports.MySQLStoreMySQLClient = Store.extend(JunctionMixin, {
  
   primaryKey: null,

   hostname: null,
   
   user: null,
   
   password: null,
   
   database: null,
   
   _connection: null,
   
   _hasConnection: null,
   
   _tableInfo: null,
   
   escapeField: function(value){      
      var ret,conn;
      if(SC.typeOf(value) === SC.T_STRING){
         sys.log("ThothMySQLStoreMySQLClient: escapeField: value seems instanceof String: " + value);
         conn = this.createConnection();
         try {
            ret = conn.escapeSync(value);
         } catch(e){ sys.log("escapefield error: " + e); }   
         conn.closeSync();
      }
      else ret = value;
      return ret;
   },
   
   createConnection: function(){
      if(this.hostname && this.user && this.password && this.database){
         //sys.log('ThothMySQLStoreMySQLClient: trying to create connection:');
         //sys.log('ThothMySQLStoreMySQLClient: info: ' + [this.hostname, this.user, this.password, this.database].join(","));
         var connection = mysql.createConnectionSync();
         var hasConnection = connection.connectSync(this.hostname, this.user, this.password, this.database);
         //sys.log("hasConnection: " + sys.inspect(hasConnection));
         if(hasConnection){
            //sys.log('ThothMySQLStoreMySQLClient: connection succeeded');
            return connection;
         }
         sys.log('Could not connect: ' + connection.errorSync());
         return NO;
      }
      sys.log('ThothMySQLStoreMySQLClient: Some information missing: could not connect');
      return NO;
   },
   
   start: function(){
      // setup the connection
      //if(!this.createConnection()) process.exit(); 
      this.setTableCache();
   },
   
   performQuery: function(query,type){
      var connection, res, ret;
      
      if(query){
          connection = this.createConnection();
          if(connection){
             try {
                res = connection.querySync(query);
             } 
             catch(e) { 
                sys.log("ThothMySQLStoreMySQLClient: Something went wrong while doing a query."); 
                sys.log("ThothMySQLStoreMySQLClient: Query: " + query); 
                sys.log("ThothMySQLStoreMySQLClient: MySQL error message: " + connection.errorSync());
             }
             switch(type){
                case 'create': ret = connection.lastInsertIdSync(); break;
                //case 'update': ret = res.fetchAllSync(); break;
                //case 'delete': ret = res; break;
                case 'refresh': ret = res.fetchAllSync(); break;
                case 'fetch': ret = res.fetchAllSync(); break;
                default : ret = res;
             } 
             //sys.log("performQuery type: " + type + " fetchAllSync? " + res.fetchAllSync);            
             connection.closeSync();
             return ret;
          }
          else sys.log("Trying to create a connection, but didn't succeed");
      }
      else sys.log("No query provided");
      return NO;
   },
   
   
   setTableCache: function(){
      // this is to setup a list of table names there are in the database
      //sys.log('ThothMySQLStoreMySQLClient: setTableCache started');
      var tableInfo= {}, 
          rowKey = "Tables_in_" + this.database, 
          tablename,
          tmptablenames = [],
          fields, i,j,tableslen,fieldslen, field, tmpObj;
      var tables = this.performQuery("SHOW TABLES",'fetch');
         //sys.log("setTableCache: tables result" + sys.inspect(tables));
      if(tables){
         //sys.log("Processing tableinfo: " + tables.length + " items to check");
         for(i=0,tableslen=tables.length;i<tableslen;i++){
            //sys.log("Processing table row: " + sys.inspect(tables[i]));
            tablename = tables[i][rowKey].toLowerCase();
            tmptablenames.push(tablename);
            //sys.log("Processing table " + tablename)
            fields = this.performQuery("SHOW COLUMNS FROM " + tablename,'fetch');
            //sys.log('ThothMySQLStoreMySQLClient: found fields in ' + tablename + ": " + sys.inspect(fields));
            if(fields){
               tmpObj = { fields: [], fieldTypes: []};
               for(j=0,fieldslen=fields.length;j<fieldslen;j++){
                  field = fields[j];
                  tmpObj.fields.push(field['Field']); // fieldname
                  tmpObj.fieldTypes.push(field); // fieldInfo
               }
               tableInfo[tablename] = tmpObj;
            }
         }
         this._tableInfo = tableInfo;
         sys.log("ThothMySQLStoreMySQLClient: setTableCache finished. Tables found: " + tmptablenames.join());
         return YES;    
      }
      // in case of error;
      this._tableInfo = null;
      this._resources = null; 
   }, 
   
    
   recordFieldsInRequest: function(storeRequest){
      // function to get the data from the storeRequest, according to the table definition
      // returns an object { fieldNames: [], fieldValues:[] } if values are detected
      // this function also escapes field values if necessary
      // else it returns NO
      //sys.log("ThothMySQLStoreMySQLClient: trying to get the table fields in the request. " + sys.inspect(this._tableInfo));
      var tableInfo = this._tableInfo[storeRequest.bucket.toLowerCase()];
      //sys.log("ThothMySQLStoreMySQLClient: tableinfo = " + sys.log(tableInfo));
      var record = storeRequest.recordData;
      //now parse the fields and for every field parse the record data
      var fieldnames = [], fieldvalues = [];
      var fieldval;
      var me = this;
      //sys.log("ThothMySQLStoreMySQLClient: fields has forEach: " + tableInfo.fields.forEach);
      tableInfo.fields.forEach(function(field){// we could use fieldinfo for checking data?
         //sys.log("ThothMySQLStoreMySQLClient: parsing field: " + field);
         fieldval = record[field];
         if(fieldval || fieldval === ''){ // only allow empty strings or other truish values
            fieldnames.push(field);
            fieldvalues.push(me.escapeField(fieldval));   
         }
      });
      //sys.log("ThothMySQLStoreMySQLClient: tableInfo parsed: fieldNames: " + sys.inspect(fieldnames));
      if(fieldnames.length > 0) return { fieldNames: fieldnames, fieldValues: fieldvalues };
      else return NO;
   },
   
   filterRecord: function(storeRequest){
      // filters the record data inside the storeRequest and only returns the fields also in the table
      //sys.log("Filter record called, checking tableinfo: " + sys.inspect(this._tableInfo) );
      var tableInfo = this._tableInfo[storeRequest.bucket.toLowerCase()];
      var ret = {};
      var record = storeRequest.recordData;
      tableInfo.fields.forEach(function(field){
         ret[field] = record[field];
      });
      return ret;
   },
   
   createInsertQuery: function(storeRequest){
      // create an SQL insert function
      var bucket = storeRequest.bucket, record = storeRequest.recordData;
      if(bucket && record && this._tableInfo){
         var fieldInfo = this.recordFieldsInRequest(storeRequest);
         if(fieldInfo){
            var ret = "INSERT INTO " + bucket + " (";
            ret += fieldInfo.fieldNames.join(",");
            ret += ") VALUES ('";
            ret += fieldInfo.fieldValues.join("','");
            ret += "')";
            return ret;            
         }
         else return NO;
      }
      else return NO;
   },
   
   createDBRecord: function(storeRequest,clientId,callback){
      sys.log("ThothMySQLStoreMySQLClient: trying to create record");
      // the callback expects the new record
      var query = this.createInsertQuery(storeRequest);
      sys.log('ThothMySQLStoreMySQLClient: trying to create record with query: ' + query);
      if(query){
         var result = this.performQuery(query,'create');
         sys.log("ThothMySQLStoreMySQLClient: create results in last insert id: " + result);
         // result contains the lastInsertId:
         if(callback){
            var ret = this.filterRecord(storeRequest);
            sys.log("ThothMySQLStoreMySQLClient: filter original request by table fields: " + ret);
            ret[this.primaryKey] = result;
            if(!ret.key) ret.key = result;
            callback(ret);            
         }
      }
      else {
         sys.log("ThothMySQLStoreMySQLClient: there was an error while trying to create a new record");
      }
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
      else sys.log("ThothMySQLStoreMySQLClient: trying to create an update query without a primaryKey field");

      return NO;
   },
   
   updateDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the updated record
      sys.log("ThothMySQLStoreMySQLClient: Trying to update a record");
      var query = this.createUpdateQuery(storeRequest);
      sys.log("ThothMySQLStoreMySQLClient: Trying to update a record with query: " + query);
      if(query){
         sys.log("ThothMySQLStoreMySQLClient: trying to perform an update with query: " + query);
         var result = this.performQuery(query,'update');          
         sys.log("ThothMySQLStoreMySQLClient: result of updateQuery: " + sys.inspect(result));
         //assuming result doesn't return any real data and assuming stuff worked like they should...
         // there should be some kind of error detection here...
         if(callback){
            var ret = this.filterRecord(storeRequest);
            if(!ret.key) ret.key = ret[this.primaryKey];
            callback(ret);                           
         }
      }
      else {
         sys.log("ThothMySQLStoreMySQLClient: Something went wrong while trying to create the query");
         callback(NO);
      }
   },
   
   deleteDBRecord: function(storeRequest,clientId,callback){
      // this is easy, just delete
      sys.log("ThothMySQLStoreMySQLClient: deleteDBRecord called with storeRequest: " + sys.inspect(storeRequest));
      //var bucket = this.escapeField(storeRequest.bucket);
      var bucket = this.escapeField(storeRequest.bucket);
      var primKey = this.escapeField(this.primaryKey);
      var id = this.escapeField(storeRequest.key);
      sys.log("ThothMySQLStoreMySQLClient: Trying to delete a record");
      var query = "DELETE FROM " + bucket + " WHERE " + primKey + "='" + id + "'";
      sys.log("ThothMySQLStoreMySQLClient: Delete query: " + query);
      var ret = this.performQuery(query,'delete');      
      if(callback) callback(ret);
   },
   
   fetchDBRecords: function(storeRequest,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      sys.log("ThothMySQLStoreMySQLClient: fetchDBRecords called");
      var resource = this.escapeField(storeRequest.bucket);
      //var resource = storeRequest.bucket;
      //sys.log("Trying to do a fetch with query: " + "SELECT * from " + resource);
      var ret = this.performQuery("SELECT * from " + resource,'fetch');
      //sys.log("Returning ret: " + sys.inspect(ret));
      if(ret && (ret instanceof Array)){
         // put key property on the records
         var prKey = this.primaryKey;
         for(var i=0,len=ret.length;i<len;i++){
            ret[i].key = ret[i][prKey];
         }
      }
      //sys.log("Returning ret: " + sys.inspect(ret));
      callback(ret);
   },
   
   refreshDBRecord: function(storeRequest,clientId,callback){
      // the callback expects a record
      sys.log("Trying to do a refresh");
      //var bucket = this._connection.escape(storeRequest.bucket);
      //var keyName = this._connection.escape(this.primaryKey);
      //var keyValue = this._connection.escape(storeRequest.key);
      var bucket = storeRequest.bucket;
      var keyName = this.primaryKey;
      var keyValue = this.escapeField(storeRequest.key);
      //keyValue = (keyValue instanceof String)? this._connection.escape(keyValue): keyValue;
      var query = "SELECT * FROM " + bucket + " WHERE ";
      query += keyName + "=" + keyValue; 
      sys.log("about to attempt query: " + query);
      var rec = this.performQuery(query,'refresh');
      var ret;
      if(rec && (rec instanceof Array)) ret = rec[0];
      //sys.log("result of query " + query + " is " + sys.inspect(rec));
      if(!ret.key) ret.key = ret[keyName];
      callback(ret);
   }
   
});