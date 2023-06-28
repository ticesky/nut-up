'use strict';
const { createHash } = require('crypto');
const omit = require('lodash/omit');

module.exports = env => {
  const hash = createHash('md5');
  hash.update(JSON.stringify(omit(env, 'BASE_NAME')));

  return hash.digest('hex');
};
