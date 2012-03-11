(function () {
  'use strict';
  // This script also grants API read access to tabs it is loaded in.
  var userDidScroll = false;
  document.addEventListener('scroll', function () { userDidScroll = true; }, false);
  setInterval(function () {
    if (userDidScroll) {
      userDidScroll = false;
      opera.extension.postMessage('userScrolled');
    }
  }, 1500); // every 1.5 seconds
}());