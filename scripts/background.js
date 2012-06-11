(function() {
  var userSnoozing = false,
  userSnoozeTimer,
  currentTabURL,
  toolbarIcon = ((~window.navigator.platform.indexOf('Mac')) ? 'ToolbarIcon.png' : 'ToolbarIcon-Win.png'),
  toolbarButtonProperties = {
    disabled: false,
    icon: toolbarIcon,
    title: 'Web Timer',
    popup: {
      href: 'popup.html', 
      width: 410, 
      height: 500 
    },
  },
  toolbarButton = opera.contexts.toolbar.createItem(toolbarButtonProperties);
  opera.contexts.toolbar.addItem(toolbarButton);

  (function registerEventListeners()
  {
    var tabEvents = ['close', 'create', 'focus', 'blur'],
    windowEvents  = ['create', 'close', 'focus'];
    for (var event in tabEvents)
    {
      opera.extension.tabs.addEventListener(tabEvents[event], restartUserIdleMonitor, false);
    }
    for (var event in windowEvents)
    {
      opera.extension.windows.addEventListener(windowEvents[event], restartUserIdleMonitor, false);
    }
    opera.extension.addEventListener('message', function(event) {
      if (event.data == 'userScrolled')
      {
        restartUserIdleMonitor();
      }
    }, false);
  }());

  function checkCurrentTabURLChange()
  {
    if (currentTabURL != opera.extension.tabs.getFocused().url)
    {
      currentTabURL = opera.extension.tabs.getFocused().url;
      restartUserIdleMonitor();
    }
  }

  function restartUserIdleMonitor()
  {
    userSnoozing = false;
    clearTimeout(userSnoozeTimer);
    userSnoozeTimer = setTimeout(function () { userSnoozing = true; }, 60000); // one minute idle timer
  }

  // Interval (in seconds) to update timer
  var UPDATE_INTERVAL = 3,
    THRESHOLD = 500;
  
  (function setDate()
  {
    // Set date
    if (!widget.preferences.getItem('date'))
    {
      widget.preferences.setItem('date', new Date().toLocaleDateString());
    }
  }());
  
  // Add sites which are not in the top threshold sites to "other" category
  // WARNING: Setting the threshold too low will schew the data set
  // so that it will favor sites that already have a lot of time but
  // trash the ones that are visited frequently for short periods of time
  function combineEntries()
  {
    var domains = JSON.parse(widget.preferences.getItem('domains'));
    var other = JSON.parse(widget.preferences.getItem('other'));
    // Don't do anything if there are less than threshold domains
    if (Object.keys(domains).length <= THRESHOLD) {
      return;
    }
    // Sort the domains by decreasing "all" time
    var data = [];
    for (var domain in domains)
    {
      var domain_data = JSON.parse(widget.preferences.getItem(domain));
      data.push({
        domain: domain,
        all: domain_data.all
      });
    }
    data.sort(function (a, b) {
      return b.all - a.all;
    });
    // Delete data after top threshold and add it to other
    for (var i = THRESHOLD; i < data.length; i++) {
      other.all += data[i].all;
      var domain = data[i].domain;
      delete widget.preferences.removeItem(domain);
      delete domains[domain];
      }
    widget.preferences.setItem('other', JSON.stringify(other));
    widget.preferences.setItem('domains', JSON.stringify(domains));
  }
  
  // Check to make sure data is kept for the same day
  function checkDate()
  {
    var todayStr = new Date().toLocaleDateString();
    var saved_day = widget.preferences.getItem('date');
    if (saved_day !== todayStr)
    {
      // Reset today’s data and delete empty records
      var domains = JSON.parse(widget.preferences.getItem('domains'));
      for (var domain in domains)
      {
        var domain_data = widget.preferences.getItem(domain);
        if (domain_data == '' || domain_data == undefined) {
          delete domains[domain];
          widget.preferences.removeItem(domain);
        } else {
          var domain_data = JSON.parse(domain_data);
          domain_data.today = 0;
          widget.preferences.setItem(domain, JSON.stringify(domain_data));
        }
      }
      widget.preferences.setItem('domains', JSON.stringify(domains));

      // Reset total for today
      var total = JSON.parse(widget.preferences.getItem('total'));
      total.today = 0;
      widget.preferences.setItem('total', JSON.stringify(total));
      // Combine entries that are not part of top sites as set in THREASHOLD
      combineEntries();
      // Keep track of number of days web timer has been used
      widget.preferences.setItem('num_days', parseInt(widget.preferences.getItem('num_days')) + 1);
      // Update date
      widget.preferences.setItem('date', todayStr);
    }
  }
  
  // Extract the domain from the url
  // e.g. http://google.com/ -> google.com
  function extractDomain(url)
  {
    var re = /:\/\/(www\.)?(.+?)\//;
    return url.match(re)[2];
  }
  
  function inBlacklist(url)
  {
    if (!url.match(/^http/))
    {
      return true;
    }
    var blacklist = JSON.parse(widget.preferences.getItem('blacklist'));
    for (var i = 0; i < blacklist.length; i++)
    {
      if (url.match(blacklist[i]))
      {
        return true;
      }
    }
    return false;
  }

  // Update the data
  function recordData()
  {
    if (opera.extension.tabs.getFocused() && opera.extension.tabs.getFocused().url)
    {
      if (window === undefined) {
        return;
      }
      checkCurrentTabURLChange();
      if (!userSnoozing)
      {
        var tab = opera.extension.tabs.getFocused();
        if (tab === undefined) {
          return;
        }
        // Make sure 'today' is up-to-date
        checkDate();
        if (!inBlacklist(tab.url))
        {
          var domain = extractDomain(tab.url);
          // Add domain to domain list if not already present
          var domains = JSON.parse(widget.preferences.getItem('domains'));
          if (!(domain in domains))
          {
            // FIXME: Using object as hash set feels hacky
            domains[domain] = 1;
            widget.preferences.setItem('domains', JSON.stringify(domains));
          }
          var domain_data;
          if (widget.preferences.getItem(domain))
          {
            domain_data = JSON.parse(widget.preferences.getItem(domain));
          }
          else
          {
            domain_data = {
              today: 0,
              all: 0
            };
          }
          domain_data.today += UPDATE_INTERVAL;
          domain_data.all += UPDATE_INTERVAL;
          widget.preferences.setItem(domain, JSON.stringify(domain_data));
          // Update total time
          var total = JSON.parse(widget.preferences.getItem('total'));
          total.today += UPDATE_INTERVAL;
          total.all += UPDATE_INTERVAL;
          widget.preferences.setItem('total', JSON.stringify(total));
        }
      }
    }
  }
  // Update timer data every UPDATE_INTERVAL seconds
  setInterval(recordData, UPDATE_INTERVAL * 1000);
}());

function openOptionsTab()
{
  opera.extension.tabs.create( {
    url: 'options.html', focused: true
  } );
}
