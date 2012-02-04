var testbase = require('../../testbase');
var assert = testbase.assert;
var Thoth = testbase.Thoth;
var C = Thoth.Constants;
var junctionrelationstest = testbase.vows.describe("junction relations relation tests");
var createRequest = require('./test_data').createRequest;
var FakeStore = require('./fake_store').FakeStore;

var stores = [];

var mainBucket = 'student';
var relationBucket = 'exam';

var makeStoreReq = function(data,method){
  var APIReq = Thoth.API.APIRequest.from(data,C.SOURCE_THOTH,method);
  return Thoth.API.StoreRequest.from(APIReq);
};

var getStoreWith = function(cb){
  var store = FakeStore.create({
    cb: function(sr,client,callback){
      cb(null,sr);
    }
  });
  stores.push(store);
  return store;
};

var emptyFunc = function(){};
//only call *Relation functions...

// main record bucket: student, relation: exam
junctionrelationstest.addBatch({
  'fetchRelation given a relation with': {
    
    'isMaster and isDirectRelation set to true': {
      topic: function(){
        var store = getStoreWith(this.callback);
        var req = createRequest();
        var sr = makeStoreReq(req,C.ACTION_FETCH);
        sr.relations[0].type = 'toMany';
        sr.relations[0].isMaster = true;
        sr.relations[0].isDirectRelation = true;
        store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc);
        return true;
      },

      // this is a way to test whether the callback is called when it should not. 
      // vows doesn't seem to have an official way of making this sure.
      // I expect this to work all the time, because vows will first finish the topic function, which would automatically
      // fire the callback first, before returning true.
      // it seems that it needs a separate batch to work properly though
      'should not call the fetchDBRecords function': function(t){ 
        assert.isTrue(t);
      }
    }
  }
}).addBatch({

  'fetchRelation given an relation with' : {
    'isChildRecord set to true and type toOne should retrieve a single record': {
      topic: function(){
        var store = getStoreWith(this.callback);
        var req = createRequest();
        var sr = makeStoreReq(req,C.ACTION_FETCH);
        sr.relations[0].type = 'toOne';
        sr.relations[0].keys = 1;
        sr.relations[0].isMaster = true;
        sr.relations[0].isDirectRelation = true;
        store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc);
      },
      
      'should call retrieveDBRecord with the relation request': function(t){
        assert.strictEqual(t.get('requestType'), C.ACTION_REFRESH);
        assert.equal(t.key, 1);
        assert.strictEqual(t.bucket,relationBucket);
      }
    }
  }
}).run();