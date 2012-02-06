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

var makeVowsCallbackWrapper = function(cb){
  return function(){
    testbase.log('arguments before unshift: ' + testbase.inspect(arguments));
    var args = Array.prototype.slice.call(arguments);
    args.unshift(null);
    cb.apply(this,args);
    testbase.log('applying arguments: ' + testbase.inspect(args));
    // var t = Array.prototype.unshift.apply(arguments,null);
    // testbase.log('arguments after unshift ' + testbase.inspect(arguments));
    // testbase.log('arguments has unshift? ' + testbase.inspect(arguments.unshift));
    //cb.apply(this,arguments);
  };
};

var getStoreWith = function(cb){
  var store = FakeStore.create({
    cb: function(sr,client,callback){
      cb(null,sr,callback);
    }
    //cb: makeVowsCallbackWrapper(cb)
  });
  //stores.push(store);
  return store;
};

var emptyFunc = function(){
  return function(){};
};
//only call *Relation functions...

// main record bucket: student, relation: exam
junctionrelationstest
// .addBatch({
//   'fetchRelation given a relation with': {
//     
//     'isMaster and isDirectRelation set to true': {
//       topic: function(){
//         var store = getStoreWith(this.callback);
//         var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
//         sr.relations[0].type = 'toMany';
//         sr.relations[0].isMaster = true;
//         sr.relations[0].isDirectRelation = true;
//         store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc);
//         return true;
//       },
// 
//       // this is a way to test whether the callback is called when it should not. 
//       // vows doesn't seem to have an official way of making this sure.
//       // I expect this to work all the time, because vows will first finish the topic function, which would automatically
//       // fire the callback first, before returning true.
//       // it seems that it needs a separate batch to work properly though
//       'should not call the fetchDBRecords function': function(t){ 
//         assert.isTrue(t);
//       }
//     }
//   }
// })
.addBatch({
  'fetchRelation given a non-direct relation' : {
    'which is toOne': {
      
      'should not call junctionKeyName': {
        topic: function(){
          var store = getStoreWith(this.callback);
          store.junctionKeyName = function(){
            store.cb.apply(store,arguments);
          };
          var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
          sr.relations[0].type = 'toOne';
          sr.relations[0].isMaster = true;
          sr.relations[0].isChildRecord = true;
          sr.relations[0].isDirectRelation = false;
          store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());
        },
        
        'with isPlural === true': function(modelname,modelkey,isPlural){
          if(SC.typeOf(modelname) === 'string') {
            assert.isTrue(!isPlural);
            return [modelname,modelkey].join("_");            
          }
        }
      },

              
      'and has isChildRecord true': {
        'should call fetchDBRecords with the junctiontable': {
          topic: function(){
            var store = getStoreWith(this.callback);
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toOne';
            sr.relations[0].isMaster = true;
            sr.relations[0].isChildRecord = true;
            sr.relations[0].isDirectRelation = false;
            store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());
          },

          'and the correct search data': function(t){
            testbase.log('arguments to line 117: ' + testbase.inspect(arguments));
            assert.strictEqual(t.bucket,junctionBucket);
            assert.strictEqual(t.conditions,"student_id in {keys}");
            assert.isArray(t.parameters.keys);
            assert.deepEqual(t.parameters.keys,[1]);
          }
          
        },
        
        'should call the refreshDBRecord function if it is given return data': {
          topic: function(){
            var store = getStoreWith(this.callback);
            store.fetchDBRecords = function(t,source,cb){
              cb(null,[{student_id: 1, exam_id: 1}]);
            };
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toOne';
            sr.relations[0].isMaster = true;
            sr.relations[0].isChildRecord = true;
            sr.relations[0].isDirectRelation = false;
            store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());               
          },
          
          'and retrieve the correct data': function(t){
            //testbase.log('refreshDBRecord call arguments: ' + testbase.inspect(arguments));
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.key,1);
          }
        }

      },
    
      'and has isChildRecord false': {
        topic: function(){
          var store = getStoreWith(this.callback);
          var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
          sr.relations[0].type = 'toOne';
          sr.relations[0].isMaster = true;
          sr.relations[0].isChildRecord = false;
          sr.relations[0].isDirectRelation = false;
          store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());          
        },
        
        'should call fetchDBRecords with the junctiontable and the correct search data': function(t){
          assert.strictEqual(t.bucket,junctionBucket);
          assert.strictEqual(t.conditions,"student_id in {keys}");
          assert.isArray(t.parameters.keys);
          assert.deepEqual(t.parameters.keys,[1]);
        }
      }
    },
  
    'which is toMany': {
      'and has isChildRecord true': {
        'should call fetchDBRecords with the junctiontable':{
          topic: function(){
            var store = getStoreWith(this.callback);
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toMany';
            sr.relations[0].isMaster = true;
            sr.relations[0].isChildRecord = true;
            sr.relations[0].isDirectRelation = false;
            store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());
          },

          'and the correct search data': function(t){
            assert.strictEqual(t.bucket,junctionBucket);
            assert.strictEqual(t.conditions,"student_id in {keys}");
            assert.isArray(t.parameters.keys);
            assert.deepEqual(t.parameters.keys,[1]);
          }
        },
        
        'should call the fetchDBRecord function if it is given return data': {
          topic: function(){
            var store = getStoreWith(this.callback);
            var count = 0;
            store.fetchDBRecords = function(t,source,cb){
              count += 1;
              if(count === 1) cb(null,[{student_id: 1, exam_id: 1}, {student_id: 1, exam_id: 2}]);
              else store.callback.apply(store,arguments); // forward to callback
            };
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toMany';
            sr.relations[0].isMaster = true;
            sr.relations[0].isChildRecord = true;
            sr.relations[0].isDirectRelation = false;
            store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());               
          },
          
          'and retrieve the correct data': function(t){
            //testbase.log('fetchDBRecords call arguments: ' + testbase.inspect(arguments));
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.conditions,"id in {keys}");
            assert.isArray(t.parameter.keys);
            assert.deepEqual(t.parameters.keys, [1,2]);
          }
        }        
      },
    
      'and has isChildRecord false': {
        topic: function(){
          var store = getStoreWith(this.callback);
          var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
          sr.relations[0].type = 'toMany';
          sr.relations[0].isMaster = true;
          sr.relations[0].isChildRecord = false;
          sr.relations[0].isDirectRelation = false;
          store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());          
        },

        'should call fetchDBRecords with the junctiontable and the correct search data': function(t){
          assert.strictEqual(t.bucket,junctionBucket);
          assert.strictEqual(t.conditions,"student_id in {keys}");
          assert.isArray(t.parameters.keys);
          assert.deepEqual(t.parameters.keys,[1]);
        }
      }          
    }
  }
}).addBatch({
  'fetchRelation given a direct relation': {
    'which is toOne': {
      'should not call junctionKeyName': {
        topic: function(){
          var store = getStoreWith(this.callback);
          store.junctionKeyName = function(){
            store.cb.apply(store,arguments);
          };
          var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
          sr.relations[0].type = 'toOne';
          sr.relations[0].isMaster = true;
          sr.relations[0].isChildRecord = true;
          sr.relations[0].isDirectRelation = true;
          store.fetchRelation(sr,{id: 1, exam_id: 1}, sr.relations[0],emptyFunc());
        },
        
        'with isPlural': function(modelname,modelkey,isPlural){
          if(SC.typeOf(modelname) === 'string') {
            assert.isTrue(!isPlural);
            return [modelname,modelkey].join("_");            
          }
        }
      },        
      
      // isMaster: true and isChildRecord: false is an unretrievable relation, so don't test
      'and has both isMaster and isChildRecord true': {
        'should call refreshDBRecord with the relation table': {
          topic: function(){
            var store = getStoreWith(this.callback);
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toOne';
            sr.relations[0].isMaster = true;
            sr.relations[0].isChildRecord = true;
            sr.relations[0].isDirectRelation = true;
            store.fetchRelation(sr,{id: 1, exam_id: 1}, sr.relations[0],emptyFunc());
          },
        
          'and the correct search data': function(t){
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.key,1);
          }
        }
      },
    
      'and has isChildRecord false': {
        // only valid with isMaster: false
        'should call fetchDBRecord with the relation table': {
          topic: function(){
            var store = getStoreWith(this.callback);
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toOne';
            sr.relations[0].isMaster = true;
            sr.relations[0].isChildRecord = true;
            sr.relations[0].isDirectRelation = true;
            store.fetchRelation(sr,{id: 1, exam_id: 1}, sr.relations[0],emptyFunc());
          },
        
          'and the correct search data': function(t){
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.conditions, 'student_id in {keys}');
            assert.isArray(t.parameters.keys);
            assert.deepEqual(t.parameters.keys,[1]);

          }
        }        
      }
    },
  
    'which is toMany': {
       // only valid with isMaster: false
      'and has isChildRecord true': {
        'should call fetchDBRecord with the relation table': {
          topic: function(){
            var store = getStoreWith(this.callback);
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toMany';
            sr.relations[0].isMaster = false;
            sr.relations[0].isChildRecord = true;
            sr.relations[0].isDirectRelation = true;
            store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());
          },
        
          'and the correct search data': function(t){
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.conditions, 'student_id in {keys}');
            assert.isArray(t.parameters.keys);
            assert.deepEqual(t.parameters.keys,[1]);

          }
        }        
      },
    
      'and has isChildRecord false': {
        'should call fetchDBRecord with the relation table': {
          topic: function(){
            var store = getStoreWith(this.callback);
            var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
            sr.relations[0].type = 'toMany';
            sr.relations[0].isMaster = false;
            sr.relations[0].isChildRecord = false;
            sr.relations[0].isDirectRelation = true;
            store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());
          },
        
          'and the correct search data': function(t){
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.conditions, 'student_id in {keys}');
            assert.isArray(t.parameters.keys);
            assert.deepEqual(t.parameters.keys,[1]);
          }
        }      
      }      
    }     
  }
}).addBatch({
  'fetchRelation responses': {
    'to an indirect relation': {
      'which is toOne': {
        'and having isChildRecord true': {
          'should return a single record': { 
            // when the relation is in the junction table and the data is in the relation table
            // also when multiple records exists(?)
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([{student_id: 1, exam_id: 1}, {student_id: 1, exam_id: 2}]);
              };
              store.refreshDBRecord = function(sr,ci,cb){
                cb({id: 1, passed: true });
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toOne';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){ // gives back a relation set, so check the contents...
              assert.isArray(t.keys);
              assert.isTrue(t.keys.length === 1);
              assert.isTrue(t.data[t.keys[0]].passed);
              //assert.isTrue(t.passed);
            }
            
          },
          
          'should return an empty record': {
            // when the relation is in the junction table, but the relation does not exist.
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([{student_id: 1, exam_id: 1}, {student_id: 1, exam_id: 2}]);
              };
              store.refreshDBRecord = function(sr,ci,cb){
                cb(null);
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toOne';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isTrue(t.keys.length === 1);
              assert.isEmpty(t.data[t.keys[0]]);
            }            
          },
          
          'should return an empty array': { // when the relation is not in the junction table
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([]);
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toOne';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isTrue(t.keys.length === 0);
            }
          }
        },
        
        'and having isChildRecord false': {
          'should return a key': {
            // when the record id is in the junciton table
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([{student_id: 1, exam_id: 1},{student_id: 1, exam_id: 2}]);
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toOne';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = false;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isTrue(t.keys.length === 1);
              assert.strictEqual(t.keys[0],1);
              assert.strictEqual(t.data[t.keys[0]],1);
            }
          },
          
          'should return an empty array': {
            // when no relation can be found
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([]);
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toOne';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = false;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isEmpty(t.keys);
              assert.isTrue(t.keys.length === 0);
            }
          }
        }
      },
      
      'which is toMany': {
        'and having isChildRecord true': {
          'should return an array with records': {
            //when the relations are in the junction table, and the records are found
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                if(sr.bucket === junctionBucket){
                  cb([{student_id: 1, exam_id: 1},{student_id: 1, exam_id: 2}]);                  
                }
                else cb([{id: 1, passed: true}, {id: 2, passed: false }]);
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toMany';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isTrue(t.keys.length === 2);
              assert.deepEqual(t.data, { 1: {id: 1, passed: true}, 2: {id: 2, passed: false} });
            }            
          },
          
          'should return an array with mix of null and records': {
            //when only a few of the found relation ids can be found in the relation table
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                if(sr.bucket === junctionBucket){
                  cb([{student_id: 1, exam_id: 1},{student_id: 1, exam_id: 2}]);                  
                }
                else cb([{id: 2, passed: false }]);
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toMany';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isTrue(t.keys.length === 2);
              assert.deepEqual(t.data, { 1: null, 2: {id: 2, passed: false} });
            } 
            
          },
          
          'should return an empty array': {
            // when no relation can be found
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([]);
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toMany';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isEmpty(t.keys);
              assert.isEmpty(t.data);
            }
          }
        },
        
        'and having isChildRecord false': {
          'should return an array with record ids': {
            // when the relations are in the junction table
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([{student_id: 1, exam_id: 1},{student_id: 1, exam_id: 2}]);                  
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toMany';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isTrue(t.keys.length === 2);
              assert.deepEqual(t.data, { 1: 1 , 2: 2 });
            }            
          },
          
          'should return an empty array': {
            // when no relations can be found
            topic: function(){
              var store = getStoreWith();
              store.fetchDBRecords = function(sr,ci,cb){
                cb([]);                  
              };
              var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
              sr.relations[0].type = 'toMany';
              sr.relations[0].isMaster = true;
              sr.relations[0].isChildRecord = true;
              sr.relations[0].isDirectRelation = false;
              var mycb = makeVowsCallbackWrapper(this.callback);
              store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
            },
            
            'containing the correct data': function(t){
              assert.isArray(t.keys);
              assert.isEmpty(t.keys);
              assert.isEmpty(t.data);
              // assert.isTrue(t.keys.length === 2);
            }            
          }
        }        
      }
    }
  },
  
  'to a direct relation': {
    'which is toOne': {
      'having isChildRecord true': {

      },
      
      'having isChildRecord false': {
        
      }
    },
    
    'which is toMany': {
      
      'having isChildRecord true': {
        
      },
      
      'having isChildRecord false': {
        
      }      
    }
  }
})
.addBatch({
  'createRelation responses': {
    
  }
})






.run();    
    
    /*
    test order:
    - first all junction requests: (isDirectRelation === false)
      - with toOne
        - with isChildRecord true
        - with isChildRecord false
      - with toMany
        - with isChildRecord true
        - with isChildRecord false
    - then all direct requests: (isDirectRelation === true)
      - with toOne
        - with isChildRecord true
        - with isChildRecord false
      - with toMany
        - with isChildRecord true
        - with isChildRecord false
    */
    
    // 
    // 
    // 'isChildRecord, isDirectRelation and isMaster set to true and type toOne should retrieve a single record': {
    //   topic: function(){
    //     var store = getStoreWith(this.callback);
    //     var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
    //     sr.relations[0].type = 'toOne';
    //     sr.relations[0].keys = 1;
    //     sr.relations[0].isMaster = true;
    //     sr.relations[0].isChildRecord = true;
    //     sr.relations[0].isDirectRelation = true;
    //     store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc);
    //   },
    //   
    //   'should call retrieveDBRecord with the relation request': function(t){
    //     assert.strictEqual(t.get('requestType'), C.ACTION_REFRESH);
    //     assert.equal(t.key, 1);
    //     assert.strictEqual(t.bucket,relationBucket);
    //   }
    // },

