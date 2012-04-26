var testbase = require('../../testbase');
var assert = testbase.assert;
var Thoth = testbase.Thoth;
var junctionrelationstest = testbase.vows.describe("junction relations tests");
var sys = require('util');
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
  
}).addBatch({
	'_fetchJunctionRecords': {
	// test whether the double query works, mainPks ANY {keys} AND relkeys ANY {relkeys}
		topic: function(){
			var store = FakeStore.create();
			store.fetchDBRecords = function(sr,ud,callback){
				//return a set of records which is not filtered 
				callback(null,[
					{ model_id: 1, relation_key: 1 },
					{ model_id: 1, relation_key: 2 },
					{ model_id: 1, relation_key: 3 },
					{ model_id: 1, relation_key: 4 },
					{ model_id: 2, relation_key: 1 },
					{ model_id: 2, relation_key: 2 },
					{ model_id: 2, relation_key: 3 },
					{ model_id: 2, relation_key: 4 },
					{ model_id: 3, relation_key: 1 },
					{ model_id: 3, relation_key: 2 },
					{ model_id: 3, relation_key: 3 },
					{ model_id: 3, relation_key: 4 },
					{ model_id: 4, relation_key: 1 },
					{ model_id: 4, relation_key: 2 },
					{ model_id: 4, relation_key: 3 },
					{ model_id: 4, relation_key: 4 } 
				]);
			};
			// create a _fetchJunctionRecords request with keys for both main and relation
			store._fetchJunctionRecords([1,2],[3,4],{ 
				modelBucket: 'model',
				relationBucket: 'relation',
				junctionBucket: 'model_relation',
				modelRelationKey: 'model_id',
				relationRelationKey: 'relation_key'
			},this.callback);
		},

		'should filter junction table records': function(t){
		// expect only records fitting the criteria
			assert.isArray(t);
			assert.lengthOf(t,4);
			assert.deepEqual(t, [
				{ model_id: 1, relation_key: 3 },
				{ model_id: 1, relation_key: 4 },
				{ model_id: 2, relation_key: 3 },
				{ model_id: 2, relation_key: 4 }
			]);
		}
	}
}).run();
