var base = require('../../testbase');
var assert = base.assert;
var baseRequest = base.vows.describe("API basic Request tests");
var API = base.Thoth.API;
var sys = require('util');
var testReq;

var testObj = {
  fieldnames: "test1 test2 test3 test4".w(),
  test1: 'test',
  test2: 2,
  test3: {
    test: 3
  },
  test4: ['test4a','test4b']
};

var relpropTest = {
  specialFields: {
    properties: base.Thoth.API.Property,
    relations: base.Thoth.API.Relation
  },
  fieldnames: "test1 test2 test3 test4 properties relations".w(),
  properties: [ { key: 'one', value: 1 }, { key: 'two', value: 2 }],
  relations: [ { propertyName: "one" }, { propertyName: "two"}]
};

baseRequest.addBatch({
  
  'a baseRequest should copy data': {
    
    topic: function(){
      testReq = API.Request.create(testObj,{
        _copyFields: this.callback
      });
    },
    
    'using _copyFields': function(val){
      assert.isUndefined(val);
    }
  },
    
  'an inited baseRequest with simple data': {
    topic: API.Request.create(testObj),
        
    'should copy primitive values': function(t){
      assert.strictEqual(t.get('test1'),testObj.test1);
      assert.strictEqual(t.get('test2'),testObj.test2);      
    },
    
    'should copy an object property': function(t){
      assert.notStrictEqual(t.get('test3'),testObj.test3); // objects shouldn't be equal, as they would be new...
      assert.deepEqual(t.get('test3'),testObj.test3); // but contents should be the same..
    },
    
    'should copy an array property': function(t){
      assert.notStrictEqual(t.get('test4'),testObj.test4);
      assert.deepEqual(t.get('test4'),testObj.test4);
    },
    
    'should have a _copyFields function': function(t){
      assert.isFunction(t._copyFields);
    }
  },
  
  'an inited baseRequest with relations and properties as special fields': {
    topic: API.Request.create(testObj,relpropTest),
    
    'should have the Property type of objects for properties': function(t){
      assert.isTrue(SC.instanceOf(t.properties[0], base.Thoth.API.Property));
    },
    
    'should have the Relation type of objects for relations': function(t){
      assert.isTrue(SC.instanceOf(t.relations[0],base.Thoth.API.Relation));
    }
  }
  
});

baseRequest.run();