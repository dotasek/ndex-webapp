// Only load hammer.js when in a browser environment
// (loading hammer.scripts in a node.scripts environment gives errors)
if (typeof window !== 'undefined') {
  module.exports = window['Hammer'] || require('hammerjs');
}
else {
  module.exports = function () {
    throw Error('hammer.scripts is only available in a browser, not in node.js.');
  }
}
