function canApplyForApi(kyc) {
  return kyc?.status === 'approved';
}

module.exports = { canApplyForApi };
