/*eslint-disable*/
var SDKAPPID = 1400294749;

function genTestUserSig(userID) {

  var EXPIRETIME = 604800;
  var SECRETKEY = '29e433950484389c3050ede42055dce934c0a335a87494495008794d740b8e48';
  var generator = new window.LibGenerateTestUserSig(SDKAPPID, SECRETKEY, EXPIRETIME);
  var userSig = generator.genTestUserSig(userID);
  return {
    SDKAppID: SDKAPPID,
    userSig: userSig
  };
}