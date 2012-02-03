var testbase = require('../../testbase');
var Thoth = testbase.Thoth;

var baseObj = {
  bucket: 'candidate',
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
