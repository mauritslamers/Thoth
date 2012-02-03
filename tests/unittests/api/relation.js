var base = require('../../testbase');
var assert = base.assert;
var relationTest = base.vows.describe("API relation tests");
var API = base.Thoth.API;
var sys = require('util');

var checkPropIs = function(prop,bool){
  return function(t){
    if(bool) assert.isTrue(t.get(prop));
    else assert.isFalse(t.get(prop));
  };
};

var basicRelation = {
  type: 'toOne',
  oppositeType: 'toMany',
  isNested: false,
  isChildRecord: false,
  isDirectRelation: false,
  isMaster: false,
  orderBy: '',
  bucket: 'exam',
  primaryKey: 'id',
  propertyName: 'exams',
  propertyKey: 'exam_ids'
};

relationTest.addBatch({
  
  "a inited relation": {
    topic: API.Relation.create(),
    
    "should have a schema": function(t){
      assert.isObject(t.schema);
    },
    
    "should have a fieldnames list": function(t){
      assert.isArray(t.fieldnames);
      assert.isNotEmpty(t.fieldnames);
    },
    
    'should have the isToOne helper': base.objectHasComputedProperty('isToOne'),
    'should have the isToMany helper': base.objectHasComputedProperty('isToMany'),
    'should have the isRetrievable helper': base.objectHasComputedProperty('isRetrievable'),
    'should have the isCreatable helper': base.objectHasComputedProperty('isCreatable'),    
    'should have the isUpdatable helper': base.objectHasComputedProperty('isUpdatable'),
    'should have the isDeletable helper': base.objectHasComputedProperty('isDeletable')
    
  },
  
  'a relation having type "toOne"': {
    topic: API.Relation.create(basicRelation, { type:"toOne"}),
    
    'should give true to isToOne': function(t){
      assert.isTrue(t.get('isToOne'));
    },
    
    'should give false to isToMany': function(t){
      assert.isFalse(t.get('isToMany'));
    }
  },
  
  'a relation having type "toMany"': {
    topic: API.Relation.create(basicRelation, { type:"toMany"}),
    
    'should give true to isToMany': function(t){
      assert.isTrue(t.get('isToMany'));
    },
    
    'should give false to isToOne': function(t){
      assert.isFalse(t.get('isToOne'));
    }    
  },
  
  'a relation having isNested set to true': {
    topic: API.Relation.create(basicRelation, { isNested: true }),
    
    'should not be retrievable': checkPropIs('isRetrievable',false),  
    'should not be creatable': checkPropIs('isCreatable',false),
    'should not be updatable': checkPropIs('isUpdatable',false),
    'should not be deletable': checkPropIs('isDeletable',false)

  },
  
  'a relation having isMaster set to false': {
    topic: API.Relation.create({ isMaster: false }),
    
    'should be retrievable': checkPropIs('isRetrievable',true),
    'should not be creatable': checkPropIs('isCreatable',false),
    'should not be updatable': checkPropIs('isUpdatable',false),
    'should not be deletable': checkPropIs('isDeletable',false)
  },
  
  'a relation having isChildRecord set to true': {
    topic: API.Relation.create({ isChildRecord: true }),
    
    'should be retrievable': checkPropIs('isRetrievable',true),
    'should not be creatable': checkPropIs('isCreatable',false),
    'should not be updatable': checkPropIs('isUpdatable',false),
    'should not be deletable': checkPropIs('isDeletable',false)
  },
  
  'a relation having isDirectRelation set to true': {
    topic: API.Relation.create({ isDirectRelation: true }),
        
    'should be retrievable': checkPropIs('isRetrievable',true),
    'should not be creatable': checkPropIs('isCreatable',false),
    'should not be updatable': checkPropIs('isUpdatable',false),
    'should not be deletable': checkPropIs('isDeletable',false)
    
  },
  
  'a relation having isDirectRelation and isMaster set to true': {
    topic: API.Relation.create(basicRelation, { isDirectRelation: true, isMaster: true }),
    
    'should not be retrievable': checkPropIs('isRetrievable',false),  
    'should not be creatable': checkPropIs('isCreatable',false),
    'should not be updatable': checkPropIs('isUpdatable',false),
    'should not be deletable': checkPropIs('isDeletable',false)    
  },
  
  'a relation having isDirectRelation and isMaster set to true and carrying keys': {
    topic: API.Relation.create(basicRelation, { isDirectRelation: true, isMaster: true, keys: [1] }),
    
    'should not be retrievable': checkPropIs('isRetrievable',false),  
    'should not be creatable': checkPropIs('isCreatable',false),
    'should be updatable': checkPropIs('isUpdatable',true),
    'should not be deletable': checkPropIs('isDeletable',false)    
  },
  
  
  'a relation having isDirectRelation, isMaster and isChildRecord set to true, but without keys': {
    topic: API.Relation.create(basicRelation, { isDirectRelation: true, isMaster: true, isChildRecord: true}),
    
    'should be retrievable': checkPropIs('isRetrievable',true),  
    'should be creatable': checkPropIs('isCreatable',true),
    'should not be updatable': checkPropIs('isUpdatable',false),
    'should be deletable': checkPropIs('isDeletable',true)
  },
  
  'a relation having isDirectRelation, isMaster and isChildRecord set to true, but with keys': {
    topic: API.Relation.create(basicRelation, { isDirectRelation: true, isMaster: true, isChildRecord: true, keys: 1}),
    
    'should be retrievable': checkPropIs('isRetrievable',true),  
    'should be creatable': checkPropIs('isCreatable',true),
    'should be updatable': checkPropIs('isUpdatable',true),
    'should be deletable': checkPropIs('isDeletable',true)
  }
  
  
});

relationTest.run();
