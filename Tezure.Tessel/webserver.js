/**
 * Created by kramamoorthy on 1/11/2015.
 */

//Require variables
var moment = require('moment'),
    https = require('https'),
    async = require('async'),
    router=  require('tiny-router'),
    ws = require("nodejs-websocket"),// Websocket library
    fs = require('fs'),// Use fs for static files
    tessel = require('tessel'); // Use tessel for changing the LEDs

// ServiceBus parameters
var namespace = 'iotdemoservicebus';
var queue = 'mobileservice';
// Use RedDog to generate SAS token
var createdSASToken = 'SharedAccessSignature sr=https%3A%2F%2Fiotdemoservicebus.servicebus.windows.net%2Fmobileservice&sig=RbGD1l%2FxnIzGMJb4%2FH6xJXAb%2F0I903HXoQRYi%2BYAWes%3D&se=1736643103&skn=manage';
//Blob Parameters
var blob_host = 'tezure.blob.core.windows.net';
var blob_container = 'tezure';
// StorageExplorer to generate blob SAS URL
var blob_sas = '?sv=2014-02-14&sr=c&sig=BVxDmNbdpw%2F9EO5Q%2Fs9T7BBRbegbsJ4FxGcSBVyb5rc%3D&st=2015-01-13T05%3A00%3A00Z&se=2015-01-21T05%3A00%3A00Z&sp=rwdl';
// Full ServiceBus Queue publisher URI
var ServiceBusUri = 'https://' + namespace + '.servicebus.windows.net' + '/' + queue;

//Global constants
var jsonResponse = '';
var picName = '';
var tesselImage;



// Run the polling Service every 20 secs.
function postToBlob() {
    require('tesselate')(['camera-vc0706'], function (tessel, modules) {
        async.auto({
            take_Pic: [ function (callback) {
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
                            callback(null,'Take Pic success');
                        }
                    });
                }
                else {
                    console.log('pic name not found');
                    callback(null,'Take Pic failed');
                }
            }],
            write_blob: ['take_Pic', function (callback) {
                //console.log('Results from image', JSON.stringify(results));

                if (picName != '' && tesselImage) {
                    console.log('Blob URI path : ' + '/' + blob_container + '/' + picName + blob_sas);
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
                        res.on('data', function (d) {
                            console.log('Write blob success');
                            callback(null, 'Write blob success');
                        });
                    });

                    req.on('error', function (e) {
                        console.error(e);
                    });

                    req.write(tesselImage);

                    req.end();

                }
                else
                {
                    console.log('Write blob failed');
                    callback(null, 'Write blob failed');
                }
            }]

        }, function (err, results) {
            console.log('err = ', err);
            console.log('results = ', results);
        });
    });
}

// The router should use our static folder for client HTML/JS
router
    .use('static', {path: './static'})
    // Use the onboard file system (as opposed to microsd)
    .use('fs', fs)
    // Listen on port 8080
    .listen(8080);

// When the router gets an HTTP request at /leds/[NUMBER]
router.get("/tezure", function(req, res) {
    // Grab the LED being toggled
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(res.statusCode);
    res.write('<p style="color: red"> Web Server running</p>');
    res.end();
});

// Create a websocket server on port 8081
ws.createServer(function (conn) {
    console.log("New connection")
    // When we get a packet from a connection
    conn.on("text", function (str) {
        jsonResponse = '';
        picName = '';
        console.log("Received "+str);
        jsonResponse = JSON.parse(str);
        console.log('Response after JSON Parse : ' + jsonResponse[0].deviceId);
        if (jsonResponse[0].deviceId) {
            console.log('picname : ' + jsonResponse[0].deviceId + '_' + jsonResponse[0].captureTime + '.jpg');
            picName = jsonResponse[0].deviceId + '_' + jsonResponse[0].captureTime + '.jpg';

        }
        else {
            jsonResponse = '';
            picName = '';
            console.log('Error in getting mobile data');
        }
        if(picName != '')
        {
           postToBlob(picName);
        }

        // Echo it back to confirm
        conn.sendText(str);

    });
    // Notify the console when the connection closes
    conn.on("close", function (code, reason) {
        console.log("Connection closed")
    })
}).listen(8081)

console.log('Running Server');




