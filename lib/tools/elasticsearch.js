
var http = require('http');
var sys = require('util') || require('sys');

exports.ElasticSearch = SC.Object.extend({
  hostES: 'localhost',
  portES: 9200,
  
  couchStore: null, // if used with couch, set the couchstore here, as we need it to set up things
  
  start: function(){
    
  },
  
  registerCouchDocumentRiver: function(db,host,port,filter,cb){
    // function to have ES set up a link to the changes feed of couch
    var baseObj = {
      type: "couchdb",
      couchdb: {
        host: host,
        port: port,
        db: db,
        filter: filter
      }
    };
    
    var reqData = {
      host: host,
      port: port,
      path: ['/_river/','indexOf',db,"/_meta"].join(""),
      method: 'PUT'
    };
    var req = http.request(reqData,function(res){
      res.setEncoding('utf8');
    });
    
    req.on('error',function(e){
      sys.log('problem connecting to couchdb river on db ' + db + ' from ElasticSearch: ' + JSON.stringify(reqData));
      cb(e);
    });
    
    req.write(JSON.stringify(baseObj));
    req.end();
  },
  
  _performElasticSearch: function(){
    
  },
  
  elasticQueryFrom: function(conditions, parameters){
    // we use SC.Query to parse the conditions stuff
    var q = SC.Query.local(SC.Object,conditions,parameters);
    
    if(q.parse()){ // parse tells us whether it succeeded
      // now all tokens are in q._tokenList, which is an array
      
    }
  }
  
    
  
  
});

