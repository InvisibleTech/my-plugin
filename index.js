const express = require('express');
const { middleware, errorMiddleware } = require('@envoy/envoy-integrations-sdk');

const app = express();

app.use(middleware());
app.use(errorMiddleware());

app.post('/hello-options', (req, res) => {
    res.send([
        {
            label: 'Hello',
            value: 'Hello',
        },
        {
            label: 'Hola',
            value: 'Hola',
        },
        {
            label: 'Aloha',
            value: 'Aloha',
        },
    ]);
});

app.post('/goodbye-options', (req, res) => {
    res.send([
        {
            label: 'Goodbye',
            value: 'Goodbye',
        },
        {
            label: 'Adios',
            value: 'Adios',
        },
        {
            label: 'Aloha',
            value: 'Aloha',
        },
    ]);
});

app.post('/entry-sign-in', async (req, res) => {
    const envoy = req.envoy; // our middleware adds an "envoy" object to req.
    const job = envoy.job;
    const hello = envoy.meta.config.HELLO;
    const visitor = envoy.payload;
    console.log(">>>>>>>>>>>>>>>>  Envoy payload Sign-in");
    console.log(JSON.stringify(envoy.payload));
    console.log(">>>>>>>>>>>>>>>>  Envoy meta Sign-in");
    console.log(JSON.stringify(envoy.meta));
    const visitorName = visitor.attributes['full-name'];

    const message = `${hello} ${visitorName}!`; // our custom greeting
    await job.attach({ label: 'Hello', value: message }); // show in the Envoy dashboard.

    console.log(">>>>>>>>>>>>>>>>  Response Sign-in");
    console.log(res);
    publish("", "kog-sign-in", new Buffer.from(`Sign in from ${visitorName}`));
    res.send({ hello });
});

app.post('/entry-sign-out', async (req, res) => {
    const envoy = req.envoy; // our middleware adds an "envoy" object to req.
    const job = envoy.job;
    const goodbye = envoy.meta.config.GOODBYE;
    const visitor = envoy.payload;
    console.log(">>>>>>>>>>>>>>>>  Envoy payload Sign-out");
    console.log(JSON.stringify(envoy.payload));
    console.log(">>>>>>>>>>>>>>>>  Envoy meta Sign-out");
    console.log(JSON.stringify(envoy.meta));
    const visitorName = visitor.attributes['full-name'];

    const message = `${goodbye} ${visitorName}!`;
    await job.attach({ label: 'Goodbye', value: message });

    console.log(">>>>>>>>>>>>>>>>  Response Sign-out");
    publish("", "kog-sign-out", new Buffer.from(`Sign out from ${visitorName}`));
    console.log(res);
    res.send({ goodbye });
});

function startWebServer() {
    const listener = app.listen(process.env.PORT || 0, () => {
        console.log(`Listening on port ${listener.address().port}`);
    });
}

// If this file gets any bigger it'll need another zip code.
// Ba-da-boom!
var amqp = require('amqplib/callback_api');

// if the connection is closed or fails to be established at all, we will reconnect
var amqpConn = null;
function start() {
  amqp.connect(process.env.CLOUDAMQP_URL + "?heartbeat=60", function(err, conn) {
    if (err) {
      console.error("[AMQP]", err.message);
      return setTimeout(start, 1000);
    }
    conn.on("error", function(err) {
      if (err.message !== "Connection closing") {
        console.error("[AMQP] conn error", err.message);
      }
    });
    conn.on("close", function() {
      console.error("[AMQP] reconnecting");
      return setTimeout(start, 1000);
    });
    console.log("[AMQP] connected");
    amqpConn = conn;
    whenConnected();
  });
}

function whenConnected() {
  startPublisher();
  startWorker();
  startWebServer();
}

var pubChannel = null;
var offlinePubQueue = [];
function startPublisher() {
  amqpConn.createConfirmChannel(function(err, ch) {
    if (closeOnErr(err)) return;
      ch.on("error", function(err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function() {
      console.log("[AMQP] channel closed");
    });

    pubChannel = ch;
    while (true) {
      var m = offlinePubQueue.shift();
      if (!m) break;
      publish(m[0], m[1], m[2]);
    }
  });
}

function publish(exchange, routingKey, content) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
                      function(err, ok) {
                        if (err) {
                          console.error("[AMQP] publish", err);
                          offlinePubQueue.push([exchange, routingKey, content]);
                          pubChannel.connection.close();
                        }
                      });
  } catch (e) {
    console.error("[AMQP] publish", e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
  }
}
// A worker that acks messages only if processed succesfully
function startWorker() {
  amqpConn.createChannel(function(err, ch) {
    if (closeOnErr(err)) return;
    ch.on("error", function(err) {
      console.error("[AMQP] channel error", err.message);
    });

    ch.on("close", function() {
      console.log("[AMQP] channel closed");
    });

    ch.prefetch(10);
    ch.assertQueue("jobs", { durable: true }, function(err, _ok) {
      if (closeOnErr(err)) return;
      ch.consume("jobs", processMsg, { noAck: false });
      console.log("Worker is started");
    });

    function processMsg(msg) {
      work(msg, function(ok) {
        try {
          if (ok)
            ch.ack(msg);
          else
            ch.reject(msg, true);
        } catch (e) {
          closeOnErr(e);
        }
      });
    }
  });
}

function work(msg, cb) {
  console.log("Got msg ", msg.content.toString());
  cb(true);
}

function closeOnErr(err) {
  if (!err) return false;
  console.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>> Starting Queue \n\n\n");

start();

