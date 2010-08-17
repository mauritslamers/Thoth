/*

Trying how easy it is to "rewrite" OrionDB as a ONR store


 */


// include mysqlstuff
var mysql = require('./mysqlclient/mysql-libmysqlclient');
var sys = require('sys');
global.OrionMySQLStore = OrionStore.extend({
  
   primaryKey: null,

   hostname: null,
   
   user: null,
   
   password: null,
   
   database: null,
   
   _connection: null,
   
   _hasConnection: null,
   
   _tableInfo: null,
   
   escapeField: function(value){
      /*
      var ret;
      
      try {
         ret = this._connection.escape(value);
      } catch(e) {
         // if there was an error, just return the original value
         return value;
      }
      return ret; */
      //return (value instanceof String)? this._connection.escape(value): value;
      
      var ret;
      if(value instanceof String){
         sys.log("OrionMySQLStore: escapeField: value seems instanceof String: " + value);
         try {
            ret = this._connection.escape(value);
         } catch(e){ sys.log("value is: " + sys.inspect(value)); process.exit(); }   
      }
      else ret = value;
      return ret; 
      //return value;
   },
   
   createConnection: function(){
      if(this.hostname && this.user && this.password && this.database){
         sys.log('OrionMySQLStore: trying to create connection:');
         //sys.log('OrionMySQLStore: info: ' + [this.hostname, this.user, this.password, this.database].join(","));
         var connection = mysql.createConnection();
         var hasConnection = connection.connect(this.hostname, this.user, this.password, this.database);
         //sys.log("hasConnection: " + sys.inspect(hasConnection));
         if(hasConnection){
            this._hasConnection = hasConnection;
            this._connection = connection;
            this.setTableCache();
            sys.log('OrionMySQLStore: connection succeeded');
            return YES;
         }
         sys.log('Seemingly not connected: ' + this._connection);
         return NO;
      }
      sys.log('OrionMySQLStore: Some information missing: could not connect');
      this._connection = null;
      return NO;
   },
   
   start: function(){
      // setup the connection
      if(!this.createConnection()) process.exit(); 
   },
   
   performQuery: function(query){
      if(this._hasConnection && query){
         //sys.log('OrionMySQLStore: trying to perform query: ' + query)
         var res;
         try{
            res = this._connection.query(query);            
         } catch(e) { 
            sys.log("OrionMySQLStore: Something went wrong while doing a query."); 
            sys.log("OrionMySQLStore: Query: " + query); 
            sys.log("OrionMySQLStore: MySQL error message: " + this._connection.error());
         }
         return res.fetchAll();
      }
      else return NO;
   },
   
   
   setTableCache: function(){
      // this is to setup a list of table names there are in the database
      //sys.log('OrionMySQLStore: setTableCache started');
      if(this._hasConnection){
         var tableInfo= {}, 
             rowKey = "Tables_in_" + this.database, 
             tablename,
             fields, i,j,tableslen,fieldslen, field, tmpObj;
         var tables = this.performQuery("SHOW TABLES");
         //sys.log("setTableCache: tables result" + sys.inspect(tables));
         if(tables){
            //sys.log("Processing tableinfo: " + tables.length + " items to check");
            for(i=0,tableslen=tables.length;i<tableslen;i++){
               //sys.log("Processing table row: " + sys.inspect(tables[i]));
               tablename = tables[i][rowKey].toLowerCase();
               //sys.log("Processing table " + tablename)
               fields = this.performQuery("SHOW COLUMNS FROM " + tablename);
               //sys.log('OrionMySQLStore: found fields in ' + tablename + ": " + sys.inspect(fields));
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
            sys.log("OrionMySQLStore: setTableCache finished");
            return YES;    
         }
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
      //sys.log("OrionMySQLStore: trying to get the table fields in the request");
      var tableInfo = this._tableInfo[storeRequest.bucket.toLowerCase()];
      var record = storeRequest.recordData;
      //now parse the fields and for every field parse the record data
      var fieldnames = [], fieldvalues = [];
      var fieldval;
      var me = this;
      //sys.log("OrionMySQLStore: fields has forEach: " + tableInfo.fields.forEach);
      tableInfo.fields.forEach(function(field){// we could use fieldinfo for checking data?
         //sys.log("OrionMySQLStore: parsing field: " + field);
         fieldval = record[field];
         if(fieldval || fieldval === ''){ // only allow empty strings or other truish values
            fieldnames.push(field);
            fieldvalues.push(me.escapeField(fieldval));   
         }
      });
      //sys.log("OrionMySQLStore: tableInfo parsed: fieldNames: " + sys.inspect(fieldnames));
      if(fieldnames.length > 0) return { fieldNames: fieldnames, fieldValues: fieldvalues };
      else return NO;
   },
   
   filterRecord: function(storeRequest){
      // filters the record data inside the storeRequest and only returns the fields also in the table
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
   
   createDBRecord: function(storeRequest,clientId,callback){
      sys.log("OrionMySQLStore: trying to create record");
      // the callback expects the new record
      var query = this.createInsertQuery(storeRequest);
      if(query){
         var result = this.performQuery(query);
         // afaik there is no real result, and we absolutely need to get the last_insert_id, so get it
         var newId = this._connection.lastInsertId();
         var ret = this.filterRecord(storeRequest);
         ret[this.primaryKey] = newId;
         if(!ret.key) ret.key = newId;
         callback(ret);
      }
      else {
         sys.log("OrionMySQLStore: there was an error while trying to create a new record");
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
      else sys.log("OrionMySQLStore: trying to create an update query without a primaryKey field");

      return NO;
   },
   
   updateDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the updated record
      sys.log("OrionMySQLStore: Trying to update a record");
      var query = this.createUpdateQuery(storeRequest);
      if(query){
         sys.log("OrionMySQLStore: trying to perform an update with query: " + query);
         var result;
         try{
            result = this.performQuery(query);          
         } catch(e){}
         if(!this._connection.error()){
            sys.log("OrionMySQLStore: result of updateQuery: " + sys.inspect(result));
            //assuming result doesn't return any real data and assuming stuff worked like they should...
            // there should be some kind of error detection here...
            var ret = this.filterRecord(storeRequest);
            if(!ret.key) ret.key = ret[this.primaryKey];
            callback(ret);            
         }
      }
      else {
         sys.log("OrionMySQLStore: Something went wrong while trying to create the query");
         callback(NO);
      }
   },
   
   deleteDBRecord: function(storeRequest,clientId,callback){
      // this is easy, just delete
      sys.log("OrionMySQLStore: deleteDBRecord called with storeRequest: " + sys.inspect(storeRequest));
      //var bucket = this.escapeField(storeRequest.bucket);
      var bucket = this.escapeField(storeRequest.bucket);
      var primKey = this.escapeField(this.primaryKey);
      var id = this.escapeField(storeRequest.key);
      sys.log("OrionMySQLStore: Trying to delete a record");
      var query = "DELETE FROM " + bucket + " WHERE '" + primKey + "'='" + id + "'";
      sys.log("OrionMySQLStore: Delete query: " + query);
      var ret;
      try {
         ret = this.performQuery(query);
      }
      catch(e){
         sys.log("OrionMySQLStore: Something went wrong while doing a query. " + e); 
         sys.log("OrionMySQLStore: Query: " + query); 
         sys.log("OrionMySQLStore: MySQL error message: " + this._connection.error());
      }
      
      if(callback) callback(ret);
   },
   
   fetchDBRecords: function(storeRequest,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      sys.log("OrionMySQLStore: fetchDBRecords called");
      var resource = this.escapeField(storeRequest.bucket);
      //var resource = storeRequest.bucket;
      sys.log("Trying to do a fetch with query: " + "SELECT * from " + resource);
      var ret = this.performQuery("SELECT * from " + resource);
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
      var rec = this.performQuery(query);
      var ret;
      if(rec && (rec instanceof Array)) ret = rec[0];
      //sys.log("result of query " + query + " is " + sys.inspect(rec));
      if(!ret.key) ret.key = ret[keyName];
      callback(ret);
   }
   
});