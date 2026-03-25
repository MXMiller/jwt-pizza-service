const config = require('./config');
const os = require('os');

// Metrics stored in memory
const requests = {};

let registerCount = 0;
let loginCount = 0;
let logoutCount = 0;

let loggedInUserCount = 0;

function userRegistered() {
  registerCount++;
  loggedInUserCount++;
}

function userLoggedIn() {
  loginCount++;
  loggedInUserCount++;
}

function userLoggedOut() {
  logoutCount++;
  loggedInUserCount--;
}

let authSuccessCount = 0;
let authFailCount = 0;

function authSucceeded() {
  authSuccessCount++;
}

function authFailed() {
  authFailCount++;
}

let orderCount = 0;
let orderFailCount = 0;
let revenue = 0;

function orderSucceeded() {
  orderCount++;
}

function orderFailed() {
  orderFailCount++;
}

function updateRevenue(orderTotal) {
  revenue = revenue + orderTotal;
}

let orderLatency = 0;
let reqLatency = 0;

function calcOrderLatency(start, end) {
  orderLatency = end - start; 
}

function calcReqLatency(start, end) {
  reqLatency = end - start; 
}

let veggieCount = 0;
let pepperoniCount = 0;
let margaritaCount = 0;
let crustyCount = 0;
let charredLeopardCount = 0;

function veggieSold() {
  veggieCount++;
}

function pepperoniSold() {
  pepperoniCount++;
}

function margaritaSold() {
  margaritaCount++;
}

function crustySold() {
  crustyCount++;
}

function charredLeopardSold() {
  charredLeopardCount++;
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

// Middleware to track requests
function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

// This will periodically send metrics to Grafana
setInterval(() => {
  const metrics = [];
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
  });

  metrics.push(createMetric('registerCount', registerCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('loginCount', loginCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('logoutCount', logoutCount, '1', 'sum', 'asInt', {}));

  metrics.push(createMetric('loggedInUserCount', loggedInUserCount, '1', 'sum', 'asInt', {}));

  metrics.push(createMetric('authSuccessCount', authSuccessCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('authFailCount', authFailCount, '1', 'sum', 'asInt', {}));

  metrics.push(createMetric('orderCount', orderCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('orderFailCount', orderFailCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('revenue', revenue, '1', 'sum', 'asDouble', {}));

  metrics.push(createMetric('orderLatency', orderLatency, '1', 'sum', 'asDouble', {}));
  metrics.push(createMetric('reqLatency', reqLatency, '1', 'sum', 'asDouble', {}));

  metrics.push(createMetric('cpuUsage', getCpuUsagePercentage(), '%', 'sum', 'asDouble', {  }));
  metrics.push(createMetric('memoryUsage', getMemoryUsagePercentage(), '%', 'sum', 'asDouble', {  }));

  metrics.push(createMetric('veggieCount', veggieCount, '1', 'sum', 'asDouble', {}));
  metrics.push(createMetric('pepperoniCount', pepperoniCount, '1', 'sum', 'asDouble', {}));
  metrics.push(createMetric('margaritaCount', margaritaCount, '1', 'sum', 'asDouble', {}));
  metrics.push(createMetric('crustyCount', crustyCount, '1', 'sum', 'asDouble', {}));
  metrics.push(createMetric('charredLeopardCount', charredLeopardCount, '1', 'sum', 'asDouble', {}));

  //console.log('sending new metrics')
  sendMetricToGrafana(metrics);
}, 1000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            scope: { name: "custom-metrics" },
            metrics
          }
        ]
      }
    ]
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}


module.exports = { requestTracker, getCpuUsagePercentage, getMemoryUsagePercentage, 
    userRegistered, userLoggedIn, userLoggedOut,
    authSucceeded, authFailed,
    orderSucceeded, orderFailed, updateRevenue,
    calcOrderLatency, calcReqLatency,
    veggieSold, pepperoniSold, margaritaSold, crustySold, charredLeopardSold };