/* 
 calculating and caching computed property values server side, running SC code directly
*/

var vm = require('vm');
var sys = require('sys');

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

    return sortCP(allCps).reverse(); 
  },

  _makeCategories: function(cps,relations,properties){
    var hasRelDeps = [];
    var rest = [];

    var cpsNames = cps.getEach('propertyName');
    var relationNames = relations.getEach('propertyName');
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
      delete cp.functionBody;
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
    var me = this;
    sys.log('unsorted hasNoRels ' + sys.inspect(ret.hasNoRels));
    sys.log('unsorted hasRels: ' + sys.inspect(ret.hasRels));
    
    var c_HasNoRels = this._cpTopSort(ret.hasNoRels);
    var c_HasRels = this._cpTopSort(ret.hasRels);
    sys.log('sorted c_HasNoRels: ' + sys.inspect(c_HasNoRels));
    sys.log('sorted c_HasRels: ' + sys.inspect(c_HasRels));
    //sys.log('ret is: ' + sys.inspect(ret,false,4));
    return ret;
  },
  
  dependingRelationsForComputedProperties: function(computedProperties, relations){ 
    // find out whether there is a dependency between the computed properties and the relations
    var i,j,k,numDeps,deps,
        cp = computedProperties,
        rel = relations,
        cp_len = computedProperties.length,
        rel_len = relations.length,
        ret = [];
      
    for(i=0;i<cp_len;i+=1){
      deps = cp[i].dependencies;
      for(j=0,numDeps=deps.length;j<numDeps;j+=1){
        for(k=0;k<rel_len;k+=1){
          if(deps[j] === rel[k].propertyName){
            if(ret.indexOf(rel[k]) === -1) ret.push(rel[k]); // push it if not found...
          }
        }
      }
    }
    return ret;
  },
  
  _computedValuesCache: {}, // a cache of [bucket][key][record data]; (can even be written to disk?)
  
  computeComputedPropertiesForRecord: function(recordData,computedProperties){
    var record = SC.Object.create(recordData);
    var sandbox = {
      record: record
    };
    var functionCode, propName, code, result;
    
    for(var i=0,len=computedProperties.length;i<len;i+=1){
      functionCode = computedProperties[i].code;
      propName = computedProperties[i].propertyName;
      code = "record[" + propName + "] = " + functionCode + ";";
      code += "record.get('" + propName + "');";
      result = vm.runInNewContext(code,sandbox);
      // push the result to the record
      recordData[propName] = result;
    }
  },
  
  computeComputedPropertiesForRecords: function(records,relationData,computedProperties){
    //we need to find a way to find out whether a computed property uses data from relations
    // which doesn't necessarily be hard, as we only need to search for .get(relationProperty) in the function code
    // we have the values of the relation ids at hand, so we only need to retrieve it for certain ids...
    // this requires a fetch with a query... :)
  }
};


exports.ComputedPropertyCalculator = ComputedPropertyCalculator;