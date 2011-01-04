exports.inconsistentModelData = {
  bucket: 'test',
  key: '513',
  primaryKey: 'test1',
  conditions: 'test = {test}', 
  parameters: { test: 'test' },
  properties: [ { key: 'test1', type: 'String'}, { key: 'test2', type: 'Number'}],
  relations: [{ propertyName: 'firstname', type: 'toMany', bucket: 'firstname'},
              { propertyName: 'lastname', type: 'toOne', bucket: 'lastname'}],
  record: { test1: 'test1', test2: 123 }
};

exports.consistentModelData = {
  bucket: 'test',
  key: '513',
  primaryKey: 'test1',
  conditions: 'test2 = {test}', 
  parameters: { test: 123 },
  properties: [ { key: 'test1', type: 'String'}, { key: 'test2', type: 'Number'}],
  relations: [{ propertyName: 'firstname', type: 'toMany', bucket: 'firstname', keys: [2]},
              { propertyName: 'lastname', type: 'toOne', bucket: 'lastname', keys: [23]}],
  record: { test1: '513', test2: 123 }  
};

var junctionRecordOne = {
  key: 1,
  firstname_key: 2,
  test_key: '513'
};

var junctionRecordTwo = {
  key: 1,
  lastname_key: 23,
  test_key: '513'
};

exports.junctionRecordOne = junctionRecordOne;
exports.junctionRecordTwo = junctionRecordTwo;

exports.relations = {};
exports.relations['firstname'] = junctionRecordOne;
exports.relations['lastname'] = junctionRecordTwo;


exports.relationRecordOne = {
  bucket: 'firstname',
  key: 2,
  primaryKey: 'key',
  properties: [ { key: 'key', type: 'String'}, { key: 'firstname', type: 'String' }],
  record: { key: '23', firstname: 'firstname'}
};

exports.relationRecordTwo = {
  bucket: 'lastname',
  key: 23,
  primaryKey: 'key',
  properties: [ { key: 'key', type: 'String'}, { key: 'lastname', type: 'String' }],
  record: { key: '23', lastname: 'lastname'}  
};

//exports.modelData = exports.consistentModelData;
