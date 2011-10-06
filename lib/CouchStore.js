var CouchDB = require('./node-couchdb');
var sys = require('sys');
var Tools = require('./Tools');

var Store = require('./core/Store').Store;

/*
 This store will contain its own relation scheme, which is translated from the models as follows:
 
 - A relation is always direct, unless specified otherwise
 - the relation data will be saved as follows:
   - one-to-one => both sides id
   - one-to-many => id on toOne side, array with ids on the toMany
   - many-to-many => both sides arrays with id

In addition this CouchStore adapter will have support for elasticsearch.
 
*/

exports.CouchStore = Store.extend({

  port: 5984,
  
  host: 'localhost',
  
  useElasticSearch: false,
  
  autoCreateDocument: true,
  
  automaticRelations: false, // we handle relation data inside our normal requests

  start: function(){
    // if elastic search is being used, we might want to check whether it is up and running, 
    // and perhaps even try to find out whether it is hooked up to couchdb
    return true; // nothing to init
  },

  // couchdb interaction
  
  CDB_ERROR_NOTFOUND: 'not_found',
  
  getClient: function(user,pass){
    return CouchDB.createClient(this.port, this.host,user,pass,this.debug);
  },
  
  getClientFor: function(doc){
    var client = this.getClient();
    if(!client) sys.log('invalid client returned from CouchStore.getClient();');
    else return client.db(doc);
  },
  
  couchHandleError: function(er,result,db,callback){
    if(er.error === this.CDB_ERROR_NOTFOUND){
      if(this.autoCreateDocument) db.create(); //perhaps logging?
      else sys.log('Document not found and not allowed to create it. Break-in?');
      callback(er,[]);
    }
  },
  
  couchDocsFrom: function(result){
    var ret = [];
    if(result && result.rows && result.rows.forEach){
      var rec;
      var me = this;
      result.rows.forEach(function(item){
        rec = item.doc;
        if(rec && !rec.key) rec.key = rec[me.primaryKey];
        ret.push(rec);
      });
    }
    return ret;
  },
  
  couchFetchAll: function(storeRequest,clientId,callback){
    var me = this;
    var db = this.getClientFor(storeRequest.resource);
    var optionProps = 'startkey endkey descending limit'.w();
    var opts = { include_docs:true };
    
    opts = storeRequest.options? Tools.copyProperties(optionProps,opts): opts;
    db.allDocs(opts, function(er,result){
      if(er){ // in case of error
        me.couchHandleError(er,result,db,callback);
      }
      else {
        callback(er,me.couchDocsFrom(result));
      }
    });
  },
  
  
  // the Store API functions

  fetchDBRecords: function(storeRequest,clientId,callback){
    var me = this,
        user = storeRequest.userData.user,
        pass = storeRequest.userData.password,
        db = this.getClient(user,pass);
    
    if(this.useElasticSearch){ // elastic search will be used in all cases when it is there, as it is much faster
      
    }
    else {
      this.couchFetchAll(storeRequest,clientId,callback);
    }
    
    
  }

 


  
  

  
  
  
  
  
});