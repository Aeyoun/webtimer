var bg = opera.extension.bgProcess;

function save_options()
{
  // Save blacklist domains
  var blackListEl = document.getElementById("blacklist"),
  blacklist_domains = blackListEl.value.split(/\r?\n/),
  blacklist = [];
  // Get rid of empty lines
  for (var i = 0; i < blacklist_domains.length; i++)
  {
    var domain = blacklist_domains[i];
    if (domain)
    {
      blacklist.push(domain);
    }
  }
  blackListEl.value = blacklist.join('\n');
  widget.preferences.setItem('blacklist', JSON.stringify(blacklist));

  // Remove data for sites that have been added to the blacklist
  var domains = JSON.parse(widget.preferences.getItem('domains'));
  for (var domain in domains)
  {
    for (var i = 0; i < blacklist.length; i++)
    {
      if (domain.match(blacklist[i]))
      {
        // Remove data for any domain on the blacklist
        delete domains[domain];
        delete widget.preferences.getItem(domain);
        widget.preferences.setItem('domains', JSON.stringify(domains));
      }
    }
  }

  // Check limit data
  var limit_data = document.getElementById('chart_limit'),
  limit = parseInt(limit_data.value);
  if (limit)
  {
    widget.preferences.setItem('chart_limit', limit);
    limit_data.value = limit;
  }
  else
  {
    limit_data.value = widget.preferences.getItem('chart_limit');
  }

  // Check checkboxes for erasing data
  var clear_data = document.getElementById('clear-data');
  if (clear_data.checked)
  {
    clearData();
    clear_data.checked = false;
  }

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";
  status.className = "success";
  setTimeout(function()
  {
    status.innerHTML = "";
    status.className = "";
  }, 750);
}

// Restores select box state to saved value from localStorage.
function restore_options()
{
  var blacklist = JSON.parse(widget.preferences.getItem('blacklist')),
  blackListEl = document.getElementById("blacklist"),
  limitEl = document.getElementById("chart_limit");
  blackListEl.value = blacklist.join('\n');
  limitEl.value = widget.preferences.getItem('chart_limit');
}

// Clear all data except for blacklist
function clearData()
{
  var domains = JSON.parse(widget.preferences.getItem('domains')),
  other = JSON.parse(widget.preferences.getItem('other'));
  for (var domain in domains)
  {
    widget.preferences.removeItem(domain);
    delete domains[domain];
  }
  widget.preferences.setItem('domains', '{}');
  widget.preferences.setItem('total', '{"today":0,"all":0}');
  widget.preferences.setItem('other', '{"today":0,"all":0}');
  widget.preferences.setItem('num_days', '1');
  widget.preferences.setItem('date', new Date().toLocaleDateString())
  opera.extension.postMessage('cleardata');
}
