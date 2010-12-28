var Thoth = require('../../lib/Thoth').Thoth;

describe('Thoth package test',function(){
  
  describe('Thoth Core modules check', function(){

    it('Thoth exists', function(){
      expect(Thoth).not.toBeNull();
      expect(Thoth).toBeDefined();
    });

    it('Thoth contains MemStore', function(){
      expect(Thoth.MemStore).toBeDefined();
    });
    
    it('Thoth contains DiskStore', function(){
      expect(Thoth.DiskStore).toBeDefined();
    });    

    it('Thoth contains SocketListener and the SocketClients', function(){
      expect(Thoth.SocketListener).toBeDefined();
    });    

    it('Thoth contains Auth', function(){
      expect(Thoth.Auth).toBeDefined();
    });    

    it('Thoth contains FileAuth', function(){
      expect(Thoth.FileAuth).toBeDefined();
    });

    it('Thoth contains Session', function(){
      expect(Thoth.Session).toBeDefined();
    });

    it('Thoth contains Store', function(){
      expect(Thoth.Store).toBeDefined();
    });    

    it('Thoth contains RPCHooks', function(){
      expect(Thoth.RPCHooks).toBeDefined();
    });

    it('Thoth contains Policies', function(){
      expect(Thoth.Policies).toBeDefined();
    });

    it('Thoth contains PolicyModel', function(){
      expect(Thoth.PolicyModel).toBeDefined();
    });
   
    it('Thoth junction relation mixin exists',function(){
      var junct = require('../../lib/core/mixins/junctionrelations').RelationsByJunctionTable;
      expect(junct).not.toBeNull();
    });
    
  });
  
  describe('Thoth Additional module check', function(){
    
    it('Thoth CouchDBstore exists',function(){
      var cdb = require('../../lib/CouchDBStore').CouchDBStore;
      expect(cdb).not.toBeNull();
    });
    
    it('Thoth LDAPAuth exists', function(){
      var ldap = require('../../lib/LDAPAuth').LDAPAuth;
      expect(ldap).not.toBeNull();
    });
    
    it('Thoth MySQLStore_mysqlClient exists',function(){
      var mysql = require('../../lib/MySQLStore_mysqlClient').LDAPAuth;
      expect(mysql).not.toBeNull();
    });
    
    it('Thoth MySQLStore_node-mysql exists',function(){
      var mysql = require('../../lib/MySQLStore_node-mysql').LDAPAuth;
      expect(mysql).not.toBeNull();
    }); 
    
  });

});

/*
describe('some suite', function () {

  var suiteWideFoo;

  beforeEach(function () {
    suiteWideFoo = 0;
  });

  describe('some nested suite', function() {
    var nestedSuiteBar;
    beforeEach(function() {
      nestedSuiteBar=1;
    });

    it('nested expectation', function () {
      expect(suiteWideFoo).toEqual(0);
      expect(nestedSuiteBar).toEqual(1);
    });

  });

  it('top-level describe', function () {
    expect(suiteWideFoo).toEqual(0);
    expect(nestedSuiteBar).toEqual(undefined);
  });
});


it('should test async call') {
  spyOn(Klass, 'asyncMethod');
  var callback = jasmine.createSpy();

  Klass.asyncMethod(callback);
  expect(callback).not.toHaveBeenCalled();

  var someResponseData = 'foo';
  Klass.asyncMethod.mostRecentCall.args[0](someResponseData);
  expect(callback).toHaveBeenCalledWith(someResponseData);

});

it('shows asynchronous test', function(){
  setTimeout(function(){
    expect('second').toEqual('second');
    asyncSpecDone();
  }, 1);
  expect('first').toEqual('first');
  asyncSpecWait();
});

*/