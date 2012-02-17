var testbase = require('../testbase');
var API = testbase.Thoth.API;
var C = testbase.Thoth.Constants;
var util = require('util');

var testreq = { bucket: 'admission_exam',
  primaryKey: 'id',
  application: 'ToelatingsMonitor',
  relations: 
   [ { type: 'toOne',
       isDirectRelation: true,
       isMaster: true,
       bucket: 'candidate',
       primaryKey: 'id',
       propertyName: 'candidate',
       propertyKey: 'candidate_id',
       oppositeType: 'toMany' },
     { type: 'toMany',
       isDirectRelation: true,
       isMaster: false,
       orderBy: null,
       bucket: 'assignment_score',
       primaryKey: 'id',
       propertyName: 'assignments',
       propertyKey: null,
       oppositeType: 'toMany' } ],
  conditions: 'curriculumyear = {sy}',
  parameters: { sy: 2010 },
  returnData: { requestKey: 'yjwu7QB03gRz04jJBm8loZ6sIAbduDhRR' } };
  
var ar;
SC.Benchmark.start('APIRequest.from');
for(var i=0;i<1000;i+=1){
  ar = API.APIRequest.from(testreq,C.SOURCE_SOCKETIO,C.ACTION_FETCH);
}
SC.Benchmark.end('APIRequest.from');
util.log(SC.Benchmark.report());
