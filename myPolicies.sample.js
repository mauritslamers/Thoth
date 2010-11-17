/* file to gather all policies to enable loading them at once and defining which policies to load exactly */
if(!global.SC) require('./sc/runtime/core');

// if you want to use extended versions of ThothPolicyModel, this is the place to require them
// as it will ensure that the models are defined when the policies are loaded.
// Make sure though your extensions are defined in the global name space!
// If you rather choose not to define your extensions global, you have to require your extensions inside the policy files
require('./PolicyModel');

// define the path where to look for policies:
exports.policyPath = './policies';

// define which roles do not require policy checking: "root admin".w()
// if you leave this emply every role will be checked
exports.noPolicyCheckForRoles = "root admin".w();

// define the resources you want to be able to load. Just define the resources.
// example exports.enabledPolicies = "sample1 sample2".w() 
// or
// exports.enabledPolicies = ['sample1','sample2']

exports.enabledPolicies = "".w();