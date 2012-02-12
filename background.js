(function() {
  var toolbarButton,
  toolbarButtonProperties = {
    disabled: false,
    icon: 'icon_19.png',
    title: 'Web Timer',
    popup: {
      href: 'popup.html', 
      width: 410, 
      height: 500 
    },
  },
  toolbarButton = opera.contexts.toolbar.createItem(toolbarButtonProperties);
  opera.contexts.toolbar.addItem(toolbarButton);
    
  
  // Interval (in seconds) to update timer
  var UPDATE_INTERVAL = 3;
  // Types to view data
  var TYPE = {
    today: "today",
    average: "average",
    all: "all"
  };
  
  setDefaults();
  // Set default settings
  function setDefaults() {
    // Set blacklist
    if (!localStorage["blacklist"]) {
      localStorage["blacklist"] = JSON.stringify(["example.com"]);
    }
    // Set number of days Web Timer has been used
    if (!localStorage["num_days"]) {
      localStorage["num_days"] = 1;
    }
    // Set date
    if (!localStorage["date"]) {
      localStorage["date"] = new Date().toLocaleDateString();
    }
    // Set domains seen before
    if (!localStorage["domains"]) {
      localStorage["domains"] = JSON.stringify({});
    }
    // Set total time spent
    if (!localStorage["total"]) {
      localStorage["total"] = JSON.stringify({
        today: 0,
        all: 0
      });
    }
    // Limit how many sites the chart shows
    if (!localStorage["chart_limit"]) {
      localStorage["chart_limit"] = 7;
    }
    // Set "other" category
    // NOTE: other.today is not currently used
    if (!localStorage["other"]) {
      localStorage["other"] = JSON.stringify({
        today: 0,
        all: 0
      });
    }
  }
  
  // Add sites with under threshold seconds of total use to "other" category
  function combineEntries(threshold) {
    var domains = JSON.parse(localStorage["domains"]);
    var other = JSON.parse(localStorage["other"]);
    for (var domain in domains) {
      var domain_data = JSON.parse(localStorage[domain]);
      if (domain_data.all < threshold) {
        other.all += domain_data.all;
        delete localStorage[domain];
        delete domains[domain];
      }
    }
    localStorage["other"] = JSON.stringify(other);
    localStorage["domains"] = JSON.stringify(domains);
  }
  
  // Check to make sure data is kept for the same day
  function checkDate() {
    var todayStr = new Date().toLocaleDateString();
    var saved_day = localStorage["date"];
    if (saved_day !== todayStr) {
      // Reset today's data
      var domains = JSON.parse(localStorage["domains"]);
      for (var domain in domains) {
        var domain_data = JSON.parse(localStorage[domain]);
        domain_data.today = 0;
        localStorage[domain] = JSON.stringify(domain_data);
      }
      // Reset total for today
      var total = JSON.parse(localStorage["total"]);
      total.today = 0;
      localStorage["total"] = JSON.stringify(total);
      // Combine entries with total time less than a minute
      combineEntries(60);
      // Keep track of number of days web timer has been used
      localStorage["num_days"] = parseInt(localStorage["num_days"]) + 1;
      // Update date
      localStorage["date"] = todayStr;
    }
  }
  
  // Extract the domain from the url
  // e.g. http://google.com/ -> google.com
  function extractDomain(url) {
    var re = /:\/\/(www\.)?(.+?)\//;
    return url.match(re)[2];
  }
  
  function inBlacklist(url) {
    if (!url.match(/^http/)) {
      return true;
    }
    var blacklist = JSON.parse(localStorage["blacklist"]);
    for (var i = 0; i < blacklist.length; i++) {
      if (url.match(blacklist[i])) {
        return true;
      }
    }
    return false;
  }
  
  // Update the data
  function updateData() {
    // Only count time if Chrome has focus
    chrome.windows.getLastFocused(function (window) {
      if (window.focused) {
        // Only count time if system has not been idle for 30 seconds
        chrome.idle.queryState(30, function (state) {
          if (state === "active") {
            chrome.tabs.getSelected(null, function (tab) {
              // Make sure 'today' is up-to-date
              checkDate();
              if (!inBlacklist(tab.url)) {
                var domain = extractDomain(tab.url);
                // Add domain to domain list if not already present
                var domains = JSON.parse(localStorage["domains"]);
                if (!(domain in domains)) {
                  // FIXME: Using object as hash set feels hacky
                  domains[domain] = 1;
                  localStorage["domains"] = JSON.stringify(domains);
                }
                var domain_data;
                if (localStorage[domain]) {
                  domain_data = JSON.parse(localStorage[domain]);
                } else {
                  domain_data = {
                    today: 0,
                    all: 0
                  };
                }
                domain_data.today += UPDATE_INTERVAL;
                domain_data.all += UPDATE_INTERVAL;
                localStorage[domain] = JSON.stringify(domain_data);
                // Update total time
                var total = JSON.parse(localStorage["total"]);
                total.today += UPDATE_INTERVAL;
                total.all += UPDATE_INTERVAL;
                localStorage["total"] = JSON.stringify(total);
              }
            });
          }
        });
      }
    });
  }
  // Update timer data every UPDATE_INTERVAL seconds
  setInterval(updateData, UPDATE_INTERVAL * 1000);
}());