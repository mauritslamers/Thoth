/*globals process*/

/*

Trying to re-implement a mysql store based on the node-mysql client
by felixge

*/

//var NodeMySQLClient = require('./node-mysql/lib/mysql').Client,
var //mysql = require('mysql'),
    API = require('./core/API'),
    Constants = require('./core/Constants'),
    Tools = require('./core/Tools'),
    sys = Tools.sys,
    mysql = require('mysql'),
    cp = require('child_process'),
    Store = require('./core/Store').Store,
    JunctionMixin = require('./core/mixins/junctionrelations').RelationsByJunctionTable;

exports.MySQLStoreNodeMySQL = Store.extend(JunctionMixin,{

	hostname: null,

	user: null,

	password: null,

	database: null,
	
	numClients: 1,
	
	useChildProcesses: false,

	_tableInfo: null,

	log: function(msg){
		sys.log('Thoth NodeMySQLStore: ' + msg);
	},

	createDBRecord: function(storeRequest,clientId,callback){
		// the callback expects the new record
		var bucket = storeRequest.bucket,
		primKey = this.primaryKey || API.getPrimaryKey(storeRequest,this),
		key = storeRequest.key,
		record = storeRequest.record,
		me = this, query, params, tabledata, field, insertfields, valuefields;

		tabledata = this._tableCache[bucket];
		if(tabledata){
		  if(this.isBenchMarking) SC.Benchmark.start('NodeMySQL create');		  
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
			query = "INSERT INTO " + bucket + " ";
			query += "(" + insertfields.join(",") + ")";
			query += " VALUES(" + valuefields.join(",") + ")";
			this.performQuery(query,params,function(err,result,fields,client){
  		  if(me.isBenchMarking) SC.Benchmark.end('NodeMySQL create');
				if(!err){
					record[primKey] = result.insertId;
					if(callback) callback(null,me.filterRecord(record,bucket));
				}
				else {
					me.log('error while creating a record with query: ' + query + " and parameters: " + params + ' Error: ' + err);
					if(callback) callback(err,null);
				}
			});
		}
		else {
			me.log("trying to create a record in a table that doesn't exist: " + query + " and parameters: " + params);
			if(callback) callback(err,null);
		}
	},

	updateDBRecord: function(storeRequest,clientId,callback){
		// the callback expects the updated record
		var bucket = storeRequest.bucket,
		primKey = API.getPrimaryKey(storeRequest,this),
		key = storeRequest.key,
		record = storeRequest.record,
		me = this,
		query,params,tabledata,field,setfields;

		tabledata = this._tableCache[bucket];
		if(tabledata){
		  if(this.isBenchMarking) SC.Benchmark.start('NodeMySQL update');
			setfields = [];
			params = [];
			for(field in tabledata){
				if(tabledata.hasOwnProperty(field) && (record[field] !== undefined)){
					setfields.push([field,"=?"].join("")); // push set fieldname =? to setfields array
					params.push(record[field]); // push value on params
				}
			}
			// assemble query:
			query = "UPDATE " + bucket + " SET " + setfields.join(",") + " WHERE " + primKey + "=?";
			params.push(key);

			this.performQuery(query,params,function(err,result,fields,client){
  		  if(me.isBenchMarking) SC.Benchmark.end('NodeMySQL update');
				sys.log('err: ' + sys.inspect(err));
				sys.log('result: ' + sys.inspect(result));
				sys.log('fields: ' + sys.inspect(fields));
				if(result.warningCount > 0){
					sys.log('MySQL has warning with this query!');
				}
				if(result.affectedRows === 0){
					sys.log('MySQL says no rows affected? Oops!');
					err = { message: "Thoth NodeMySQL: MySQL said no rows affected!!!"};
				}
				if(!err && (result.affectedRows !== 0)){
					// reason to filter: the client may have sent fields that are not part of the record
					// so only return the fields that are valid
					if(callback) callback(err,me.filterRecord(record,bucket)); 
				}
				else {
					me.log('error with query: ' + client.format(query,params) + ' Error: ' + sys.inspect(err));
					if(callback) callback(err,null);
				}
			});
		}
		else if(callback) callback(err,null);
	},

	deleteDBRecord: function(storeRequest,clientId,callback){
		// check for callbacks.. Often it is not included!
		var bucket = storeRequest.bucket,
		primKey = API.getPrimaryKey(storeRequest,this),
		key = storeRequest.key,
		me = this, query;

		if(this._tableCache[bucket]){
		  if(this.isBenchMarking) SC.Benchmark.start('NodeMySQL delete');
			query = "DELETE FROM " + bucket + " WHERE " + primKey + " = ?";
			this.performQuery(query,[key],function(err,result,fields){
  		  if(me.isBenchMarking) SC.Benchmark.end('NodeMySQL delete');
				if(!err){
					if(callback) callback(err,YES);
				}
				else {
					me.log('error while trying to delete record: ' + err);
					if(callback) callback(err,null);
				}
			});
		}
		else {
			this.log("trying to delete a record from a table that doesn't exist.");
			if(callback) callback(new Error("trying to delete a record from a table that doesn't exist."),null);
		}
	},

	fetchDBRecords: function(storeRequest,clientId,callback){
		// the callback expects an array of js objects, so make sure that the data has been parsed 
		var sR = storeRequest,
		    bucket = sR.bucket, 
		    me = this, keys,
		    primKey = API.getPrimaryKey(sR,this),
		    query;
		    
		if(this._tableCache[bucket]){ // make sure no malformed bucket can be used here...
		  if(this.isBenchMarking) SC.Benchmark.start('NodeMySQL fetch');
		  //Tools.log('conditions: ' + storeRequest.conditions);
			query = "SELECT * FROM " + bucket;
			if(sR.keys){
			  sys.log('trying to retrieve keys: ' + sys.inspect(sR.keys));
			  keys = (sR.keys instanceof Array)? sR.keys: [sR.keys];
			  if(keys.length > 0) query += " WHERE " + primKey + " IN (" + storeRequest.keys.join(",") + ")";
			  else {
			    callback(null,[]);
			    return;
		    }
			}
			this.performQuery(query,function(err,result,fields){
  		  if(me.isBenchMarking) SC.Benchmark.end('NodeMySQL fetch');
				if(callback){
					//if(!err && result) callback(me.filterRecords(result));
					if(!err && result) callback(err,result);
					else {
						me.log('error in fetch: ' + err);
						me.log('query was: '  + query);
						if(callback) callback(err,null);
					} 
				}
				else me.log('no callback in fetch??');
			});
		}
		else {
			if(callback) callback(new Error("trying to fetch from a table that doesn't exist: " + bucket),[]);
		}
	},

	refreshDBRecord: function(storeRequest,clientId,callback){
		// the callback expects a record
		var bucket = storeRequest.bucket,
		primKey = API.getPrimaryKey(storeRequest,this),
		key = storeRequest.key,
		me = this;

    var cb = function(err,result,fields){
      if(me.isBenchMarking) SC.Benchmark.end('NodeMySQL refresh');
      if(!err && result){
        if(result instanceof Array) callback(err,result[0]);
        else callback(err,result);
      }
      else {
				me.log('error in refresh: ' + err); 
				if(callback) callback(err,null);
			}
    };

		if(this._tableCache[bucket]){
		  if(this.isBenchMarking) SC.Benchmark.start('NodeMySQL refresh');
			var query = "SELECT * FROM " + bucket + " WHERE `" + primKey + "` = ?";
			// cannot use primKey in parameters as the query doesn't work when the field is in quotes... 
			// but how to prevent injection here ? Added backticks for security...
			this.performQuery(query,[key],cb);
			//this.performQuery(query,cb);
		}
		else callback(new Error("Trying to retrieve a record from a table that doesn't exist: " + query),null);
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

  _clients: null,
  
  _lastclient: 0,

  getClient: function(){ // distribution of queues on clients...
    if(!this._clients){
      this._clients = [];
      for(var i=0,len=this.numClients;i<len;i+=1){
        this._clients.push(this.createClient());
      }
    }
    
    var ret = this._clients[this._lastclient];
    this._lastclient += 1; // do round-robin...
    if(this._lastclient >= this.numClients) this._lastclient = 0;
    //this.log('giving back client at:' + this._clients.indexOf(ret));
    //ret.ping();
    return ret; 
  },

	performQuery: function(query,params,callback){
		var me = this, m, reqKey,cb,
		    client = this.getClient();

		var createCb = function(cb){
			return function(err,results,fields){
				//sys.log('err from query: error: ' + sys.inspect(err));
				//sys.log('results: ' + sys.inspect(results));
				//sys.log('fields: ' + sys.inspect(fields));
				cb(err,results,fields,client);
  		  if(me.isBenchMarking) SC.Benchmark.end('nodemysql performQuery');
        // client.end(function(){ 
        //   //client.destroy(); // no need to clean up, because max num of clients...
        // }); // clean up
			};      
		};

    if(!this._queries) this._queries = {};
    //this.log('client is: ' + sys.inspect(client));
		if(query){ 
		  if(this.isBenchMarking) SC.Benchmark.start('nodemysql performQuery');
		  cb = (!callback && params)? createCb(params): createCb(callback);
		  if(this.useChildProcesses){
  		  reqKey = Tools.generateCacheKey();
  		  m = {
  		    isQuery: true,
  		    reqKey: reqKey,
  		    query: query,
  		    params: (!callback && params)? []: params
  		  };
  		  // allow for both (query,callback) and (query,params,callback)
  		  this._queries[reqKey] = cb; // store callback for reqkey
  		  client.send(m);		    
		  }
		  else {
		    if(!callback && params){
		      client.query(query,[],cb);
		    }
		    else {
		      client.query(query,params,cb);
		    }
		    
		  }
		}
		else this.log('No query given when performing a query?');

	},
	
	_queries: null,
	
	_handleResult: function(m){
	  var reqKey = m.reqKey;
	  var req = this._queries[reqKey];
	  if(req){
	    req(m.err,m.records,m.fields);
	    delete this._queries[reqKey];
	  } 
	},

	createClient: function(){
	  var me = this, client;
	  if(this.user && (this.password !== null) && this.hostname && this.database){
	    if(this.isBenchMarking) SC.Benchmark.start('nodemysql create client');
	    if(this.useChildProcesses){
	      client = cp.fork(Tools.libPath + '/node-mysql-client.js');
  	    client.send({ 
  	      isConnect: true,
    		  user      : this.user,
    		  password  : this.password,
    		  host      : this.hostname,
    		  database  : this.database	      
  	    });
    		client.on('error',this.mySQLError);
    		client.on('message',function(m){
    		  me._handleResult.call(me,m);
    		});
	    }
	    else {
	      client = mysql.createClient({
      	  user      : this.user,
      	  password  : this.password,
      	  host      : this.hostname,
      	  database  : this.database
      	});
	    }
			if(this.isBenchMarking) SC.Benchmark.end('nodemysql create client');
			return client;         
		}
		else throw("Missing connection data");
	},

	// this function provides a hook for starting certain things when the server starts
	// which cannot be done using the init function (constructor)
	start: function(server){
	  var me = this;
	  this.isBenchMarking = server.isBenchMarking; // copy benchmarking setting
	  this.isProfiling = server.isProfiling; 
	  if(this.useChildProcesses){
  	  process.on('exit',function(){ //kill child processes if any
  	    if(me._clients){
  	      me._clients.forEach(function(c){
    	      c.kill();
    	    });
  	    } 
  	  });	    
	  }
		this.createTableCache();
	},

	mySQLError: function(error){
		// function to be called for every error
		sys.log('Thoth NodeMySQLStore: Error with the client: ' + error);
		//process.exit("Error connecting...");
	},

	filterRecord: function(record,bucket){
		// filters the record data inside the storeRequest and only returns the fields also in the table
		//sys.log("Filter record called, checking tableinfo: " + sys.inspect(this._tableCache) );
		var tableInfo = this._tableCache[bucket.toLowerCase()];
		var ret = {};
		for(var field in tableInfo){
			if(tableInfo.hasOwnProperty(field)){
				//sys.log('filtering field ' + field);
				ret[field] = record[field];	
			}
		}
		return ret;
	}



});