/* 
Wrapper store, catches requests for resources (buckets) and passes them on to the stores defined

The purpose is to be able to use different backend stores for different resources, or pass on requests to multiple stores
There are a few limitations: 
- in cascading mode, the cascading takes place based on resource
- relational data can only be in one store at the same time. It is not (yet) possible to save or get relational data from multiple stores.
- on retrieval of data only one store will be used, being the first defined.
*/
var Constants = require('./Constants');

exports.WrapperStore = SC.Object.extend({
  
  stores: null, // an array of store instances (NOT classes!)
  
  resources: null, // an array containing arrays of resources. The index of the array where the resource is in determines the store the request will be passed to
                    // so a stores property containing [ CouchDBStore.create(), DiskStore.create() ] and a resources property of [ ['student'] ['teacher']] will pass
                    // the requests for student to CouchDB and the requests for teacher to the DiskStore. 
  
  shouldCascade: null, // shouldCascade will result in the last defined store to take all requests for resources not defined in the resources property, unless a catchAllStore
                       // is defined, in which case the store returned by this.stores[catchAllStoreIndex] will get all those requests
  catchAllStoreIndex: null, 
  
  storeForResource: function(resource, action){
    // function returns what store to send a particular request to
    // it will always return an array with one or more store references in it.
    var ret = [], resources = this.resources, stores = this.stores,
        index, catchAllIndex = this.catchAllStoreIndex;
    
    resources.map(function(ary,idx){
      index = ary.indexOf(resource);
      if(index > -1) ret.push(stores[idx]);
    });
    
    if(ret.length === 0 && this.shouldCascade){ // resource not found, either cascade to last store or to the catchAllStore
      if((catchAllIndex !== null) && (SC.typeOf(catchAllIndex) === 'number')) ret.push(stores[catchAllIndex]);
      else ret.push(stores.get('lastObject'));
    }
    
    switch(action){
      case Constants.ACTION_FETCH: // prevent fetching data from multiple stores at the same time
        if(ret.length > 1) ret = ret.get('firstObject');
        break;
      case Constants.ACTION_REFRESH: 
        if(ret.length > 1) ret = ret.get('firstObject');
        break;
      default: // for CREATE, UPDATE, DELETE do nothing
    }
    
    return ret;
  },
  
  fetch: function(storeRequest,clientId,callback){
    if(this.stores && this.resources){
      
    }
  },
  
  refreshRecord: function(storeRequest,clientId,callback){
    if(this.stores && this.resources){
      
    }  
  },
  
  //NOTE: it is important to prevent multiple stores answering the same callback, so only the first store should be allowed to use the callback.
  //      Maybe a stand-in callback is needed to check whether actions have been performed?
  
  createRecord: function(storeRequest,clientId,callback){
    if(this.stores && this.resources){
      
    }    
  },
  
  updateRecord: function(storeRequest,clientId,callback){
    if(this.stores && this.resources){
      
    }
  },
  
  deleteRecord: function(storeRequest,clientId,callback){
    if(this.stores && this.resources){
      
    }    
  }
  
});