/*
 File containing all global constants and error messages used in Thoth
*/

// error codes
exports.ERROR_DENIEDONPOLICY = 0;
exports.ERROR_DATAINCONSISTENCY = 1;
exports.ERROR_RPCNOTLOADED = 2;
exports.ERROR_DBERROR = 3;

exports.ERRORS = [
  exports.ERROR_DENIEDONPOLICY,
  exports.ERROR_DATAINCONSISTENCY,
  exports.ERROR_RPCNOTLOADED,
  exports.ERROR_DBERROR
]; 

//actions
exports.ACTION_FETCH = 'fetch';
exports.ACTION_REFRESH = 'refreshRecord';
exports.ACTION_CREATE = 'createRecord';
exports.ACTION_UPDATE = 'updateRecord';
exports.ACTION_DELETE = 'deleteRecord';
exports.ACTION_RPC = 'rpcRequest';
exports.ACTION_LOGOUT = "logOut";
exports.ACTION_FETCH_REPLY = "fetch_reply";
exports.ACTION_FETCH_RELATION_REPLY = "fetch_relation_reply";
exports.ACTION_REFRESH_REPLY = 'refreshRecord_reply';
exports.ACTION_RECORD_REPLY = "record_reply"; // not an action in the sense of API event                             
exports.ACTION_REFRESH_RELATION_REPLY = 'refreshRecord_relation_reply';
exports.ACTION_CREATE_REPLY = 'createRecord_reply';
exports.ACTION_UPDATE_REPLY = 'updateRecord_reply';
exports.ACTION_DELETE_REPLY = 'deleteRecord_reply';
exports.ACTION_FETCH_ERROR = "fetch_error";
exports.ACTION_REFRESH_ERROR = 'refreshRecord_error';
exports.ACTION_CREATE_ERROR = 'createRecord_error';
exports.ACTION_UPDATE_ERROR = 'updateRecord_error';
exports.ACTION_DELETE_ERROR = 'deleteRecord_error'; 
exports.ACTION_ERROR_REPLY = 'error_reply';

exports.SOURCE_SOCKETIO = 'socket.io';
exports.SOURCE_REST = 'rest';
exports.SOURCE_THOTH = 'thoth'; // for distribution

exports.DISTRIBUTE_QUERY = 'query';
exports.DISTRIBUTE_BUCKETKEY = 'bucketkey';

exports.REQUESTTYPE_XHR = 'xhr';
exports.REQUESTTYPE_WS = 'websocket';
exports.REQUESTTYPE_REST = 'rest';

exports.POLICY_REQUEST_ACCEPTED = YES;
exports.POLICY_REQUEST_DENIED = NO;
exports.POLICY_REQUEST_RETRY = 'retry';