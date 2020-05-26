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
    console.log(res);
    res.send({ goodbye });
});

const listener = app.listen(process.env.PORT || 0, () => {
  console.log(`Listening on port ${listener.address().port}`);
});