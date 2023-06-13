"use strict";

var _express = _interopRequireDefault(require("express"));

var _bodyParser = _interopRequireDefault(require("body-parser"));

var _stellarSdk = _interopRequireDefault(require("stellar-sdk"));

var _crypto = _interopRequireDefault(require("crypto"));

var _dotenv = _interopRequireDefault(require("dotenv"));

var _request = _interopRequireDefault(require("request"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _readOnlyError(name) { throw new Error("\"" + name + "\" is read-only"); }

_dotenv["default"].config();

var app = (0, _express["default"])();
app.use(_bodyParser["default"].json());
var API_KEY = process.env.API_KEY;
var CLIC_URL = "https://api.clic.world/banking/v3/";
var PRIVATE_KEY = process.env.PRIVATE_KEY;
var ISSUER_PUBLIC_KEY = process.env.ISSUER_PUBLIC_KEY;
var API_SECRET = process.env.API_SECRET;
var server = new _stellarSdk["default"].Server('https://horizon.stellar.org');
app.post('/', initPayment);

function initPayment(req, res) {
  var _req$body, request_id, wallet_id, amount, currency, pbKey, signatureEnvelopeResult, calculatedSignature, payLoad, initPaymentResult;

  return regeneratorRuntime.async(function initPayment$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _req$body = req.body, request_id = _req$body.request_id, wallet_id = _req$body.wallet_id, amount = _req$body.amount, currency = _req$body.currency;
          console.log("Received transfer request, ", req.body);
          _context.prev = 2;
          _context.next = 5;
          return regeneratorRuntime.awrap(getClicAccount(wallet_id));

        case 5:
          pbKey = _context.sent;

          if (pbKey) {
            _context.next = 8;
            break;
          }

          return _context.abrupt("return", res.status(500).json({
            error: 'Account not found'
          }));

        case 8:
          if (request_id.length > 28) {
            request_id = (_readOnlyError("request_id"), "abc_clic");
          }

          _context.next = 11;
          return regeneratorRuntime.awrap(generateSignatureEnvelope(amount, currency, pbKey, request_id));

        case 11:
          signatureEnvelopeResult = _context.sent;
          calculatedSignature = generateSignature(req.body);
          console.log("signatureEnvelopeResult", signatureEnvelopeResult);
          payLoad = {
            "paymode": "bank",
            "request_id": request_id,
            "wallet_id": wallet_id,
            "amount": amount,
            "currency": currency,
            "envelope": signatureEnvelopeResult,
            "signature": calculatedSignature
          };
          _context.next = 17;
          return regeneratorRuntime.awrap(sendPostData("wallet/depositRequest", payLoad));

        case 17:
          initPaymentResult = _context.sent;
          return _context.abrupt("return", res.status(200).json(initPaymentResult));

        case 21:
          _context.prev = 21;
          _context.t0 = _context["catch"](2);
          console.error('Error processing payment:', _context.t0);
          return _context.abrupt("return", res.status(500).json({
            error: 'Internal Server Error'
          }));

        case 25:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[2, 21]]);
}

function getClicAccount(wallet_id) {
  var raw, response, kson;
  return regeneratorRuntime.async(function getClicAccount$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          console.log("Validating Clic Account", wallet_id);
          raw = {
            "username": wallet_id
          };
          _context2.next = 4;
          return regeneratorRuntime.awrap(sendPostData("accounts/getclicusername", raw));

        case 4:
          response = _context2.sent;
          kson = JSON.parse(response);

          if (!(kson.status == 100)) {
            _context2.next = 11;
            break;
          }

          console.log("Account validated, public key is ", kson.public_key);
          return _context2.abrupt("return", kson.public_key);

        case 11:
          console.log("Account validation failed");
          return _context2.abrupt("return", kson.status);

        case 13:
        case "end":
          return _context2.stop();
      }
    }
  });
}

function generateSignature(requestBody) {
  var request_id = requestBody.request_id,
      wallet_id = requestBody.wallet_id,
      amount = requestBody.amount,
      currency = requestBody.currency;
  var dataToSign = request_id + wallet_id + amount + currency + API_SECRET;

  var sha256Hash = _crypto["default"].createHash('sha256').update(dataToSign).digest();

  return sha256Hash.toString('base64');
}

function generateSignatureEnvelope(amount, assetCode, destination, request_id) {
  var asset, fees, signingSecretKey, signingKeypair, signingAccount, transaction, envelopeXDR;
  return regeneratorRuntime.async(function generateSignatureEnvelope$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          console.log("Generating transaction envelope with data ", {
            amount: amount,
            assetCode: assetCode,
            destination: destination,
            request_id: request_id
          });
          asset = new _stellarSdk["default"].Asset(assetCode, ISSUER_PUBLIC_KEY);
          fees = 1000000; // Set the desired fee value

          signingSecretKey = PRIVATE_KEY;
          signingKeypair = _stellarSdk["default"].Keypair.fromSecret(signingSecretKey);
          _context3.next = 8;
          return regeneratorRuntime.awrap(server.loadAccount(signingKeypair.publicKey()));

        case 8:
          signingAccount = _context3.sent;
          transaction = new _stellarSdk["default"].TransactionBuilder(signingAccount, {
            fee: String(fees),
            networkPassphrase: _stellarSdk["default"].Networks.PUBLIC
          }).addOperation(_stellarSdk["default"].Operation.payment({
            destination: destination,
            asset: asset,
            amount: String(amount)
          })).setTimeout(10000).addMemo(_stellarSdk["default"].Memo.text(request_id)).build();
          transaction.sign(signingKeypair);
          envelopeXDR = transaction.toEnvelope().toXDR('base64');
          console.log("Transaction envelope generated\n ", envelopeXDR);
          return _context3.abrupt("return", envelopeXDR);

        case 16:
          _context3.prev = 16;
          _context3.t0 = _context3["catch"](0);
          console.error('Error generating signature envelope:', _context3.t0);
          return _context3.abrupt("return", null);

        case 20:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 16]]);
}

function sendPostData(subUrl, data) {
  var url, options;
  return regeneratorRuntime.async(function sendPostData$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          console.log("Sending request to clic service");
          url = CLIC_URL + subUrl;
          options = {
            method: 'POST',
            url: url,
            headers: {
              'API-KEY': API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          };
          return _context4.abrupt("return", new Promise(function (resolve, reject) {
            (0, _request["default"])(options, function (error, response, body) {
              if (error) {
                console.error('Error getting to CLIC:', error);
                reject(error);
              } else {
                console.log("Transaction response from clic ", body);
                resolve(body);
              }
            });
          }));

        case 7:
          _context4.prev = 7;
          _context4.t0 = _context4["catch"](0);
          console.error('Error sending request to clic server :', _context4.t0);
          return _context4.abrupt("return", null);

        case 11:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 7]]);
}

app.listen(process.env.PORT, function () {
  console.log('CLIC-ABC MULTI Signer service is running on port ' + process.env.PORT);
  console.log("Send POST requests for http://127.0.0.1:".concat(process.env.PORT));
});