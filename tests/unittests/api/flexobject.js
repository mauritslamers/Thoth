var base = require('../../testbase');
var assert = base.assert;
var flexobjtest = base.vows.describe("API FlexObject tests");
var API = base.Thoth.API;
var sys = require('util');
            
//the testing json and data contain falsy values, as the flexobject should only filter out undefined stuff
var testjson = {
  test1: 'test',
  test2: 0,
  test3: {
    test: 3
  },
  test4: ['test4a','test4b']
};

var testObj = {
  test1: 'test',
  test2: 0,
  test3: {
    test: 3
  },
  test4: ['test4a','test4b'],
  test5: ""        
};    

var testFieldnames = {
  fieldnames: "test1 test2 test3 test4".w()
};

var testObjSchema = {
  "type":"object",
  "properties": {
    "test1": {"type":"string"},
    "test2": {"type":"number"},
    "test3": {"type":"object","properties": { "test":{"type":"string" } } },
    "test4": {"type":"array","items":{"type":"string"} }
  }  
};

var testExtendedObjSchema = {
  "type":"object",
  "extends":testObjSchema,
  "properties": {
    "test5": {"type":"string"}
  }
};

flexobjtest.addBatch({
  'an empty FlexObject': {
    topic: API.FlexObject.create(),
    
    'should have a get function': function(t){
      assert.isFunction(t.get);
    },

    'should have a fieldnames list of null': function(t){
      assert.isNull(t.get('fieldnames'));
    },
    
    'should have a json function, which is an uncacheable computed property': function(t){
      assert.isFunction(t.json);
      assert.isTrue(t.json.isProperty);
      assert.isUndefined(t.json.isCacheable);
    },
    
    "'s json function should return an empty object": function(t){
      assert.isEmpty(t.get('json'));
    }
  },
  
  'a FlexObject inited with fieldnames': {
    topic: API.FlexObject.create(testObj,testFieldnames),
    
    'should have the given test properties': function(t){
      assert.isString(t.get('test1'));
      assert.isNumber(t.get('test2'));
      assert.isObject(t.get('test3'));
      assert.isArray(t.get('test4'));
    },
    
    'should return the json with only the defined fields': function(t){
      assert.deepEqual(t.get('json'),testjson);
    }
  },
  
  "a FlexObject inited with a schema": {
    topic: API.FlexObject.create(testObj,{ schema: testObjSchema }),
    
    'should have the given test properties': function(t){
      assert.isString(t.get('test1'));
      assert.isNumber(t.get('test2'));
      assert.isObject(t.get('test3'));
      assert.isArray(t.get('test4'));
    },
    
    'should have a fieldnames list with all properties': function(t){
      assert.deepEqual(t.get('fieldnames'),"test1 test2 test3 test4".w());
    },
    
    'should return the correct json': function(t){
      assert.deepEqual(t.get('json'),testjson);
    }    
  },
  
  "a FlexObject inited with an extended schema": {
    topic: API.FlexObject.create(testObj, { schema: testExtendedObjSchema, _debug: true }),

    'should have a fieldnames list with all properties': function(t){
      var fn = t.get('fieldnames');
      assert.equal(fn.length,5);
      assert.include(fn,'test1');
      assert.include(fn,'test2');
      assert.include(fn,'test3');
      assert.include(fn,'test4');
      assert.include(fn,'test5');
    },
    
    'should return json with all defined properties': function(t){
      var json = base.Thoth.Tools.copy(testjson);
      json['test5'] = '';
      assert.deepEqual(t.get('json'),json);
    }
  }
});


flexobjtest.run();

