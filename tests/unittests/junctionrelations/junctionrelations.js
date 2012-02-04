var testbase = require('../../testbase');
var assert = testbase.assert;
var Thoth = testbase.Thoth;
var junctionrelationstest = testbase.vows.describe("junction relations tests");

var FakeStore = require('./fake_store').FakeStore;

junctionrelationstest.addBatch({
  'if the junction relations mixin is mixed in with the store': {
    
    'it should contain': {
      topic: function(){
        return FakeStore.create();
      },
      
      'a default primaryKey value': function(t){
        assert.isTrue(t.primaryKey === 'id');
      },
      
      'fetchRelation': testbase.hasFunction('fetchRelation'),
      
      'createRelation': testbase.hasFunction('createRelation'),
      
      'updateRelation': testbase.hasFunction('updateRelation'),
      
      'destroyRelation': testbase.hasFunction('destroyRelation'),
      
      'junctionTableName': testbase.hasFunction('junctionTableName'),
      
      'junctionKeyName': testbase.hasFunction('junctionKeyName')
      
    },
    
    'it should honor': {
      topic: Thoth.Store.create(Thoth.mixins.junctionRelations,{ primaryKey: 'key'}),
      
      'the primaryKey override': function(t){
        assert.isTrue(t.primaryKey === 'key');
      } 
    }
  }
}).addBatch({
  'By default the junctionTableName should return': {
    topic: function(){
      var store = FakeStore.create();
      return store.junctionTableName('student','exam');
    },
    
    'the parameters in alphabetical order separated by an underscore': function(t){
      assert.strictEqual(t,'exam_student');
    }
  },
  
  'The junctionKeyName function': {
    'when called with model name and key name': {
      topic: function(){
        var store = FakeStore.create();
        return store.junctionKeyName('student','key');
      },
      
      'should return model name and key name joined correctly': function(t){
        assert.strictEqual(t,'student_key');
      }
    },
    
    'when called with only model name': {
      topic: function(){
        var store = FakeStore.create();
        return store.junctionKeyName('student');
      },
      
      'should return model name and default store primary key joined correctly': function(t){
        assert.strictEqual(t, 'student_id');
      }
    },
    
    'when called with only model name and relation type': {
      topic: function(){
        var store = FakeStore.create();
        return store.junctionKeyName('student', null, true);
      },      
      
      'should return model name and default store primary key in plural joined correctly': function(t){
        assert.strictEqual(t,'student_ids');
      }
    }
  }
  
})


.run();
