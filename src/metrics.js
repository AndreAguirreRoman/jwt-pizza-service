const os = require('os');
const config = require('./config.js');

let requestCount = 0;
let getCount = 0;
let postCount = 0;
let putCount = 0;
let deleteCount = 0;

let totalLatency = 0;
let latencySamples = 0;

let timerStarted = false;

let pizzaOrders = 0;

function incrementPizzaOrders() {
  pizzaOrders++;
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return Number((cpuUsage * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return Number(memoryUsage.toFixed(2));
}

function requestTracker(req, res, next) {
  const start = Date.now();

  requestCount++;

  if (req.method === 'GET') {
    getCount++;
  } else if (req.method === 'POST') {
    postCount++;
  } else if (req.method === 'PUT') {
    putCount++;
  } else if (req.method === 'DELETE') {
    deleteCount++;
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    totalLatency += duration;
    latencySamples++;
  });

  next();
}

function sendMetricToGrafana(metricName, metricValue, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            {
              key: 'service.name',
              value: { stringValue: config.metrics?.source || 'jwt-pizza-service-dev' },
            },
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: 'jwt-pizza-service',
            },
            metrics: [
              {
                name: metricName,
                unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: Number(Math.round(metricValue)),
                      timeUnixNano: String(Date.now() * 1000000),
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality =
      'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }

  const endpointUrl = config.metrics?.endpointUrl || config.endpointUrl;
  const accountId = config.metrics?.accountId || config.accountId;
  const apiKey = config.metrics?.apiKey || config.apiKey;

  fetch(endpointUrl, {
    method: 'POST',
    body: JSON.stringify(metric),
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountId}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to push metric ${metricName}: ${text}`);
      } else {
        console.log(`Pushed metric: ${metricName}=${metricValue}`);
      }
    })
    .catch((error) => {
      console.error(`Error pushing metric ${metricName}:`, error);
    });
}

function sendMetricsPeriodically(period = 5000) {
  if (timerStarted) {
    return;
  }

  timerStarted = true;

  setInterval(() => {
    const avgLatency = latencySamples === 0 ? 0 : totalLatency / latencySamples;

    sendMetricToGrafana('cpu_usage', getCpuUsagePercentage(), 'gauge', '%');
    sendMetricToGrafana('memory_usage', getMemoryUsagePercentage(), 'gauge', '%');

    sendMetricToGrafana('http_requests_total', requestCount, 'sum', '1');
    sendMetricToGrafana('http_requests_get', getCount, 'sum', '1');
    sendMetricToGrafana('http_requests_post', postCount, 'sum', '1');
    sendMetricToGrafana('http_requests_put', putCount, 'sum', '1');
    sendMetricToGrafana('http_requests_delete', deleteCount, 'sum', '1');
    sendMetricToGrafana('pizza_orders_total', pizzaOrders, 'sum', '1');

    sendMetricToGrafana('http_request_latency_avg', avgLatency, 'gauge', 'ms');
  }, period);
}

// start periodic system/reporting automatically when file is loaded
sendMetricsPeriodically();

module.exports = {
  requestTracker,
  sendMetricsPeriodically,
  incrementPizzaOrders,
};