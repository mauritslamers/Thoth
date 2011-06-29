var CouchDB = require('./node-couchdb');
var sys = require('sys');

var Store = require('./core/Store').Store;

/*
 This store will contain its own relation scheme, which is translated from the models as follows:
 
 - A relation is always direct, unless specified otherwise
 - the relation data will be saved as follows:
   - one-to-one => both sides id
   - one-to-many => id on toOne side, array with ids on the toMany
   - many-to-many => both sides arrays with id
 
*/

exports.CouchStore = Store.extend({

  port: 5984,
  
  host: 'localhost',
  
  automaticRelations: false, // we handle relation data inside our normal requests

  getClient: function(user,pass){
    return CouchDB.createClient(this.port, this.host,user,pass,this.debug);
  },

  start: function(){
    return true; // nothing to init
  },
  
  fetchDBRecords: function(storeRequest,clientId,callback){
    var me = this,
        user = storeRequest.userData.user,
        pass = storeRequest.userData.password,
        db = this.getClient(user,pass);
    
    
    
  },
  
  
  /*
  fetchDBRecords: function(storeRequest,clientId,callback){  
     
     //db.allDocs(query)

     //Wrapper for GET /db-name/_all_docs. query allows to specify options for this view.
     
     sys.log('CouchDB fetchDBRecords');
     var bucket = storeRequest.bucket;
     var db = this.getClient().db(bucket);
     var me = this;
     db.allDocs({include_docs:true},function(er,result){
       if(er){ 
         sys.log('Error while fetching from CouchDB: ' + sys.inspect(er));
         if((er.error == "not_found") && me.automaticallyCreateDatabase){
           db.create();
         }
         callback(er,[]);
       }
       else {
         var ret = me.fetchDocsFromResult(result);
         sys.log('calling callback for ' + bucket + ' with result: ' + sys.inspect(ret,false,10));
         callback(er,ret);
       }
     });
     sys.log('ending couchdb fetchDBRecords');
   },
  */
  
  
  
});