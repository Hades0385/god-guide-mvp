'use strict';
const { config } = require('../server/src/config');
const { installRichMenu } = require('../server/src/modules/line/richMenu');
installRichMenu({ token: config.lineChannelAccessToken, baseUrl: config.publicBaseUrl })
  .then(result => console.log('Installed Rich Menu:', result.richMenuId))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
