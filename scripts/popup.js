window.addEventListener('DOMContentLoaded', function()
{
  // move buttons to platform native location if different from default
  if (~navigator.platform.indexOf('Mac'))
  {
    document.getElementById('options').style.cssFloat = 'right';
    document.getElementById('close').style.cssFloat = 'left';
  }
}, false);

// Types to view data
var TYPE = {
  today: "today",
  average: "average",
  all: "all"
},
mode = TYPE.today;

// Load the Visualization API and the piechart package.
google.load('visualization', '1.0', {'packages':['corechart', 'table']});
// Set a callback to run when the Google Visualization API is loaded.
google.setOnLoadCallback(showToday);

// Show options in a new tab
function showOptions()
{
  opera.extension.bgProcess.openOptionsTab();
}

// Converts duration to String
function timeString(numSeconds)
{
  if (numSeconds === 0)
  {
    return "0 seconds";
  }
  var remainder = numSeconds,
  timeStr = "",
  timeTerms = {
    hour: 3600,
    minute: 60,
    second: 1
  };
  // Don't show seconds if time is more than one hour
  if (remainder >= timeTerms.hour)
  {
    remainder = remainder - (remainder % timeTerms.minute);
    delete timeTerms.second;
  }
  // Construct the time string
  for (var term in timeTerms)
  {
    var divisor = timeTerms[term];
    if (remainder >= divisor)
    {
      var numUnits = Math.floor(remainder / divisor);
      timeStr += numUnits + " " + term;
      // Make it plural
      if (numUnits > 1)
      {
        timeStr += "s";
      }
      remainder = remainder % divisor;
      if (remainder)
      {
        timeStr += " and "
      }
    }
  }
  return timeStr;
}

// Show the data for the time period indicated by addon
function show(type)
{
  // Get the domain data
  var domains = JSON.parse(widget.preferences.getItem('domains')),
  chart_data = [];
  for (var domain in domains)
  {
    var domain_data = widget.preferences.getItem(domain);
    if (domain_data == '' || domain_data == undefined) {
      delete domains[domain];
      widget.preferences.removeItem(domain);
    } else {
      var domain_data = JSON.parse(domain_data),
      numSeconds = 0;
      if (type === TYPE.today)
      {
        numSeconds = domain_data.today;
      }
      else if (type === TYPE.average)
      {
        numSeconds = Math.floor(domain_data.all / parseInt(widget.preferences.getItem('num_days')));
      }
      else if (type === TYPE.all)
      {
        numSeconds = domain_data.all;
      }
      else
      {
        console.error("No such type: " + type);
      }
      if (numSeconds > 0)
      {
        chart_data.push([domain, {
          v: numSeconds,
          f: timeString(numSeconds),
          p: {
            style: "text-align: left; white-space: normal;"
          }
        }]);
      }
    }
  }
  widget.preferences.setItem('domains', JSON.stringify(domains));

  // Display help message if no data
  if (chart_data.length === 0)
  {
    document.getElementById("nodata").style.display = "inline";
  }
  else
  {
    document.getElementById("nodata").style.display = "none";
  }

  // Sort data by descending duration
  chart_data.sort(function (a, b) {
    return b[1].v - a[1].v;
  });

  // Limit chart data
  var limited_data = [],
  chart_limit = parseInt(widget.preferences.getItem('chart_limit'));
  for (var i = 0; i < chart_limit && i < chart_data.length; i++)
  {
    limited_data.push(chart_data[i]);
  }
  var sum = 0;
  for (var i = chart_limit; i < chart_data.length; i++)
  {
    sum += chart_data[i][1].v;
  }
  // Add time in "other" category for total and average
  var other = JSON.parse(widget.preferences.getItem('other'));
  if (type === TYPE.average)
  {
    sum += Math.floor(other.all / parseInt(widget.preferences.getItem('num_days')));
  }
  else if (type === TYPE.all)
  {
    sum += other.all;
  }
  if (sum > 0)
  {
    limited_data.push(["Other", {
      v: sum,
      f: timeString(sum),
      p: {
        style: "text-align: left; white-space: normal;"
      }
    }]);
  }

  // Draw the chart
  drawChart(limited_data);

  // Add total time
  var total = JSON.parse(widget.preferences.getItem('total')),
  numSeconds = 0;
  if (type === TYPE.today)
  {
    numSeconds = total.today;
  }
  else if (type === TYPE.average)
  {
    numSeconds = Math.floor(total.all / parseInt(widget.preferences.getItem('num_days')));
  }
  else if (type === TYPE.all)
  {
    numSeconds = total.all;
  }
  else
  {
    console.error("No such type: " + type);
  }
  limited_data.push([{
    v: "Total",
    p: {
      style: "font-weight: bold;"
    }
  }, {
    v: numSeconds,
    f: timeString(numSeconds),
    p: {
      style: "text-align: left; white-space: normal; font-weight: bold;"
    }
  }]);

  // Draw the table
  drawTable(limited_data, type);
}

function updateNav(type)
{
  document.getElementById('today').className = '';
  document.getElementById('average').className = '';
  document.getElementById('all').className = '';
  document.getElementById(type).className = 'active';
}

function showToday()
{
  mode = TYPE.today;
  show(TYPE.today);
  updateNav(TYPE.today);
}

function showAverage()
{
  mode = TYPE.average;
  show(TYPE.average);
  updateNav(TYPE.average);
}

function showAllTime()
{
  mode = TYPE.all;
  show(TYPE.all);
  updateNav(TYPE.all);
}

// Callback that creates and populates a data table, 
// instantiates the pie chart, passes in the data and
// draws it.
function drawChart(chart_data)
{
  // Create the data table.
  var data = new google.visualization.DataTable();
  data.addColumn('string', 'Domain');
  data.addColumn('number', 'Time');
  data.addRows(chart_data);

  // Set chart options
  var options = {
    tooltip: {
      text: 'percentage'
    },
    chartArea: {
      width: 400,
      height: 180
    }
  };

  // Instantiate and draw our chart, passing in some options.
  var chart = new google.visualization.PieChart(document.getElementById('chart_div'));
  chart.draw(data, options);
}

function drawTable(table_data, type)
{
  var data = new google.visualization.DataTable();
  data.addColumn('string', 'Domain');
  var timeDesc;
  if (type === TYPE.today)
  {
    timeDesc = "Today";
  }
  else if (type === TYPE.average)
  {
    timeDesc = "Daily Average";
  }
  else if (type === TYPE.all)
  {
    timeDesc = "Over " + widget.preferences.getItem('num_days') + ' Days';
  }
  else
  {
    console.error("No such type: " + type);
  }
  data.addColumn('number', "Time Spent (" + timeDesc + ")");
  data.addRows(table_data);

  var options = {
    allowHtml: true,
    sort: 'disable'
  }
  var table = new google.visualization.Table(document.getElementById('table_div'));
  table.draw(data, options);
}