/* 
 calculating and caching computed property values server side, running SC code directly
*/

var vm = require('vm');
var sys = require('../Tools').sys;

/*
how the dependency system works
// the process is as follows: we need to make two categories:
// - cps with no deps in relations
// - cps with deps in relations
// with these two categories, we can make a topological sort
// we only need to do a topological sort on the computed properties depending on other computed properties

*/

var ComputedPropertyCalculator = {

  _cpTopSort: function(allCps){
    // this topsort works as follows:
    // when a cp has a dependency, it is pushed to the next level
    // this creates an array with the deepest dependency at the back.
    // when returning the result, this is reversed, so the deepest dependency is done first
    // this also means that all cps having no dependencies end up in the last round
    
    var isDep = function(cp,cpsSet){
      var propName = cp.propertyName;
      for(var i=0,len=cpsSet.length;i<len;i+=1){
        if(cpsSet[i].dependencies.contains(propName)) return true;
      }
    };

    var sortCP = function(cps){
      var newLevel = [];
      var curLevel = [];
      for(var i=0,len=cps.length;i<len;i+=1){
        if(isDep(cps[i],cps)) newLevel.push(cps[i]);
        else curLevel.push(cps[i]);
      }
      if(newLevel.length === 0) return [curLevel];
      else return [curLevel].concat(sortCP(newLevel));
    };
    var reducer = function(a,b){ 
      if(a instanceof Array) return a.concat(b); 
      else return [a].concat(b); 
    };

    return sortCP(allCps).reverse().reduce(reducer);
  },

  _makeCategories: function(cps,relations,properties){
    var hasRelDeps = [];
    var rest = [];

    var cpsNames = cps.getEach('propertyName');
    var relationNames = (relations && (relations instanceof Array))? relations.getEach('propertyName'): [];
    var propertyNames = properties.getEach('key');

    var hasCPDep = function(ary){
      var ret = [], i, len = ary.length;
      var cpsIndex;
      for(i=0;i<len;i+=1){
        cpsIndex = cpsNames.indexOf(ary[i]);
        if(cpsIndex !== -1) ret.push(cps[cpsIndex]);
      }
      if(ret.length === 0) return false;
      else return ret;
    };

    var hasRelation = function(ary){
      return relationNames.some(function(v){ return ary.contains(v);});
    };

    var processCp = function(cp,hasRel){
      var hasCp,i,len;
      if(!cp) return false;
      //delete cp.functionBody;
      if(hasRel) return true;
      else {
        if(!cp.dependencies) return false;
        else {
          hasCp = hasCPDep(cp.dependencies);
          hasRel = hasRelation(cp.dependencies);
          if(hasRel) return true; // deeper deps don't make a difference, it is tainted
          if(hasCp){
            for(i=0,len=hasCp.length;i<len;i+=1){
              hasRel = hasRel || processCp(hasCp[i],hasRel);
            }
            return hasRel;
          }
        }
      }
    };
    var curCp;
    for(var i=0,len=cps.length;i<len;i+=1){
      curCp = cps[i];
      if(processCp(curCp,false)) hasRelDeps.push(curCp);
      else rest.push(curCp);
    }
    return { hasRels: hasRelDeps, hasNoRels: rest};
  },

  calculateDependencyTree: function(cps,relations,properties){
    var ret = this._makeCategories(cps,relations,properties);
    var sortedHasNoRels = this._cpTopSort(ret.hasNoRels);
    var sortedHasRels = this._cpTopSort(ret.hasRels);
    return { hasNoRels: sortedHasNoRels, hasRels: sortedHasRels };
  },
    
  getComputedPropertiesComputer: function(storeRequest){
  
    //returns two functions: one hasNoRel computer and one hasRel computer
    var sortedCats = this.calculateDependencyTree(storeRequest.computedProperties, storeRequest.relations, storeRequest.properties);
    
    //sys.log('sortedCats: ' + sys.inspect(sortedCats));
    // at the moment it is not possible to do the actual computation in a sandbox...
    // as adding the .property() function doesn't work
    // creating a sandbox with SC loaded also doesn't seem to make a difference 
    var createObjectClass = function(cps){
      var mixin = {}, i,len = cps.length;   
      var code = "(function(){ return SC.Object.extend({";
      for(i=0;i<len;i+=1){
        //sys.log('cps[i] contents:' + sys.inspect(cps[i]));
        code += cps[i].propertyName + ":" + cps[i].functionBody + ".property()";
        if(i<len-1) code += ",";
      }  
      code += "});})()";
      //var ret = vm.runInNewContext(code,{SC: SC, require: require}); 
      var ret = vm.runInThisContext(code);
      return ret;
    };
    
    var relComputer = function(cps){
      return function(recordData,onlyCps){
        if(cps.length === 0) return recordData;
        sys.log('calculating computed properties...');
        var data = (recordData instanceof Array)? recordData: [recordData];
        var numData = data.length;
        var klass = createObjectClass(cps);
        var i,j,rec,numCps = cps.length, propName, ret_cpsOnly = {}, ret, recId, keys = [];
        for(i=0;i<numData;i+=1){
          rec = klass.create(data[i]);
          recId = rec.get(storeRequest.primaryKey);
          keys.push(recId);
          ret_cpsOnly[recId] = {};
          for(j=0;j<numCps;j+=1){
            propName = cps[j].propertyName;
            data[i][propName] = rec.get(propName);
            //sys.log('computed property is: ' + propName + " and value is: " + rec.get(propName));
            ret_cpsOnly[recId][propName] = rec.get(propName);
          }
        }
        ret = onlyCps? { keys: keys, data: ret_cpsOnly } : data;
        return ret;
      };
    };
    
    var hasRelComp = (sortedCats.hasRels && sortedCats.hasRels.length > 0)? relComputer(sortedCats.hasRels): null;
    var hasNoRelComp = (sortedCats.hasNoRels && sortedCats.hasNoRels.length > 0)? relComputer(sortedCats.hasNoRels): null;
    
    return { hasRelationsComputer: relComputer(sortedCats.hasRels), hasNoRelationsComputer: relComputer(sortedCats.hasNoRels) };
  }

};


exports.ComputedPropertyCalculator = ComputedPropertyCalculator;

var bogusData = {
    "properties": [
        {
            "key": "hku_id",
            "type": "String" 
        },
        {
            "key": "group_id",
            "type": "Number" 
        },
        {
            "key": "firstname",
            "type": "String" 
        },
        {
            "key": "inbetween",
            "type": "String" 
        },
        {
            "key": "lastname",
            "type": "String" 
        },
        {
            "key": "email",
            "type": "String" 
        },
        {
            "key": "round",
            "type": "Number" 
        },
        {
            "key": "warning",
            "type": "String" 
        } 
    ],
    "computedProperties": [
        {
            "propertyName": "testCPOne",
            "functionBody": "function () {\n      var fn = this.get('firstname'),\n          ib = this.get('inbetween'),\n          ln = this.get('lastname'),\n          ret;\n  \n      ret = ib? [fn,ib,ln].join(\" \"): [fn,ln].join(\" \");\n      if(this.get('warning')) ret += \" (!)\";\n      //console.log(\"Waarschuwing: \" + this.get('warning'));\n      return ret;\n    }",
            "dependencies": [
                "firstname",
                "inbetween",
                "lastname",
                "warning" 
            ] 
        },
        {
            "propertyName": "testCPTwo",
            "functionBody": "function () {\n      var fn = this.get('firstname'),\n          ib = this.get('inbetween'),\n          ln = this.get('lastname'),\n          ret;\n  \n      ret = ib? [fn,ib,ln].join(\" \"): [fn,ln].join(\" \");\n      if(this.get('warning')) ret += \" (!)\";\n      //console.log(\"Waarschuwing: \" + this.get('warning'));\n      return ret;\n    }",
            "dependencies": [
                "testCPOne",
                "assignmentsByRelation" 
            ] 
        },
        {
            "propertyName": "testCPThree",
            "functionBody": "function () {\n      var fn = this.get('firstname'),\n          ib = this.get('inbetween'),\n          ln = this.get('lastname'),\n          ret;\n  \n      ret = ib? [fn,ib,ln].join(\" \"): [fn,ln].join(\" \");\n      if(this.get('warning')) ret += \" (!)\";\n      //console.log(\"Waarschuwing: \" + this.get('warning'));\n      return ret;\n    }",
            "dependencies": [
                "assignmentsByRelation" 
            ] 
        },
        {
            "propertyName": "testCPFour",
            "functionBody": "function () {\n      var fn = this.get('firstname'),\n          ib = this.get('inbetween'),\n          ln = this.get('lastname'),\n          ret;\n  \n      ret = ib? [fn,ib,ln].join(\" \"): [fn,ln].join(\" \");\n      if(this.get('warning')) ret += \" (!)\";\n      //console.log(\"Waarschuwing: \" + this.get('warning'));\n      return ret;\n    }",
            "dependencies": [
                "testCPThree" 
            ] 
        } 
    ],
    "relations": [
        {
            "type": "toMany",
            "isMaster": false,
            "bucket": "assignment_score",
            "primaryKey": "id",
            "propertyName": "assignmentsByRelation" 
        },
        {
            "type": "toMany",
            "isMaster": false,
            "bucket": "score",
            "primaryKey": "id",
            "propertyName": "scores" 
        } 
    ]
};

var benchmark = function(times){
  var i,start,end;
  var cps = bogusData.computedProperties,
      relations = bogusData.relations,
      properties = bogusData.properties;
      
  start = new Date().getTime();
  for(i=0;i<times;i+=1){
     ComputedPropertyCalculator.calculateDependencyTree(cps,relations,properties);
  }
  end = new Date().getTime();
  sys.log('Benchmark: ' + times + " iterations: " + (end - start) + " ms");
};

exports.benchmark = benchmark;
