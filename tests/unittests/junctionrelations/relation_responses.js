var testbase = require('../../testbase');
var assert = testbase.assert;
var Thoth = testbase.Thoth;
var C = Thoth.Constants;
var junctionrelationstest = testbase.vows.describe("junction relations relation tests");
var createRequest = require('./test_data').createRequest;
var FakeStore = require('./fake_store').FakeStore;
var sys = require('util');

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
    //testbase.log('arguments before unshift: ' + testbase.inspect(arguments));
    var args = Array.prototype.slice.call(arguments);
    args.unshift(null);
    cb.apply(this,args);
    //testbase.log('applying arguments: ' + testbase.inspect(args));
    // var t = Array.prototype.unshift.apply(arguments,null);
    // testbase.log('arguments after unshift ' + testbase.inspect(arguments));
    // testbase.log('arguments has unshift? ' + testbase.inspect(arguments.unshift));
    //cb.apply(this,arguments);
  };
};

var getStoreWith = function(cb){
  var f = function(sr,client,callback){
     cb(null,sr,callback);
  };
  
  var store = FakeStore.create({
     cb: f
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
            assert.strictEqual(t.bucket,junctionBucket);
            assert.strictEqual(t.conditions,"student_id ANY {keys}");
            assert.isArray(t.parameters.keys);
            assert.deepEqual(t.parameters.keys,[1]);
          }
          
        },
        
        'should call the refreshDBRecord function if it is given return data': {
          topic: function(){
            var store = getStoreWith(this.callback);
            store.fetchDBRecords = function(t,source,cb){
              cb(null,[{student_id: 1, exam_id: 4}]);
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
            assert.strictEqual(t.key,4);
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
           assert.strictEqual(t.conditions,"student_id ANY {keys}");
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
             assert.strictEqual(t.conditions,"student_id ANY {keys}");
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
               if(count === 1) cb(null,[{student_id: 1, exam_id: 4}, {student_id: 1, exam_id: 5}]);
               else store.cb.apply(store,arguments); // forward to callback
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
             assert.strictEqual(t.conditions,"id ANY {keys}");
             assert.isArray(t.parameters.keys);
             assert.deepEqual(t.parameters.keys, [4,5]);
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
           assert.strictEqual(t.conditions,"student_id ANY {keys}");
           assert.isArray(t.parameters.keys);
           assert.deepEqual(t.parameters.keys,[1]);
         }
       }          
     }
   }
})
.addBatch({
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
          store.fetchRelation(sr,{id: 1, exam_id: 4}, sr.relations[0],emptyFunc());
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
            store.fetchRelation(sr,{id: 1, exam_id: 4}, sr.relations[0],emptyFunc());
          },
        
          'and the correct search data': function(t){
            //testbase.log('arguments to 277: ' + testbase.inspect(arguments,false,5));
            assert.equal(t.requestType,C.ACTION_REFRESH);
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.key,4);
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
            sr.relations[0].isMaster = false; 
            sr.relations[0].isChildRecord = false;
            sr.relations[0].isDirectRelation = true;
            store.fetchRelation(sr,{id: 1}, sr.relations[0],emptyFunc());
          },
        
          'and the correct search data': function(t){
            assert.strictEqual(t.bucket,relationBucket);
            assert.strictEqual(t.conditions, 'student_id ANY {keys}');
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
            assert.strictEqual(t.conditions, 'student_id ANY {keys}');
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
            assert.strictEqual(t.conditions, 'student_id ANY {keys}');
            assert.isArray(t.parameters.keys);
            assert.deepEqual(t.parameters.keys,[1]);
          }
        }      
      }      
    }     
  }
})
.addBatch({
  'fetchRelation responses': {
    'to an indirect relation': { //fetchRelation responses
        'which is toOne': { // fetchRelation responses to an indirect relation
            'and having isChildRecord true': {
              'should return a single record': { 
                // when the relation is in the junction table and the data is in the relation table
                // also when multiple records exists(?)
                topic: function(){
                  var store = getStoreWith();
                  store.fetchDBRecords = function(sr,ci,cb){
                    if(sr.bucket === junctionBucket){
                      cb(null,[{student_id: 1, exam_id: 4}, {student_id: 1, exam_id: 5}]);  
                    }
                    else cb(null,[{id: 5, passed: false }]);                    
                  };                  
                  var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                  sr.relations[0].type = 'toOne';
                  sr.relations[0].isMaster = true;
                  sr.relations[0].propertyName = 'exams';
                  sr.relations[0].propertyKey = 'exam_ids';
                  sr.relations[0].isChildRecord = true;
                  sr.relations[0].isDirectRelation = false;
                  var mycb = makeVowsCallbackWrapper(this.callback);
                  store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
                },
                
                'containing the correct data': function(t){ // gives back a relation set, so check the contents...
                  assert.equal(t.propertyName,'exams');
                  assert.equal(t.propertyKey,'exam_ids');
                  assert.isArray(t.keys);
                  assert.isTrue(t.keys.length === 1);
                  assert.isFalse(t.data[t.keys[0]].passed);
                  //assert.isTrue(t.passed);
                }
              },
            
              'should return null': {
                // when the relation is in the junction table, but the relation does not exist.
                topic: function(){
                  var store = getStoreWith();
                  store.fetchDBRecords = function(sr,ci,cb){
                    if(sr.bucket === junctionBucket) cb(null,[{student_id: 1, exam_id: 4}, {student_id: 1, exam_id: 5}]);
                    else cb(null,[]);
                  };
                  // store.refreshDBRecord = function(sr,ci,cb){
                  //   cb(null,null);
                  // };
                  var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                  sr.relations[0].type = 'toOne';
                  sr.relations[0].isMaster = true;
                  sr.relations[0].isChildRecord = true;
                  sr.relations[0].isDirectRelation = false;
                  var mycb = makeVowsCallbackWrapper(this.callback);
                  store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
                },
              
                'when the relation is in the junction table, but the relation does not exist': function(t){
                  assert.isArray(t.keys);
                  assert.isTrue(t.keys.length === 1);
                  assert.isNull(t.data[t.keys[0]]);
                }            
              },
            
              'should return an empty array': { // when the relation is not in the junction table
                topic: function(){
                  var store = getStoreWith();
                  store.fetchDBRecords = function(sr,ci,cb){
                    cb(null,[]);
                  };
                  var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                  sr.relations[0].type = 'toOne';
                  sr.relations[0].isMaster = true;
                  sr.relations[0].isChildRecord = true;
                  sr.relations[0].isDirectRelation = false;
                  var mycb = makeVowsCallbackWrapper(this.callback);
                  store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
                },
              
                'when the relation is not in the junction table': function(t){
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
                    cb(null,[{student_id: 1, exam_id: 4},{student_id: 1, exam_id: 5}]);
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
                  assert.strictEqual(t.data[t.keys[0]],5); // toOne only returns the last of the junctionrecs
                }
              },
            
              'should return an empty array': {
                // when no relation can be found
                topic: function(){
                  var store = getStoreWith();
                  store.fetchDBRecords = function(sr,ci,cb){
                    cb(null,[]);
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
                    cb(null,[{student_id: 1, exam_id: 4},{student_id: 1, exam_id: 5}, {student_id: 2, exam_id: 6}]);                  
                  }
                  else cb(null,[{id: 4, passed: true}, {id: 5, passed: false }]);
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
                assert.isTrue(t.keys.length === 1);
                assert.deepEqual(t.data, { 1: [{id: 4, passed: true}, { id: 5, passed: false } ]});
              }            
            },
          
            'should return an array with only the full records': {
              //when only a few of the found relation ids can be found in the relation table
              topic: function(){
                var store = getStoreWith();
                store.fetchDBRecords = function(sr,ci,cb){
                  if(sr.bucket === junctionBucket){
                    cb(null,[{student_id: 1, exam_id: 4},{student_id: 1, exam_id: 5}]);                  
                  }
                  else cb(null,[{id: 5, passed: false }]);
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
                 assert.isTrue(t.keys.length === 1);
                 assert.deepEqual(t.data, { 1: [{id: 5, passed: false} ]});
               } 
             
             },
          
            'should return an empty array': {
              // when no relation can be found
              topic: function(){
                var store = getStoreWith();
                store.fetchDBRecords = function(sr,ci,cb){
                  cb(null,[]);
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
                  cb(null,[{student_id: 1, exam_id: 4},{student_id: 1, exam_id: 5}]);                  
                };
                var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                sr.relations[0].type = 'toMany';
                sr.relations[0].isMaster = true;
                sr.relations[0].isChildRecord = false;
                sr.relations[0].isDirectRelation = false;
                var mycb = makeVowsCallbackWrapper(this.callback);
                store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
              },
            
              'containing the correct data': function(t){
                assert.isArray(t.keys);
                assert.isTrue(t.keys.length === 1);
                assert.deepEqual(t.data, { 1: [4,5] });
              }            
            },
          
            'should return an empty array': {
              // when no relations can be found
              topic: function(){
                var store = getStoreWith();
                store.fetchDBRecords = function(sr,ci,cb){
                  cb(null,[]);                  
                };
                var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                sr.relations[0].type = 'toMany';
                sr.relations[0].isMaster = true;
                sr.relations[0].isChildRecord = false;
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
      },
      
    'to a direct relation': { //fetchRelation responses
      'which is toOne': {
        'having isChildRecord true': {
          'and isMaster is true': {
             'should return a single record': {
               // when a child record is found
               topic: function(){
                 var store = getStoreWith();
                 store.refreshDBRecord = function(sr,ci,cb){
                   cb(null,{id: 4, passed: true});                  
                 };
                 var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                 sr.relations[0].type = 'toOne';
                 sr.relations[0].isMaster = true;
                 sr.relations[0].isChildRecord = true;
                 sr.relations[0].isDirectRelation = true;
                 var mycb = makeVowsCallbackWrapper(this.callback);
                 store.fetchRelation(sr,{id: 1, exam_id: 4}, sr.relations[0],mycb);
               },
             
               'when a child record is found': function(t){
                // testbase.log('arguments to 638: ' + testbase.inspect(arguments,false,5));
                 assert.isArray(t.keys);
                 assert.isTrue(t.keys.length === 1);
                 assert.deepEqual(t.data[t.keys[0]], {id: 4, passed: true});
                 // assert.isTrue(t.keys.length === 2);
               }
             },
           
             'should return null': {
               // when a child record is not found
               topic: function(){
                 var store = getStoreWith();
                 store.refreshDBRecord = function(sr,ci,cb){
                   cb(null,null);                  
                 };
                 var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                 sr.relations[0].type = 'toOne';
                 sr.relations[0].isMaster = true;
                 sr.relations[0].isChildRecord = true;
                 sr.relations[0].isDirectRelation = true;
                 var mycb = makeVowsCallbackWrapper(this.callback);
                 store.fetchRelation(sr,{id: 1, exam_id: 4}, sr.relations[0],mycb);
               },
                 
               'should contain the correct data': function(t){
                 assert.isArray(t.keys);
                 assert.isTrue(t.keys.length === 1);
                 assert.isNull(t.data[t.keys[0]]);
                 // assert.isTrue(t.keys.length === 2);
               }
             }
           },
        
          'and isMaster is false': {
            'should return a single record': {
              // when a child record is found
              topic: function(){
                var store = getStoreWith();
                store.fetchDBRecords = function(sr,ci,cb){
                  cb(null,[{id: 4, student_id: 1, passed: true}]);  
                };
                var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                sr.relations[0].type = 'toOne';
                sr.relations[0].isMaster = false;
                sr.relations[0].isChildRecord = true;
                sr.relations[0].isDirectRelation = true;
                var mycb = makeVowsCallbackWrapper(this.callback);
                store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
              },
              
              'should contain the correct data': function(t){              
                assert.isArray(t.keys);
                assert.isTrue(t.keys.length === 1);
                assert.deepEqual(t.data[t.keys[0]], {id: 4, student_id: 1, passed: true });
              }            
            },
              
            'should return null': {
               // when there is no opposite side...
               topic: function(){
                 var store = getStoreWith();
                 store.fetchDBRecords = function(sr,ci,cb){
                   cb(null,[]);                  
                 };
                 var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                 sr.relations[0].type = 'toOne';
                 sr.relations[0].isMaster = false;
                 sr.relations[0].isChildRecord = true;
                 sr.relations[0].isDirectRelation = true;
                 var mycb = makeVowsCallbackWrapper(this.callback);
                 store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
               },
                 
               'should contain the correct data': function(t){
                 assert.isArray(t.keys);
                 assert.isTrue(t.keys.length === 1);
                 assert.isNull(t.data[t.keys[0]]);
               }            
             }          
          }
        },
      
        'having isChildRecord false': {
           // isMaster should be false anyway here, as the relation is not retrievable with isMaster = true
           'should return a single key': {
             // when a child record is found
             topic: function(){
               var store = getStoreWith();
               store.fetchDBRecords = function(sr,ci,cb){
                 cb(null,[{id: 4, student_id: 1, passed: true}]);                  
               };
               var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
               sr.relations[0].type = 'toOne';
               sr.relations[0].isMaster = false;
               sr.relations[0].isChildRecord = false;
               sr.relations[0].isDirectRelation = true;
               var mycb = makeVowsCallbackWrapper(this.callback);
               store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
             },
               
             'should contain the correct data': function(t){
               //testbase.log('arguments to line 736: ' + testbase.inspect(arguments,false,5));                 
               assert.isArray(t.keys);
               assert.isTrue(t.keys.length === 1);
               assert.equal(t.data[t.keys[0]], 4);
             }
           },
               
           'should return null': {
             // when there is no opposite side...
             topic: function(){
               var store = getStoreWith();
               store.fetchDBRecords = function(sr,ci,cb){
                 cb(null,[]);                  
               };
               var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
               sr.relations[0].type = 'toOne';
               sr.relations[0].isMaster = false;
               sr.relations[0].isChildRecord = true;
               sr.relations[0].isDirectRelation = true;
               var mycb = makeVowsCallbackWrapper(this.callback);
               store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
             },
               
             'should contain the correct data': function(t){
               assert.isArray(t.keys);
               assert.isTrue(t.keys.length === 1);
               assert.isNull(t.data[t.keys[0]]);
             }
           }        
         }
      },
    
      'which is toMany': {
        'having isChildRecord true': {
          'and isMaster is true': {
            'should return an array of objects': {
              // when records are found
              topic: function(){
                var store = getStoreWith();
                store.fetchDBRecords = function(sr,ci,cb){
                  cb(null,[{id: 4, passed: true},{ id: 5, passed: false }, { id: 6, passed: true }]);                  
                };
                var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                sr.relations[0].type = 'toMany';
                sr.relations[0].isMaster = true;
                sr.relations[0].isChildRecord = true;
                sr.relations[0].isDirectRelation = true;
                var mycb = makeVowsCallbackWrapper(this.callback);
                store.fetchRelation(sr,{id: 1, exam_ids: [4,5]}, sr.relations[0],mycb);
              },
      
              'should contain the correct data': function(t){
                //testbase.log('arguments to line 788: ' + testbase.inspect(arguments));
                assert.isArray(t.keys);
                assert.isTrue(t.keys.length === 1);
                assert.equal(t.keys[0],1);
                assert.deepEqual(t.data[t.keys[0]], [{id: 4, passed: true },{ id: 5, passed: false }]);
              }
            },
          
            'should return an empty array': {
              // should return an array of null values when relations cannot be found
              topic: function(){
                var store = getStoreWith();
                store.fetchDBRecords = function(sr,ci,cb){
                  cb(null,[]);                  
                };
                var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                sr.relations[0].type = 'toMany';
                sr.relations[0].isMaster = true;
                sr.relations[0].isChildRecord = true;
                sr.relations[0].isDirectRelation = true;
                var mycb = makeVowsCallbackWrapper(this.callback);
                store.fetchRelation(sr,{id: 1, exam_ids: [4,5]}, sr.relations[0],mycb);
              },
                  
              'when relations cannot be found': function(t){
                assert.isArray(t.keys);
                assert.isTrue(t.keys.length === 1);
                assert.deepEqual(t.data[t.keys[0]], []);
              }
            }
          
          },
        
          'and isMaster is false': {
             'should return an array of objects': {
               // when records are found
               topic: function(){
                 var store = getStoreWith();
                 store.fetchDBRecords = function(sr,ci,cb){ // give extra useless data...
                   cb(null,[{id: 4, student_id: 1, passed: true},
                       {id: 5, student_id: 1, passed: false }, 
                       {id: 6, student_id: 2, passed: true }]);                  
                 };
                 var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                 sr.relations[0].type = 'toMany';
                 sr.relations[0].isMaster = false;
                 sr.relations[0].isChildRecord = true;
                 sr.relations[0].isDirectRelation = true;
                 var mycb = makeVowsCallbackWrapper(this.callback);
                 store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
               },
               
               'should contain the correct data': function(t){
                 assert.isArray(t.keys);
                 assert.isTrue(t.keys.length === 1);
                 assert.deepEqual(t.data[t.keys[0]], [{id: 4, student_id: 1, passed: true }, { id: 5, student_id: 1, passed: false }]);
               }
             },
           
             'should return an empty array': {
               // when relation cannot be found
               topic: function(){
                 var store = getStoreWith();
                 store.fetchDBRecords = function(sr,ci,cb){ // give extra useless data...
                   cb(null,[{ id: 3, student_id: 2, passed: true }]); 
                 };
                 var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
                 sr.relations[0].type = 'toMany';
                 sr.relations[0].isMaster = false;
                 sr.relations[0].isChildRecord = true;
                 sr.relations[0].isDirectRelation = true;
                 var mycb = makeVowsCallbackWrapper(this.callback);
                 store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
               },
               
               'should contain the correct data': function(t){
                 assert.isArray(t.keys);
                 assert.isTrue(t.keys.length === 1);
                 //assert.deepEqual(t.data[t.keys[0]], [{id: 1, passed: true }, { id: 2, passed: false }]);
                 assert.isEmpty(t.data[t.keys[0]]);
               }            
             }
           }
         
         },
               
         'having isChildRecord false': {
           // only isMaster is false is retrievable
           'should return an array of keys': {
             // when relation is found
             topic: function(){
               var store = getStoreWith();
               store.fetchDBRecords = function(sr,ci,cb){ // give extra useless data...
                 cb(null,[{id: 4, student_id: 1, passed: true},{ id: 5, student_id: 1, passed: false }, { id: 6, student_id: 2, passed: true }]);                  
               };
               var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
               sr.relations[0].type = 'toMany';
               sr.relations[0].isMaster = false;
               sr.relations[0].isChildRecord = false;
               sr.relations[0].isDirectRelation = true;
               var mycb = makeVowsCallbackWrapper(this.callback);
               store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
             },
               
             'should contain the correct data': function(t){
               assert.isArray(t.keys);
               assert.isTrue(t.keys.length === 1);
               assert.deepEqual(t.data[t.keys[0]], [ 4,5 ]);
             }
           },
         
           'should return an empty array': {
             // when relation is not found
             topic: function(){
               var store = getStoreWith();
               store.fetchDBRecords = function(sr,ci,cb){ // give extra useless data...
                 cb(null,[{ id: 3, student_id: 2, passed: true }]);                  
               };
               var sr = makeStoreReq(createRequest(),C.ACTION_FETCH);
               sr.relations[0].type = 'toMany';
               sr.relations[0].isMaster = false;
               sr.relations[0].isChildRecord = false;
               sr.relations[0].isDirectRelation = true;
               var mycb = makeVowsCallbackWrapper(this.callback);
               store.fetchRelation(sr,{id: 1}, sr.relations[0],mycb);
             },
               
             'should contain the correct data': function(t){
               assert.isArray(t.keys);
               assert.isTrue(t.keys.length === 1);
               assert.deepEqual(t.data[t.keys[0]], []);
             }          
           }
        }      
      }
    }
  }
})
// Create relation
// if isMaster is false, create should create
// test order:
// - first all junction requests: (isDirectRelation === false)
//   - with toOne 
//     - with isChildRecord true: 
//        create the opposite record from the childrecords data if no id is given
//        create a record in the junction table, put the id on the childrecord data and return
//     - with isChildRecord false
//        create a record in the junction table with the main pk and the opposite pk
//   - with toMany
//     - with isChildRecord true
//        create the opposite records if they do not already exist, create the records in the junction
//        tables and return
//     - with isChildRecord false
//        create the records in the junction table with the main pk and the opposite pks
// - then all direct requests: (isDirectRelation === true)
//   - with toOne
//     - with isChildRecord true
//        if the opposite record exist, do nothing. else create the opposite record and give back the data with an id?
//     - with isChildRecord false
//        do nothing, the user is responsible for creating the opposite record
//   - with toMany
//     - with isChildRecord true
//        if the opposite records exist, do nothing, else perhaps create the opposite records and give back the data with ids?
//     - with isChildRecord false
//        do nothing, the user is responsible
.addBatch({
  'createRelation': {
    'given an indirect relation': {
      
      'which has isMaster to false': {
        topic: function(){
          var store = getStoreWith();
          var req = createRequest();
          req.record = {
            prop: 'test',
            exam: {
              someval: 'testval'
            }
          };
          var sr = makeStoreReq(req,C.ACTION_CREATE);
          sr.relations[0].isMaster = false;
          return store.createRelation(sr,sr.record,sr.relations[0]);
        },
        
        'should return false': function(t){
          assert.isFalse(t);
        }
      },
      'which is toOne': {
        'and has isChildRecord true': {
          'should try to create the record': { 
            topic: function(){ 
              // create a store, perform the request and check whether createDBRecord is called
              var store = getStoreWith(this.callback);
              var req = createRequest();
              //req.key = 1;
              req.record = {
                 exam: {
                    date: 'exam_date'
                 }
              };
              var sr = makeStoreReq(req,C.ACTION_CREATE);
              sr.relations[0].propertyName = 'exam';
				      sr.relations[0].isChildRecord = true;
							sr.relations[0].isDirectRelation = false;
							sr.relations[0].isMaster = true;
              store.createRelation(sr,sr.record,sr.relations[0]);
            },
      
            'if the id is not given': function(t){
               assert.isObject(t);
               assert.equal(t.bucket,'exam');
               assert.equal(t.record.date,'exam_date');
            },
            
            'and return the id': {
              topic: function(){
                // fake the store requests to create a relation, give back an id for the created record 
                // and then check whether the callback to the store contains the id
                var store = getStoreWith();
                var req = createRequest();
                //req.key = 1;
                req.record = {
                   exam: {
                      date: 'exam_date'
                   }
                };
                var sr = makeStoreReq(req,C.ACTION_CREATE);
		            sr.relations[0].propertyName = 'exam';
					      sr.relations[0].isChildRecord = true;
								sr.relations[0].isDirectRelation = false;
								sr.relations[0].isMaster = true;

                store.createDBRecord = function(storeReq,clientId,callback){
                  var rec = storeReq.record;
                  rec.id = 1;
									sys.log('fake createDBRecord called...');
                  callback(null,rec);
                };
                store.createRelation(sr,sr.record,sr.relations[0],{},this.callback);
                //return true;
              },
              
              'as part of the child record': function(t){
                assert.isObject(t);
								assert.equal(t.id,1);
              }
            }
          },
          
          'should not try to create the record': { 
            topic: function(){ 
              // create a store, perform the request and expect createDBRecord not to be called
              // but the callback on a different spot...
							var store = getStoreWith();
							store.createDBRecord = function(sr,ud,cb){
								throw(new Error('this should NOT be called'));
							};
							var req = createRequest();
							req.key = 1;
							req.record = {
								exam: {
												date: 'exam_date'
											}
							};
							var sr = makeStoreReq(req,C.ACTION_CREATE);
							sr.relations[0].propertyName = 'exam';
							sr.relations[0].isChildRecord = true;
							sr.relations[0].isDirectRelation = false;
							sr.relations[0].isMaster = true;
						  store.createRelation(sr,sr.record,sr.relations[0],{},this.callback);
            },
            'if the id is given': function(t){
              assert.isObject(t); 
            }
          },
          
          'should update the relation table': {
            topic: function(){
              // create a store, put in a request with an id, and check whether:
              // - retrieveDBRecord is called for attempt to check whether the relation record exists
							//   (only when key is given)
              // - createDBRecord to be called to create the relation record
              return true;
            },
            
            'to contain the new relation': function(t){
              
            }
          }
          
        },
        
        'and has isChildRecord false': {
          
        }
        
      },
      
      'which is toMany': {
        'and has isChildRecord true': {
          
        },
        
        'and has isChildRecord false': {
          
        }        
      }
    }
    
  },
  
  'createRelation given a direct relation': {
     topic: function(){
          var store = getStoreWith();
          var req = createRequest();
          req.record = {
            prop: 'test',
            exam: {
              someval: 'testval'
            }
          };
          var sr = makeStoreReq(req,C.ACTION_CREATE);
          sr.relations[0].isMaster = true;
          sr.relations[0].isDirectRelation = true;
          return store.createRelation(sr,sr.record,sr.relations[0]);
     },
     
     'should do nothing by default': function(t){
       assert.isFalse(t);
     }
   }
})
// Update relations
// test order:
// - first all junction requests: (isDirectRelation === false)
//   - with toOne
//     - with isChildRecord true
//        take the child record data, and id, create one if it didn't exist already
//        delete the child record data if it was originally there
//        update the relation table
//     - with isChildRecord false
//        update the relation table
//   - with toMany
//     - with isChildRecord true
//        take the child record data and update the records, create the new ones or destroy the deleted ones
//        update the relation table
//     - with isChildRecord false
// - then all direct requests: (isDirectRelation === true)
//   - with toOne
//     - with isChildRecord true
//     - with isChildRecord false
//   - with toMany
//     - with isChildRecord true
//     - with isChildRecord false

// .addBatch({
//   'updateRelation': {
//     'given an indirect relation': {
//       
//       'which has isMaster to false': {
//         topic: function(){
//           var store = getStoreWith();
//           var req = createRequest();
//           req.key = 1;
//           req.record = {
//             id: 1,
//             exam: {
//               date: 'exam_date'
//             }
//           };
//           var sr = makeStoreReq(createRequest(),C.ACTION_UPDATE);
//           sr.relations[0].isMaster = false;
//           return store.createRelation(sr);
//         },
//         
//         'should return false': function(t){
//           assert.isFalse(t);
//         }
//       },
//       
//       'which is toOne': {
//         
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }
//         
//       },
//       
//       'which is toMany': {
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }        
//       }
//     },
//     
//     'given a direct relation': {
//       'which is toOne': {
//         
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }
//         
//       },
//       
//       'which is toMany': {
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }        
//       }
//     }
//   }
// })
// .addBatch({
//   'destroyRelation': {
//     'given an indirect relation': {
//       
//       'which has isMaster to false': {
//         topic: function(){
//           var store = getStoreWith();
//           var req = createRequest();
//           req.key = 1;
//           req.record = {
//             id: 1,
//             prop: 'someval'
//           };
//           var sr = makeStoreReq(req,C.ACTION_DELETE);
//           sr.relations[0].isMaster = false;
//           return store.createRelation(sr);
//         },
//         
//         'should return false': function(t){
//           assert.isFalse(t);
//         }
//       },
//       'which is toOne': {
//         
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }
//         
//       },
//       
//       'which is toMany': {
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }        
//       }
//     },
//     
//     'given a direct relation': {
//       'which is toOne': {
//         
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }
//         
//       },
//       
//       'which is toMany': {
//         'and has isChildRecord true': {
//           
//         },
//         
//         'and has isChildRecord false': {
//           
//         }        
//       }
//     }
//   }
// })




.run();    
    
    
    // test order:
    // - first all junction requests: (isDirectRelation === false)
    //   - with toOne
    //     - with isChildRecord true
    //     - with isChildRecord false
    //   - with toMany
    //     - with isChildRecord true
    //     - with isChildRecord false
    // - then all direct requests: (isDirectRelation === true)
    //   - with toOne
    //     - with isChildRecord true
    //     - with isChildRecord false
    //   - with toMany
    //     - with isChildRecord true
    //     - with isChildRecord false
    
    
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

