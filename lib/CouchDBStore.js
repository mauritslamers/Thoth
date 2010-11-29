/*
An attempt at writing a CouchDB store adapter for Thoth
*/

var CouchDB = require('./node-couchdb');
var sys = require('sys');

var Store = require('./Store').Store;


exports.CouchDBStore = Store.extend({
  
  host: null,
  
  port: 5984,
    
  getClient: function(){
    return CouchDB.createClient(this.port, this.host);
  },

  /*
  the storeRequest is an object with the following layout:
  { bucket: '', 
    key: '',
    conditions: '', 
    parameters: {}, 
    recordData: {},
    relations: [ 
       { bucket: '', type: 'toOne', propertyName: '', keys: [] }, 
       { bucket: '', type: 'toMany', propertyName: '', keys: [] } 
    ] 
  }
  */
  
  /*
  node-couchdb examples:
  db
    .saveDoc('my-doc', {awesome: 'couch fun'}, function(er, ok) {
      if (er) throw new Error(JSON.stringify(er));
      sys.puts('Saved my first doc to the couch!');
    });

  db
    .getDoc('my-doc', function(er, doc) {
      if (er) throw new Error(JSON.stringify(er));
      sys.puts('Fetched my new doc from couch:');
      sys.p(doc);
    });
  */
  
  fetchDBRecords: function(storeRequest,clientId,callback){  
    /*
    db.allDocs(query)

    Wrapper for GET /db-name/_all_docs. query allows to specify options for this view.
    */
    
    var bucket = storeRequest.bucket;
    var db = this.getClient().db(bucket);
    db.allDocs(function(er,result){
      if(er) sys.log('Error while retrieving from CouchDB: ' + er);
      else callback(result); //filtering...
    });
  },
  
  refreshDBRecord: function(storeRequest,clientId,callback){
    var db = this.getClient().db(storeRequest.bucket);
    //we are doing a fetch all here... probably needs something different
    db.getDoc(storeRequest.key, function(er,result){
      if(er) sys.log('Error while retrieving from CouchDB: ' + er);
      else callback(result); //filtering...
    });    
  },
  
  /*
  db.getDoc(id)
  Wrapper for GET /db-name/doc-id. Fetches a document with a given id from the database.

  db.saveDoc(id, doc)
  Wrapper for PUT /db-name/doc-id. Saves a json doc with a given id.

  db.saveDoc(doc)
  Same as the above, but the id can either a property of doc, or omitted to let CouchDB generate a uuid for this new document.

  db.removeDoc(id, rev)
  Deletes document id with rev from the db.
  */
  // need to think about a way to get the clientId in the request
  createDBRecord: function(storeRequest,clientId,callback){
    var db = this.getClient().db(storeRequest.bucket);
    db.saveDoc(storeRequest.recordData, function(err,res){
      if(err) sys.log('Error while creating in CouchDB: ' + er);
      else callback(res); // does couchdb give my record back?
    });  
  },
  
  updateDBRecord: function(storeRequest,clientId,callback){
    var db = this.getClient().db(storeRequest.bucket);
    db.saveDoc(storeRequest.key, storeRequest.recordData, function(err,res){
      if(err) sys.log('Error while creating in CouchDB: ' + er);
      else callback(res); // does couchdb give my record back?
    });
  },
  
  deleteRecord: function(storeRequest,clientId,callback){
    var db = this.getClient().db(storeRequest.bucket);
    var rev = storeRequest.recordData.revision;
    db.removeDoc(storeRequest.key, rev, function(err,res){
      if(err) sys.log('Error while creating in CouchDB: ' + er);
      else callback(YES); 
    });
  }
  
});