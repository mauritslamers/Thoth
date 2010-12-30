exports.inconsistentModelData = {
  bucket: 'test',
  key: '513',
  primaryKey: 'test1',
  conditions: 'test = {test}', 
  parameters: { test: 'test' },
  properties: [ { key: 'test1', type: 'String'}, { key: 'test2', type: 'Number'}],
  relations: [{ propertyName: 'test3', type: 'toMany', bucket: 'test3'},
              { propertyName: 'test4', type: 'toOne', bucket: 'test4'}],
  record: { test1: 'test1', test2: 123 }
};

exports.consistentModelData = {
  bucket: 'test',
  key: '513',
  primaryKey: 'test1',
  conditions: 'test = {test}', 
  parameters: { test: 'test' },
  properties: [ { key: 'test1', type: 'String'}, { key: 'test2', type: 'Number'}],
  relations: [{ propertyName: 'test3', type: 'toMany', bucket: 'test3'},
              { propertyName: 'test4', type: 'toOne', bucket: 'test4'}],
  record: { test1: '513', test2: 123 }  
}

exports.modelData = exports.consistentModelData;
