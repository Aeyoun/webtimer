(function() {
  var userSnoozing = false,
  userSnoozeTimer,
  currentTabURL,
  tabcollection={},
  activeTab,
  globalStats={},
  toolbarIcon;
  if (~window.navigator.platform.indexOf('Mac')) {
    toolbarIcon = 'ToolbarIcon.png';
  } else {
    toolbarIcon = 'ToolbarIcon-Win.png';
  }
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
  var UPDATE_INTERVAL = 2,
    THRESHOLD = 500;

  function isJson(string) {
    if (string === null) return false
    try {
      JSON.parse(string)
    } catch (e) {
      return false
    }
    return true
  }

  function isDomainName(string) {
    if (/^.+?\..+?$/.test(string)) { // foo.bar[.baz]
      return true
    } else {
      return false
    }
  }
  
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


  function getToday() {
    var now = new Date();
    return now.getFullYear() +'.'+ now.getMonth() + '.' + now.getDate();
  }

  function newTabDay() {
    globalStats[getToday()] = {
      blur: 0,
      activeTime: 0
    }
  }

  // Check to make sure data is kept for the same day
  function checkDate()
  {
    var activedays,
      num_days = parseInt(widget.preferences.getItem('num_days'));
      todayStr = new Date().toLocaleDateString(),
      saved_day = widget.preferences.getItem('date');
    if (isNaN(num_days)) activedays = 1;
    if (saved_day !== todayStr) {
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

      // Increase dat count by one
      activedays = parseInt(widget.preferences.getItem('num_days')) + 1;

      // Update date
      widget.preferences.setItem('date', todayStr);

      // Reset tab usage
      newTabDay();
    }
    if (num_days != activedays && activedays != undefined) {
      widget.preferences.setItem('num_days', activedays);
    }
  }
  
  // Extract the domain from the url
  // e.g. http://google.com/ -> google.com
  function extractDomain(url)
  {
    var re = /:\/\/(www\.)?(.+?)\//;
    return url.match(re)[2];
  }
  
  function inBlacklist(url) {
    /* every address that doesnot start with http or https is blacklisted */
    if (!url.match(/^http/)) return true;

    var blacklist = widget.preferences.getItem('blacklist');
    if (!isJson(blacklist)) {
      /* reset to default if there is something wrong */
      blacklist = '["example.com"]';
      widget.preferences.setItem('blacklist', blacklist);
    }
    if(blacklist) {
      blacklist = JSON.parse(blacklist);
      for (var i = 0; i < blacklist.length; i++){
        if (url.match(blacklist[i])) return true;
      }
    }
    return false;
  }

  function Tab(tab) {
    var _id = tab.id, _url, _created = new Date(), activeTime = 0, blurCount = 0;

    function toString() {
      return {
        id: _id,
        url: _url,
        created: _created,
        activeTime: activeTime,
        blurCount: blurCount
      }
    }

    function init(created, active, blur) {
      _created = created;
      activeTime = active;
      blurCount = blur;
    }

    function blur() {
      blurCount++;

      if(globalStats[getToday()] === undefined) {
        newTabDay();
      }
      globalStats[getToday()].blur++;
    }
    return {
      get id(){return _id},
      get created(){return _created},
      get blurCount(){return blurCount},
      activeTime: activeTime,
      get url(){return _url},
      set url(url){_url=url},
      blur: blur,
      init: init
    }
  }

  // Read in domain from Storage as JSON or (re)create
  function readDomainData(domain) {
    if (isJson(widget.preferences.getItem(domain))) {
      return JSON.parse(widget.preferences.getItem(domain))
    } else {
      return {
        today: 0,
        all: 0
      };
  }}

  function init() {
    if(widget.preferences.getItem('tabtimer')) {
      var sessiondata, persistentdata;
      if ( widget.preferences.getItem('tabtimer') ) {
        persistentdata = JSON.parse(widget.preferences.getItem('tabtimer'));
      }
      else { persistentdata = {}; }

      globalStats = persistentdata.global;

      var allTabs = opera.extension.tabs.getAll();

      for(var i=0, tab; tab = allTabs[i]; i++) {
        if(!tabcollection[tab.id]) {
          tabcollection[tab.id] = new Tab(tab);
        }
      }
    }
    else { /* no persistent data */
      var allTabs = opera.extension.tabs.getAll();
      for(var i=0, tab; tab = allTabs[i]; i++) {
        var id = tab.id;
        tabcollection[id] = new Tab(tab);
      }
    }
    var tab = opera.extension.tabs.getFocused().id;
    activeTab = tab.id
  }

    function getData() {
        var currentTabs = [];
        var allTabs = opera.extension.tabs.getAll();
        for(var i=0, tab; tab = allTabs[i]; i++) {
            var tabData = tabcollection[tab.id];
            currentTabs.push({
                title: tab.title,
                blurCount: tabData.blurCount,
                created: tabData.created,
                activeTime: tabData.activeTime
            });
        }
        if(globalStats[getToday()] === undefined) {
            newTabDay();
        }
        return {
            tabs: currentTabs,
            blurCount: globalStats[getToday()].blur,
            activeTime: globalStats[getToday()].activeTime
        }
    }

  // Update the data
  function recordData() {
    if (window === undefined) return;
    if (!userSnoozing) {
      // Make sure 'today' is up-to-date
      checkDate();
      var tab = opera.extension.tabs.getFocused();
      if (tab === undefined) return;
      if (tab && tab.url){
        checkCurrentTabURLChange();
        if (!inBlacklist(tab.url))
        {

          // Record domain popularity
          var domain = extractDomain(tab.url), domains = widget.preferences.getItem('domains');
          if (!isJson(domains)) {
            rebuildDomainsList()
            return false
          } else {
            // Set variable to JSON
            var domains = JSON.parse(domains);
            // Add domain to domain list if not already present
            if (!(domain in domains))
            {
              // FIXME: Using object as hash set feels hacky
              domains[domain] = 1;
              widget.preferences.setItem('domains', JSON.stringify(domains));
            }
          }
          var domain_data = readDomainData(domain);
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

      // Record tab usage – not URL dependant
      if(!tabcollection) tabcollection = {};
      if(!tabcollection[tab.id]) tabcollection[tab.id] = new Tab(tab);
      if(tabcollection[tab.id].blurCount < 1) tabcollection[tab.id].blur();
      tabcollection[tab.id].activeTime += UPDATE_INTERVAL;
      
      if(globalStats[getToday()] === undefined) newTabDay();
      globalStats[getToday()].activeTime += UPDATE_INTERVAL;

      var allTabs = opera.extension.tabs.getAll();
      for(var i=0, tabfocus; tabfocus = allTabs[i]; i++) {
        if(tabcollection[tabfocus.id]) tabcollection[tabfocus.id].url = tabfocus.url;
      }
      var persistentdata = JSON.stringify({ global: globalStats });
      widget.preferences.setItem('tabtimer', persistentdata);
      var sessiondata = JSON.stringify({ tabs: tabcollection });
      window.sessionStorage.setItem('tabtimer_session', sessiondata);
    }
  }

  function mailMan(e) {
    if (e.data == 'userScrolled') {
      restartUserIdleMonitor();
    }
    else if(e.data == 'cleardata') {
      var domains = JSON.parse(widget.preferences.getItem('domains')),
      other = JSON.parse(widget.preferences.getItem('other'));
      for (var domain in domains) {
        widget.preferences.removeItem(domain);
        delete domains[domain];
      }
      widget.preferences.setItem('domains', '{}');
      widget.preferences.setItem('total', '{"today":0,"all":0}');
      widget.preferences.setItem('other', '{"today":0,"all":0}');
      widget.preferences.setItem('num_days', '1');
      widget.preferences.setItem('date', new Date().toLocaleDateString())
      widget.preferences.removeItem('tabtimer');
      window.sessionStorage.remove('tabtimer_session');
      globalStats = {};
      init();
    }
  }

  init();

  (function registerEventListeners() {
    opera.extension.tabs.addEventListener('close', function(event) {
      delete tabcollection[event.tab.id];

      restartUserIdleMonitor();
    }, false);

    opera.extension.tabs.addEventListener('create', function(event) {
      tabcollection[event.tab.id] = new Tab(event.tab);
      if (event.tab.id && event.tab.focused) {
        activeTab = event.tab.id;
        tabcollection[event.tab.id].blur();
      }

      restartUserIdleMonitor();
    }, false);

    opera.extension.tabs.addEventListener('focus', function(event) {
      if (event.tab.id) activeTab = event.tab.id;

      restartUserIdleMonitor();
    }, false);

    opera.extension.tabs.addEventListener('blur', function(event) {
      tabcollection[event.tab.id].blur();

      restartUserIdleMonitor();
    }, false);

    opera.extension.windows.addEventListener('close', function(event) {
      restartUserIdleMonitor();
    }, false);

    opera.extension.windows.addEventListener('create', function(event) {
      restartUserIdleMonitor();
    }, false);

    opera.extension.windows.addEventListener('focus', function(event) {
      if (event.tab && event.tab.id) activeTab = event.tab.id;

      restartUserIdleMonitor();
    }, false);

    opera.extension.windows.addEventListener('blur', function(e) {
      var tab = opera.extension.tabs.getFocused;
      if(tab && tab.url !== undefined && activeTab !== undefined) {
        tabcollection[activeTab].blur();
      }
    }, false);

    opera.extension.addEventListener('message', mailMan, false);

  }());

  window.TabWatcher = {
    getData: getData,
    globalStats: function() { return globalStats; }
  }

  window.openOptionsTab = function () {
    opera.extension.tabs.create( {
      url: 'options.html', focused: true
     } );
  }

  // Update timer data every UPDATE_INTERVAL seconds
  setInterval(recordData, UPDATE_INTERVAL * 1000);

  window.rebuildDomainsList = function () {
    var storage_length = widget.preferences.length,
      domains_list = { },
      total_times = { today: 0, all: 0 },
      corrupt_keys = Array.new;

    for (var key_number = 0; key_number < storage_length; key_number++) {
      var key = widget.preferences.key(key_number),
        value = widget.preferences.getItem(key);

      // Read domain entries and push to either domains and total_times, or corrupt key
      if (isDomainName(key)) {
        if (!isJson(value)) {
          corrupt_keys.push(key)
        } else {
          domains_list[key] = 1
          total_times.today += JSON.parse(value).today
          total_times.all += JSON.parse(value).all
    }}}

    // Delete corrupt keys
    for (var key in corrupt_keys) {
      widget.preferences.removeKey(key)
      opera.postError('Data recovery: corrupt entry for "' + key + '" removed.')
    }

    // Recreate data
    widget.preferences.setItem('domains', JSON.stringify(domains_list))
    widget.preferences.setItem('total', JSON.stringify(total_times))

}}());
