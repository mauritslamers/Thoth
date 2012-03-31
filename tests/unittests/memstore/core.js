var base = require('../../testbase');
var C = base.Thoth.Constants;
var storeAPITests = require('../store_api');
var assert = base.assert;
var sys = require('util');
var memstoretest = base.vows.describe("MemStore tests");


memstoretest.addBatch({
  'A basic unstarted MemStore':{
    topic: base.Thoth.MemStore.create(),
    
    'should not be undefined': function(m){
      assert.isObject(m);
    },
    
    'should comply with the Store API': storeAPITests.testStoreAPI,
    
    'should comply with the Store Relations API': storeAPITests.testRelationsAPI,
    
    'should have a _tables property being null': function(m){
      assert.isNull(m._tables);
    },
    
    'should have a _counters property being null': function(m){
      assert.isNull(m._counters);
    },
    
    'should have an _indexes property being null': function(m){
      assert.isNull(m._indexes);
    },
    
    'should have useAutoIncrementIndex set to true': function(m){
      assert.isTrue(m.useAutoIncrementIndex);
    }
  }
})
.addBatch({
  'a started MemStore': {
    topic: function(){
      var t = base.Thoth.MemStore.create();
      t.start();
      return t;
    },
    
    'should have an empty object as _tables property': function(t){
      assert.isObject(t._tables);
      assert.isEmpty(t._tables);
    },
    
    'should have an empty object as _indexes property': function(t){
      assert.isObject(t._indexes);
      assert.isEmpty(t._indexes);
    },
    
    'should have an empty object as _counters property': function(t){
      assert.isObject(t._counters);
      assert.isEmpty(t._counters);
    }
  }
})
.addBatch({
  'When': {
    topic: function(){
      var t = base.Thoth.MemStore.create();
      t.start();
      return t;
    },
    
    'creating a record without a key': {
      topic: function(store){
        var sr = base.Thoth.API.StoreRequest.create({
          bucket: 'test',
          record: {
            testprop: 'testval'
          },
          requestType: C.ACTION_CREATE
        });
        store.createDBRecord(sr,{},this.callback);
      },
      
      'the callback should give back a record': function(val){
        assert.deepEqual(val,{ key: 1, testprop: 'testval'});
      },
      
      'the memstore': {
        topic: function(rec,store){
          return store;
        },
        
        'should have a table test with the record': function(t){
          assert.isObject(t._tables['test']);
          assert.isObject(t._tables['test']['1']);
          assert.deepEqual(t._tables['test']['1'], { key: 1, testprop: 'testval'});
        },
        
        'should have a counter for this table with value 1': function(t){
          assert.equal(t._counters['test'], 1);
        }
      }
    }
  }
})
.addBatch({
  'When': {
    topic: function(){
      var t = base.Thoth.MemStore.create();
      t.start();
      return t;
    },
      
    'creating a record with a key': {
      topic: function(store){
        var sr = base.Thoth.API.StoreRequest.create({
          bucket: 'test',
          primaryKey: 'id',
          key: 'testid',
          record: {
            testproperty: 'testvalue'
          },
          requestType: C.ACTION_CREATE
        });
        store.createDBRecord(sr,{},this.callback);
      },
    
      'the callback should give back a record': function(val){
        assert.deepEqual(val, { id: 'testid', testproperty: 'testvalue'});
      },
      
      'the memstore': {
        topic: function(rec,store){
          return store;
        },
        
        'should have a table with the given bucket and the correct record': function(t){
          assert.isObject(t._tables['test']);
          assert.isObject(t._tables['test']['testid']);
          assert.deepEqual(t._tables['test']['testid'],{ id: 'testid', testproperty: 'testvalue'});
        },
        
        'should have the counter set to 1': function(t){
          assert.equal(t._counters['test'],1);
        }
      }
    }
  }
})
.addBatch({
  'When': {
    topic: function(){
      var t = base.Thoth.MemStore.create();
      t.start();
      return t;
    },
    
    'first create': {
      topic: function(store){
        var req = base.Thoth.API.StoreRequest.create({
          bucket: 'test',
          primaryKey: 'id',
          key: 'testkey',
          record: { testprop: 'testval'},
          requestType: C.ACTION_CREATE
        });
        store.createDBRecord(req,{},this.callback);
      },
      
      'and then update a record': {
        topic: function(rec,store){
          var req = base.Thoth.API.StoreRequest.create({
            bucket: 'test',
            primaryKey: 'id',
            key: 'testkey',
            record: { id: 'testkey', testprop: 'testvalue'}, // do a new object to be sure
            requestType: C.ACTION_UPDATE
          });
          store.updateDBRecord(req,{},this.callback);
        },
        
        'we should get an updated record': function(rec){
          assert.isObject(rec);
          assert.deepEqual(rec, { id: 'testkey', testprop: 'testvalue'});
        },
        
        'the memstore': {
          topic: function(updatedrec,originalrec,store){
            return store;
          },
          
          'should contain the change': function(t){
            assert.isObject(t._tables['test']);
            assert.isObject(t._tables['test']['testkey']);
            assert.deepEqual(t._tables['test']['testkey'], { id: 'testkey', testprop: 'testvalue'});
          },
          
          'should still have one for the counters': function(t){
            assert.equal(t._counters['test'],1);
          }
        }
      }
    } 
  }
})
.addBatch({
  'When': {
    topic: function(){
      var t = base.Thoth.MemStore.create();
      t.start();
      return t;
    },
    
    'first create': {
      topic: function(store){
        var req = base.Thoth.API.StoreRequest.create({
          bucket: 'test',
          primaryKey: 'id',
          key: 'testkey',
          record: { testprop: 'testval'},
          requestType: C.ACTION_CREATE
        });
        store.createDBRecord(req,{},this.callback);
      },
      
      'and then delete a record': {
        topic: function(rec,store){
          var req = base.Thoth.API.StoreRequest.create({
            bucket: 'test',
            primaryKey: 'id',
            key: 'testkey',
            requestType: C.ACTION_DELETE
          });
          store.deleteDBRecord(req,{},this.callback);
        },
        
        'we should get true on delete success': function(result){
          assert.isTrue(result);
        },
        
        'the memstore': {
          topic: function(updatedrec,originalrec,store){
            return store;
          },
          
          'should not contain the record': function(t){
            assert.isObject(t._tables['test']);
            assert.isUndefined(t._tables['test']['testkey']);
          },
          
          'should still have one for the counters': function(t){
            assert.equal(t._counters['test'],1);
          }
        }
      }
    } 
  }
})
.addBatch({
  'When': {
    topic: function(){
      var t = base.Thoth.MemStore.create();
      t.start();
      return t;      
    },
    
    'first creating a set of records': {
      topic: function(store){
        var i, req;
        var me = this;
        var count = 0;
        var f = function(){
          count +=1;
          if(count===9) me.callback();
        };
        for(i=0;i<10;i+=1){
          req = base.Thoth.API.StoreRequest.create({
            bucket: 'test',
            record: {
              prop: 'test_' + i
            },
            requestType: C.ACTION_CREATE
          });
          store.createDBRecord(req,{},f);
        }
      },
      
      'returning the last record': function(rec){
        sys.log('returning last rec: ' + sys.inspect(rec));
      },
      
      'and then fetch': {
        topic: function(store){
          var req = base.Thoth.API.StoreRequest.create({
            bucket: 'test',
            requestType: C.ACTION_FETCH
          });
          store.fetchDBRecords(req,{},this.callback);
        },
        
        'the store should return all records': function(data){
          assert.isArray(data);
          assert.lengthOf(data,10);
        }
      }
    }
  }
})
.run();

/*

MemStore: a store in memory for temporary purposes.




var Tools = require('./Tools');
var sys = Tools.sys;
var junctionrels = require('./mixins/junctionrelations').RelationsByJunctionTable;
var Store = require('./Store').Store;

var API = require('./API');

exports.MemStore = Store.extend(junctionrels,{
  
  useAutoIncrementIndex: true,
  
  _tables: null,
  
  _counters: null,
  
  _indexes: null,
    
  start: function(){ //init
    sys.log('Thoth MemStore: initialising...');
    this._tables = {};
    this._counters = {};
    this._indexes = {};
  },
  
  // This function is essential for a properly working memory store. 
  // The data needs to be copied onto a new object, because if the object itself would be stored, 
  // the relations that are merged with it later on will also magically appear in the store
  // which should not happen of course.
  
  
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
  
  
  createDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        requestedKey = storeRequest.key,
        primKey = API.getPrimaryKey(storeRequest),
        recdata = storeRequest.recordData;
    
    if(!this._tables[bucket]) this._tables[bucket] = {}; // create bucket if it doesn't exist
    if(this.useAutoIncrementIndex){
      if(!this._counters[bucket]) this._counters[bucket] = 0;
      this._counters[bucket] += 1;
    } 

    var newid = requestedKey || this._counters[bucket];
    recdata[primKey] = newid;
    
    this._tables[bucket][newid] = Tools.copy(recdata);

    if(callback) callback(null,recdata);
  },
  
  updateDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = API.getPrimaryKey(storeRequest),
        key = storeRequest.key,
        recdata = storeRequest.recordData;
    
    //sys.log('Memstore: update record: recorddata: ' + sys.inspect(recdata));
    if(this.useAutoIncrementIndex && (this._counters[bucket] > key)){
      // warn but allow, and update max key to prevent overwriting existing records
      sys.log('Thoth.MemStore: trying to implicitly creating records! (Update with a primaryKey value larger than known values for this resource)');
      this._counters[bucket] = key; 
    }
    if(this._tables && this._tables[bucket]){
      this._tables[bucket][key] = Tools.copy(recdata);
      if(callback) callback(null,recdata);
    }
    else if(callback) callback(new Error("table doesn't exist in memory, create a record first before updating it"),null);
  },
  
  deleteDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = API.getPrimaryKey(storeRequest),
        key = storeRequest.key;
        
    delete this._tables[bucket][key];
    if(callback) callback(null,YES);
  },
  
  fetchDBRecords: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        rec,i,
        recs = [],
        maxIndex = this._counters[bucket],
        tabledata = this._tables[bucket];
    
    if(tabledata){
      if(this.useAutoIncrementIndex){
        for(i=1;i<=maxIndex;i++){
          rec = tabledata[i];
          if(rec) recs.push(rec);
        }        
      }
      else {
        for(i in tabledata){
          if(tabledata.hasOwnProperty(i)) recs.push(tabledata[i]);
        }
      }
    }
    
    if(callback) callback(null,recs);
  },
  
  refreshDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        key = storeRequest.key,
        primKey = API.getPrimaryKey(storeRequest),
        bucketData = this._tables[bucket],
        rec = bucketData? bucketData[key]: null;
        
    if(rec){
      if(!rec.key) rec.key = rec[primKey];
      if(!rec.id) rec.id = rec[primKey];    
    }
    //sys.log('MemStore: rec: ' + sys.inspect(rec));
    //if(rec && callback) callback(null,rec);
    if(callback) callback(null,rec);  
  }
  
});
*/