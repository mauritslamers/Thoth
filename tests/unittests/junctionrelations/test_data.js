var testbase = require('../../testbase');
var Thoth = testbase.Thoth;

/*
  WARNING: THIS DATA IS HARDCODED IN THE TESTS, SO IF YOU CHANGE IT, CHANGE THE TESTS TOO!!!
*/

var baseObj = {
  bucket: 'student',
  primaryKey: 'id',
  returnData: {
    requestCacheKey: 'somekey'
  }
};

var relation = {
  type: null,
  oppositeType: null,
  bucket: 'exam',
  primaryKey: 'id',
  propertyName: '',
  isNested: false,
  isMaster: false,
  orderBy: null,
  isDirectRelation: false
};

exports.createRequest = function(requestType){
  var ret = Thoth.Tools.copy(baseObj);
  var rel = Thoth.Tools.copy(relation);
  ret.relations = [rel];
  return ret;
};
