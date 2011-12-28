/*
 File containing all global constants and error messages used in Thoth
*/

// error codes
exports.ERROR_DENIEDONPOLICY = 0;
exports.ERROR_DATAINCONSISTENCY = 1;
exports.ERROR_RPCNOTLOADED = 2;
exports.ERROR_DBERROR = 3;

//actions
exports.ACTION_FETCH = 'fetch';
exports.ACTION_REFRESH = 'refresh';
exports.ACTION_CREATE = 'create';
exports.ACTION_UPDATE = 'update';
exports.ACTION_DELETE = 'destroy';
exports.ACTION_RPC = 'rpc';
exports.ACTION_FETCH_REPLY = "fetch_reply";
exports.ACTION_REFRESH_REPLY = 'refresh_reply';
exports.ACTION_CREATE_REPLY = 'create_reply';
exports.ACTION_UPDATE_REPLY = 'update_reply';
exports.ACTION_DELETE_REPLY = 'destroy_reply';
exports.ACTION_FETCH_ERROR = "fetch_error";
exports.ACTION_REFRESH_ERROR = 'refresh_error';
exports.ACTION_CREATE_ERROR = 'create_error';
exports.ACTION_UPDATE_ERROR = 'update_error';
exports.ACTION_DELETE_ERROR = 'destroy_error';




exports.DISTRIBUTE_QUERY = 'query';
exports.DISTRIBUTE_BUCKETKEY = 'bucketkey';

exports.REQUESTTYPE_XHR = 'xhr';
exports.REQUESTTYPE_WS = 'websocket';
exports.REQUESTTYPE_REST = 'rest';

exports.POLICY_REQUEST_ACCEPTED = YES;
exports.POLICY_REQUEST_DENIED = NO;
exports.POLICY_REQUEST_RETRY = 'retry';