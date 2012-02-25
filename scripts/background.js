(function() {
  var userSnoozing = false,
  userSnoozeTimer,
  currentTabURL,
  toolbarButtonProperties = {
    disabled: false,
    icon: 'ToolbarIcon.png',
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
  var UPDATE_INTERVAL = 3;
  
  (function setDate()
  {
    // Set date
    if (!widget.preferences.getItem('date'))
    {
      widget.preferences.setItem('date', new Date().toLocaleDateString());
    }
  }());
  
  // Add sites with under threshold seconds of total use to "other" category
  function combineEntries(threshold)
  {
    var domains = JSON.parse(widget.preferences.getItem('domains'));
    var other = JSON.parse(widget.preferences.getItem('other'));
    for (var domain in domains)
    {
      var domain_data = JSON.parse(widget.preferences.getItem(domain));
      if (domain_data.all < threshold)
      {
        other.all += domain_data.all;
        widget.preferences.setItem(domain, '');
        delete domains[domain];
      }
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
      // Reset today's data
      var domains = JSON.parse(widget.preferences.getItem('domains'));
      for (var domain in domains)
      {
        var domain_data = JSON.parse(widget.preferences.getItem(domain));
        domain_data.today = 0;
        widget.preferences.setItem(domain, JSON.stringify(domain_data));
      }
      // Reset total for today
      var total = JSON.parse(widget.preferences.getItem('total'));
      total.today = 0;
      widget.preferences.setItem('total', JSON.stringify(total));
      // Combine entries with total time less than a minute
      combineEntries(60);
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
      checkCurrentTabURLChange();
      if (!userSnoozing)
      {
        var tab = opera.extension.tabs.getFocused();
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
