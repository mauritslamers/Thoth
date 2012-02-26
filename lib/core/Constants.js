/*
 File containing all global constants and error messages used in Thoth
*/

var constants = exports;

// error codes
constants.ERROR_DENIEDONPOLICY = 0;
constants.ERROR_DATAINCONSISTENCY = 1;
constants.ERROR_RPCNOTLOADED = 2;
constants.ERROR_DBERROR = 3;
constants.ERROR_FAILEDJSONSCHEMA = 4;

constants.ERRORS = [
  constants.ERROR_DENIEDONPOLICY,
  constants.ERROR_DATAINCONSISTENCY,
  constants.ERROR_RPCNOTLOADED,
  constants.ERROR_DBERROR
]; 

//actions
constants.ACTION_FETCH = 'fetch';
constants.ACTION_REFRESH = 'refreshRecord';
constants.ACTION_CREATE = 'createRecord';
constants.ACTION_UPDATE = 'updateRecord';
constants.ACTION_DELETE = 'deleteRecord';
constants.ACTION_RPC = 'rpcRequest';
constants.ACTION_LOGOUT = "logOut";
constants.ACTION_FETCH_REPLY = "fetch_reply";
constants.ACTION_FETCH_RELATION_REPLY = "fetch_relation_reply";
constants.ACTION_REFRESH_REPLY = 'refreshRecord_reply';
constants.ACTION_RECORD_REPLY = "record_reply"; // not an action in the sense of API event                             
constants.ACTION_REFRESH_RELATION_REPLY = 'refreshRecord_relation_reply';
constants.ACTION_CREATE_REPLY = 'createRecord_reply';
constants.ACTION_UPDATE_REPLY = 'updateRecord_reply';
constants.ACTION_DELETE_REPLY = 'deleteRecord_reply';
constants.ACTION_FETCH_ERROR = "fetch_error";
constants.ACTION_REFRESH_ERROR = 'refreshRecord_error';
constants.ACTION_CREATE_ERROR = 'createRecord_error';
constants.ACTION_UPDATE_ERROR = 'updateRecord_error';
constants.ACTION_DELETE_ERROR = 'deleteRecord_error'; 
constants.ACTION_ERROR_REPLY = 'error_reply';

constants.SOURCE_SOCKETIO = 'socket.io';
constants.SOURCE_REST = 'rest';
constants.SOURCE_THOTH = 'thoth'; // for distribution

constants.DISTRIBUTE_QUERY = 'query';
constants.DISTRIBUTE_BUCKETKEY = 'bucketkey';

constants.DISTRIBUTE_BUCKETKEY_CREATE = constants.ACTION_CREATE+constants.DISTRUBUTE_BUCKETKEY;
constants.DISTRIBUTE_QUERY_CREATE = constants.ACTION_CREATE+constants.DISTRIBUTE_QUERY;
constants.DISTRIBUTE_BUCKETKEY_UPDATE = constants.ACTION_UPDATE+constants.DISTRIBUTE_BUCKETKEY;
constants.DISTRIBUTE_QUERY_UPDATE = constants.ACTION_UPDATE+constants.DISTRIBUTE_QUERY;
constants.DISTRIBUTE_BUCKETKEY_DELETE = constants.ACTION_DELETE+constants.DISTRIBUTE_BUCKETKEY;
constants.DISTRIBUTE_QUERY_DELETE = constants.ACTION_DELETE+constants.DISTRIBUTE_QUERY;

constants.REQUESTTYPE_XHR = 'xhr';
constants.REQUESTTYPE_WS = 'websocket';
constants.REQUESTTYPE_REST = 'rest';

constants.POLICY_REQUEST_ACCEPTED = YES;
constants.POLICY_REQUEST_DENIED = NO;
constants.POLICY_REQUEST_RETRY = 'retry';