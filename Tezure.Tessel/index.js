/**
 * Created by kramamoorthy on 1/11/2015.
 */

//Require variables
var moment = require('moment');
var https = require('https');
var async = require('async');
var wifi = require('wifi-cc3000');

// **** Custom variables begin

//Wifi Settings
var wifiSettings = {
    security: 'wpa2',
    ssid: "RajiKarthi",
    password: "236023485",
    timeout: 30 //secs
};

// ServiceBus Queue parameters
var namespace = 'iotdemoservicebus';
var queue = 'mobileservice';
// Use RedDog to generate SAS token - Refer
var createdSASToken = 'SharedAccessSignature sr=https%3A%2F%2Fiotdemoservicebus.servicebus.windows.net%2Fmobileservice&sig=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&se=1736643103&skn=manage';

//Blob Parameters
var blob_host = 'tezure.blob.core.windows.net';
var blob_container = 'tezure';
// StorageExplorer to generate blob SAS URL
var blob_sas = '?sv=2014-02-14&sr=c&sig=xxxxxxxxxxxxxxxxxxxxxxxxx&st=2015-01-21T05%3A00%3A00Z&se=2016-01-29T05%3A00%3A00Z&sp=rwdl';
// Full ServiceBus Queue publisher URI
var ServiceBusUri = 'https://' + namespace + '.servicebus.windows.net' + '/' + queue;

// **** Custom variables end

//Global constants
var jsonResponse = '';
var picName = '';
var tesselImage;
var count = 0;


// Enable this before pushing it to tessel device to avoid logs
console.log = function() {}

// Run the polling Service every 10 secs.

require('tesselate')(['camera-vc0706'], function (tessel, modules) {
function tesselPollingService() {
    count++;
    console.log("Executed action 1 : Loading tesselPollingService : cycle no :  " + count );
    var setIntervalPoll = setInterval(function pollQueue() {
        clearTimeout(setIntervalPoll); // reset polling service till the current request is complete
            console.log("Executed action 2 : After Camera Load : cycle no :  " + count );
             async.auto({
                listen_messages: function (callback) {
                    var options = {
                        hostname: namespace + '.' + 'servicebus.Windows.net',
                        port: 443,
                        path: '/' + queue + '/messages/head?timeout=30',
                        method: 'DELETE',
                        headers: {
                            'Authorization': createdSASToken,
                            'Content-Type': 'application/json'
                        }
                    };

                    console.log("Calling Azure Queue via REST");
                    var req = https.request(options, function (res) {
                        console.log("Get Message from Queue:statusCode: ", res.statusCode);
                        if (res.statusCode == 200) {
                            console.log("Success Message : " + this.response);

                        }
                        else {
                            picName = '';
                            console.log('Listen message failed');
                            callback(null, 'Listen message failed ');
                        }

                        res.setEncoding('utf8');
                        res.on('data', function (d) {
                            jsonResponse = JSON.parse(d);
                            console.log('Response after JSON Parse : ' + jsonResponse[0].deviceId);
                            if (jsonResponse[0].deviceId) {
                                console.log('picname : ' + jsonResponse[0].deviceId + '_' + jsonResponse[0].captureTime + '.jpg');
                                picName = jsonResponse[0].deviceId + '_' + jsonResponse[0].captureTime + '.jpg';

                            }
                            else {
                                jsonResponse = '';
                                console.log('_' + moment().unix() + '.jpg');
                                picName = '';

                            }
                            console.log('Listen message success');
                            console.log("Executed action 3 : After Queue Read : cycle no :  " + count );
                            callback(null, 'Listen message success');
                        });
                        res.on('end', function () {
                            console.log(str);

                        });
                    });

                    req.on('error', function (e) {
                        console.error('Receive Error');
                        console.error(e);
                    });

                    req.end();
                },
                take_Pic: ['listen_messages', function (callback) {
                    if (picName != '') {
                        console.log('Notification LED Begin');
                        var notificationLED = tessel.led[3]; // Set up an LED to notify when we're taking a picture
                        notificationLED.high();
                        console.log("Calling Camera Module");
                        // Take the picture
                        modules.camera.takePicture(function (err, image) {
                            if (err) {
                                console.log('error taking image', err);
                            } else {
                                notificationLED.low();
                                // Upload the image
                                //var capturedImage = image;
                                console.log('Uploading picture as tessel image...' + picName);
                                tesselImage = image;
                                console.log(url);
                                console.log('done.');
                                // Turn the camera off to end the script
                                //camera.disable();
                                console.log('Take Pic success');
                                console.log("Executed action 4 : After take Picture : cycle no :  " + count );
                                callback(null, 'Take Pic success');
                            }
                        });
                    }
                    else {
                        console.log('pic name not found');
                        console.log("Executed action 4 : Before Camera Load : cycle no :  " + count );
                        callback(null, 'Take Pic failed');
                    }
                }],
                write_blob: ['take_Pic', function (callback) {
                    //console.log('Results from image', JSON.stringify(results));

                    if (picName != '' && tesselImage) {
                        console.log('Blob URI path : ' + blob_host + '/' + blob_container + '/' + picName + blob_sas);
                        var options = {
                            hostname: blob_host,
                            port: 443,
                            path: '/' + blob_container + '/' + picName + blob_sas,
                            method: 'PUT',
                            headers: {
                                'Content-Length': tesselImage.length,
                                'x-ms-blob-type': 'BlockBlob',
                                'Content-Type': 'image/jpeg'
                            }
                        };

                        console.log("Write to Azure Blob via REST");
                        var req = https.request(options, function (res) {
                            console.log("statusCode: ", res.statusCode);
                            console.log("headers: ", res.headers);
                            console.log('Write blob success');
                            console.log("Executed action 5 : After Write Blob : cycle no :  " + count );
                            callback(null, 'Write blob success');
                            res.on('data', function (d) {

                            });
                        });

                        req.on('error', function (e) {
                            console.error(e);
                        });

                        req.write(tesselImage);

                        req.end();

                    }
                    else {
                        console.log('Write blob failed');
                        console.log("Executed action 5 : After Write Blob : cycle no :  " + count );
                        callback(null, 'Write blob failed');
                    }
                }]

            }, function (err, results) {
                console.log('err = ', err);
                console.log('results = ', results);
                console.log("Executed action 6 : Cycle completion : cycle no :  " + count );
                tesselPollingService(); //enable polling service
            });
    }, 2000);
}

// Connect to Local network
    function connect(){
        if (wifi.isConnected()) {
            console.log('Connected.');
            tesselPollingService();
        }
        else {
            console.log('Connecting...');
            console.log(wifiSettings);
            wifi.connect(wifiSettings);
        }
    }

    wifi.on('connect', function(data){
        // you're connected
        console.log("connect emitted", data);
        tesselPollingService();
    });

    wifi.on('disconnect', function () {
        console.log('Disconnected.');
        tessel.led[1].output(0);
        connect();
    });

    wifi.on('timeout', function(err){
        // tried to connect but couldn't, retry
        console.log("timeout emitted");
        timeouts++;
        if (timeouts > 2) {
            // reset the wifi chip if we've timed out too many times
            powerCycle();
        } else {
            // try to reconnect
            connect();
        }
    });

    wifi.on('error', function(err) {
        console.log('error with wifi', err);
        connect();
    })

    function powerCycle(){
        // when the wifi chip resets, it will automatically try to reconnect
        // to the last saved network
        wifi.reset(function(){
            timeouts = 0; // reset timeouts
            console.log("done power cycling");
            // give it some time to auto reconnect
            setTimeout(function(){
                if (!wifi.isConnected()) {
                    // try to reconnect
                    connect();
                }
            }, 20 *1000); // 20 second wait
        })
    }

    connect();

});


// Functions for future use

/*
 // Crypto libs not working on tessel device
 https://forums.tessel.io/t/hmac-encryption-sha256-not-supported/1403
 //var crypto = require('crypto');
 //var moment = require('moment');
 var c_Timeout = 60;
 var AccessKeyName = 'manage';
 var AccessKey = 'rxlAII50CL6xXYx6E5F/9uOhfAIi4BvWBMX+/e4yDc8=';

 function createSASToken(uri, keyName, key)
 {
 //Token expires in December

 var expiry = moment().add(1, 'hours').unix();
 var signedString = encodeURIComponent(uri) + '\n' + expiry;
 console.log('before sha256');
 var hmac = crypto.createHmac('sha256', key);
 hmac.update(signedString);
 console.log('before base64');
 var signature = hmac.digest('base64');
 var token = 'SharedAccessSignature sr=' + encodeURIComponent(uri) + '&sig=' + encodeURIComponent(signature) + '&se=' + expiry + '&skn=' + keyName;
 return token;
 }
 var createdSASToken = createSASToken(ServiceBusUri, AccessKeyName, AccessKey)
 */

/*
 function putMessageInQueue() {

 console.log('create JSON message');
 var message = [];
 console.log('PUSH JSON message');
 message.push({deviceId: 'tessel', command: 'capture', captureTime: moment().unix()});
 console.log('PUSH JSON message complete');
 var options = {
 hostname: namespace + '.' + 'servicebus.Windows.net',
 port: 443,
 path: '/' + queue + '/messages',
 method: 'POST',
 headers: {
 'Authorization': createdSASToken,
 'Content-Type': 'application/json'
 //'Content-Type': 'application/atom+xml;type=entry;charset=utf-8'
 }
 };

 var req = https.request(options, function (res) {
 console.log("putMessageInQueue: " + JSON.stringify(message) + " statusCode: ", res.statusCode);
 res.setEncoding('utf8');
 res.on('data', function (d) {

 });
 });

 req.on('error', function (e) {
 console.error('Send Error');
 console.error(e);
 });

 console.log('Write JSON message complete')
 req.write(JSON.stringify(message));

 req.end();
 }
 */