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
var junctionBucket = 'exam_student';

var makeStoreReq = function(data,method){
  var APIReq = Thoth.API.APIRequest.from(data,C.SOURCE_THOTH,method);
  return Thoth.API.StoreRequest.from(APIReq);
};

var getStoreWith = function(cb){
  var store = FakeStore.create({
    cb: function(sr,client,callback){
      cb(null,sr,callback);
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
        var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
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
    'isChildRecord and isMaster set to true and type toOne should retrieve a single record': {
      topic: function(){
        var store = getStoreWith(this.callback);
        var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
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
    },
    
    // this should first fetch the relation record from the junction table, then actually retrieve the record if found
    'isChildRecord and isMaster set to false and type toOne should first fetch the junction table, then retrieve the record': {
      topic: function(){
        var store = getStoreWith(this.callback);
        var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
        sr.relations[0].type = 'toOne';
        sr.relations[0].keys = 1;
        sr.relations[0].isMaster = false;
        sr.relations[0].isDirectRelation = true;
        store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc);
      },
      
      'should call retrieveDBRecord with the relation request': function(t,cb){
        var reqt = t.get('requestType');
        assert.isTrue( (reqt === C.ACTION_FETCH) || (reqt === C.ACTION_REFRESH) );
        if(t.get('requestType') === C.ACTION_FETCH){ // junction stuff
          assert.strictEqual(t.bucket,junctionBucket);
          assert.isTrue(t.conditions.search('student_id') !== -1);
          assert.deepEqual(t.parameters.keys, [1]);
          cb([{'student_id': 1, 'exam_id': 1}]);
        }
        else {
          assert.strictEqual(t.bucket,relationBucket);
          assert.strictEqual(t.key,1);
        }
      }
    },    
    
    'isMaster set to true and type toOne should fetch a junction table record': {
      topic: function(){
        var store = getStoreWith(this.callback);
        var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
        sr.relations[0].type = 'toOne';
        sr.relations[0].keys = 1;
        sr.relations[0].isMaster = true;
        store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc);         
      }
    }
  }
}).run();